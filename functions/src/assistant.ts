import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { z } from 'zod';
import { isPro } from './domain';

/**
 * The Pro assistant.
 *
 * The model **phrases**, it never computes. The rider's figures arrive already
 * calculated and already formatted by the app, and the prompt forbids inventing
 * or recomputing any of them — so an answer can never disagree with the number
 * the Dashboard is showing beside it.
 *
 * The key lives in Secret Manager and is read at runtime. It is never in the
 * app bundle, which is the whole reason this runs on a server at all.
 */
export const openRouterKey = defineSecret('OPENROUTER_API_KEY');

/** Cheap enough that a heavy rider costs under a dollar a year. */
const MODEL = defineString('ASSISTANT_MODEL', { default: 'google/gemini-2.5-flash-lite' });
const MONTHLY_QUOTA = 100;
const MAX_CONTEXT_BYTES = 24_000;

const input = z.object({
  question: z.string().trim().min(2).max(500),
  context: z.unknown(),
});

const SYSTEM = [
  'You are the assistant inside Revora, a motorcycle logbook app.',
  '',
  'You are given a JSON snapshot of one rider\'s own records. Every figure in it',
  'has already been calculated and formatted by the app.',
  '',
  'Rules you must follow:',
  '- Quote figures from the snapshot exactly as they appear, including the currency',
  '  code and units. Never reformat, convert, round or recalculate them.',
  '- Never do arithmetic. If a number is not in the snapshot, say you do not have it.',
  '- If the snapshot shows a value as null or "—", that figure cannot be computed',
  '  yet. Say so plainly and say what the rider would need to log for it to appear.',
  '- Answer only from the snapshot. Never use general knowledge about motorcycles',
  '  to state a fact about THIS bike.',
  '- Be brief: two or three sentences unless asked for detail. No preamble, no',
  '  restating the question, no markdown headings.',
  '- Write in plain British English, second person, like a knowledgeable mechanic',
  '  who respects the rider\'s time.',
].join('\n');

function monthKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const askAssistant = onCall(
  { region: 'us-central1', timeoutSeconds: 120, maxInstances: 20, secrets: [openRouterKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to Revora.');
    if (request.auth.token.firebase?.sign_in_provider === 'anonymous') {
      throw new HttpsError('failed-precondition', 'Create a Revora account to use the assistant.');
    }
    const uid = request.auth.uid;

    const parsed = input.safeParse(request.data);
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Ask a question between 2 and 500 characters.');

    const context = JSON.stringify(parsed.data.context ?? {});
    if (context.length > MAX_CONTEXT_BYTES) {
      throw new HttpsError('invalid-argument', 'That motorcycle has more history than the assistant can read at once.');
    }

    const db = getFirestore();
    const now = new Date();

    // Pro is decided by the server entitlement, never by the client.
    const entitlement = await db.doc(`entitlements/${uid}`).get();
    if (!isPro(entitlement.data(), now.getTime())) {
      throw new HttpsError('permission-denied', 'The assistant is part of Revora Pro.');
    }

    // Quota is reserved before the model call, so a burst of parallel questions
    // cannot each see the same count and all slip through.
    const usageRef = db.doc(`aiUsage/${uid}_${monthKey(now)}`);
    const used = await db.runTransaction(async (tx) => {
      const snap = await tx.get(usageRef);
      const count = Number(snap.data()?.count ?? 0);
      if (count >= MONTHLY_QUOTA) return null;
      tx.set(usageRef, { userId: uid, month: monthKey(now), count: count + 1, updatedAt: now.getTime() }, { merge: true });
      return count + 1;
    });
    if (used === null) {
      throw new HttpsError('resource-exhausted', `You have used all ${MONTHLY_QUOTA} assistant questions this month. It resets on the 1st.`);
    }

    const key = openRouterKey.value();
    if (!key) {
      await usageRef.set({ count: FieldValue.increment(-1) }, { merge: true });
      throw new HttpsError('unavailable', 'The assistant is not available yet.');
    }

    let answer: string;
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://revora.app',
          'X-Title': 'Revora',
        },
        body: JSON.stringify({
          model: MODEL.value(),
          max_tokens: 400,
          temperature: 0.2,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: `Rider's records:\n${context}\n\nQuestion: ${parsed.data.question}` },
          ],
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) {
        logger.warn('OpenRouter rejected the request', { status: response.status });
        throw new Error(`status ${response.status}`);
      }
      const body = await response.json() as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      answer = body.choices?.[0]?.message?.content?.trim() ?? '';
      if (!answer) throw new Error('empty completion');

      // The audit trail the ruleset already reserves. No question, no answer —
      // only what is needed to reconcile spend and diagnose a bad month.
      await db.collection('aiRequests').add({
        userId: uid, model: MODEL.value(), createdAt: now.getTime(),
        promptTokens: body.usage?.prompt_tokens ?? null,
        completionTokens: body.usage?.completion_tokens ?? null,
      });
    } catch (error) {
      // Refund the reservation: a failed call must not consume the rider's quota.
      await usageRef.set({ count: FieldValue.increment(-1) }, { merge: true });
      logger.warn('Assistant call failed', { reason: error instanceof Error ? error.message : 'unknown' });
      throw new HttpsError('unavailable', 'The assistant could not answer just now. Try again in a moment.');
    }

    return { answer, used, quota: MONTHLY_QUOTA };
  },
);
