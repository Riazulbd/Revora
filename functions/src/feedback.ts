import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

/**
 * Relays rider feedback to Slack.
 *
 * The webhook is a secret, not a config string: anyone holding it can post into
 * the channel as Revora. It is read at runtime from Secret Manager, so it never
 * appears in source, in `firebase functions:config`, or in a build artefact.
 */
export const slackWebhook = defineSecret('SLACK_FEEDBACK_WEBHOOK_URL');

const EMOJI: Record<string, string> = { idea: '💡', problem: '🐞', question: '❓' };

/** Slack renders this; escaping keeps a message from forging its own blocks. */
const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const relayFeedbackToSlack = onDocumentCreated(
  { document: 'feedback/{feedbackId}', region: 'us-central1', secrets: [slackWebhook], retry: false },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const data = snapshot.data();
    const url = slackWebhook.value();
    if (!url) { logger.warn('No Slack webhook configured; feedback stored only'); return; }

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
