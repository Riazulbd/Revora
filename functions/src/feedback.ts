import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

/**
 * Relays rider feedback to Slack.
 *
 * The webhook is a secret, not a config string: anyone holding it can post into
 * the channel as Revora. It lives in Secret Manager and is read at runtime, so
 * it never appears in source, in `firebase functions:config`, or in a build
 * artefact.
 *
 * **Why the binding is conditional.** The Firebase CLI resolves every secret
 * referenced anywhere in the codebase during deploy analysis — including for
 * functions that `--only` excludes — and fails the whole deploy if one does not
 * exist in Secret Manager yet. A bare `defineSecret` here therefore made *every*
 * deploy hostage to a Slack account nobody had set up, which is why this export
 * sat commented out in `index.ts`.
 *
 * So the secret is bound only when the operator says it exists, by setting
 * `REVORA_SLACK_SECRET=1` in the deploy shell. Without it the function still
 * deploys, still runs, and simply finds no webhook and no-ops — the Firestore
 * document at `feedback/{id}` is the permanent record and is written either way.
 * See docs/slack.md.
 */
const WEBHOOK_ENV = 'SLACK_FEEDBACK_WEBHOOK_URL';

const secrets = process.env.REVORA_SLACK_SECRET === '1' ? [WEBHOOK_ENV] : [];

/**
 * The webhook, at call time.
 *
 * A bound secret arrives as an ordinary environment variable, so reading it here
 * rather than through a param means an unset one is `undefined` instead of a
 * deploy-time failure.
 *
 * The host is checked as well as the presence: a webhook misconfigured to some
 * other address would quietly ship rider messages, their email and their uid to
 * a third party. Better to relay nothing.
 */
function webhookUrl(): string | null {
  // Spelled out rather than indexed by `WEBHOOK_ENV`: a dynamic `process.env`
  // lookup is invisible to tooling that inlines or audits environment reads.
  const url = process.env.SLACK_FEEDBACK_WEBHOOK_URL;
  if (typeof url !== 'string' || !url.startsWith('https://hooks.slack.com/')) return null;
  return url;
}

const EMOJI: Record<string, string> = { idea: '💡', problem: '🐞', question: '❓' };

/** Slack renders this; escaping keeps a message from forging its own blocks. */
const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const relayFeedbackToSlack = onDocumentCreated(
  { document: 'feedback/{feedbackId}', region: 'us-central1', secrets, retry: false },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const data = snapshot.data();
    const url = webhookUrl();
    if (!url) {
      // Not an error: Slack is the notification, Firestore is the record.
      // `notifiedAt` stays null, so unrelayed messages are easy to find later.
      logger.info('No Slack webhook bound; feedback stored only');
      return;
    }

    const kind = String(data.kind ?? 'idea');
    const tier = String(data.tier ?? 'free');
    const contact = typeof data.contactEmail === 'string' && data.contactEmail ? data.contactEmail : null;

    const payload = {
      // `text` is the notification preview; blocks are the rendered message.
      text: `${EMOJI[kind] ?? '💬'} ${kind} from a ${tier} rider`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `${EMOJI[kind] ?? '💬'} ${kind.toUpperCase()} · ${tier.toUpperCase()}` },
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: escape(String(data.message ?? '')).slice(0, 2900) },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: [
                contact ? `✉️ ${escape(contact)}` : '✉️ _no reply address_',
                `📱 ${escape(String(data.deviceModel ?? 'unknown'))} · ${escape(String(data.platform ?? '?'))} ${escape(String(data.osVersion ?? '?'))}`,
                `🏷️ v${escape(String(data.appVersion ?? '?'))}`,
                `🆔 \`${escape(String(data.userId ?? '?'))}\``,
                `📄 \`${event.params.feedbackId}\``,
              ].join('  |  '),
            },
          ],
        },
      ],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      // Never log the body: a Slack error can echo back the webhook URL.
      logger.error('Slack relay failed', { status: response.status });
      throw new Error(`Slack responded ${response.status}`);
    }

    // Marks it delivered. The rider cannot write this field; rules refuse it.
    await getFirestore().doc(`feedback/${event.params.feedbackId}`).update({ notifiedAt: Date.now() });
  },
);
