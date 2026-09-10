import { addDoc, serverTimestamp } from '@react-native-firebase/firestore';

import { toAppError } from '@/services/errors';
import type { Feedback } from '@/types';
import { topCollection } from './base';

/**
 * Rider feedback at `feedback/{id}`.
 *
 * Write-once: the ruleset allows a rider to create their own and read it back,
 * and nothing else — not the app, not a modified copy of it, can edit or delete
 * a message after it is sent. A Cloud Function relays each one to Slack.
 */
export type FeedbackDraft = Pick<
  Feedback,
  'kind' | 'message' | 'contactEmail' | 'tier' | 'appVersion' | 'platform' | 'osVersion' | 'deviceModel'
>;

export const feedbackRepository = {
  async submit(uid: string, draft: FeedbackDraft): Promise<void> {
    try {
      await addDoc(topCollection('feedback'), {
        ...draft,
        message: draft.message.trim(),
        contactEmail: draft.contactEmail?.trim() || null,
        userId: uid,
        // The server clock decides when this arrived, not the handset's.
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        notifiedAt: null,
      });
    } catch (error) {
      throw toAppError(error);
    }
  },
};
