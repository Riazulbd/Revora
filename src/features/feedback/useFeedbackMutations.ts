import { useAuth } from '@/features/auth/AuthProvider';
import { useRecordMutation } from '@/features/shared/useRecordMutation';
import { AppError } from '@/services/errors';
import { feedbackRepository, type FeedbackDraft } from '@/repositories';

/**
 * Sends one message.
 *
 * Deliberately not routed through `requireGarage`: a rider who cannot add a
 * motorcycle is precisely the one who needs to tell us so. All this needs is a
 * signed-in account.
 *
 * There is no edit or delete path by design — the ruleset refuses both, so a
 * message stays exactly what the rider wrote when they wrote it.
 */
export function useSubmitFeedback(options: { onSent?: () => void } = {}) {
  const { user } = useAuth();

  return useRecordMutation<FeedbackDraft>({
    mutationFn: async (draft) => {
      if (!user) throw new AppError('validation', 'Sign in to send feedback.');
      await feedbackRepository.submit(user.uid, draft);
    },
    successMessage: 'Message sent — thank you',
    onSuccess: () => options.onSent?.(),
  });
}
