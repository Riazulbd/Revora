import { useCallback, useState } from 'react';

import type { BikeAnalytics } from '@/calculations/analytics';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';
import { callBackend } from '@/services/backend';
import type { UnitPreferences } from '@/types';
import { answerQuestion, type AssistantContext as LocalContext } from './answerQuestion';
import { buildAssistantContext } from './buildContext';

/**
 * Asks the Pro assistant, and falls back to the on-device one.
 *
 * The deterministic answerer is not a degraded mode — it is the floor. It works
 * offline, it costs nothing, and every figure it gives is read straight from the
 * calculations. The model is asked first only because it understands questions
 * the intent matcher does not; when it cannot be reached, or the month's quota
 * is spent, the local answer stands in and the rider still gets their number.
 */
export type AssistantReply = { text: string; source: 'assistant' | 'device'; notice?: string };

export function useAssistant() {
  const { user } = useAuth();
  const { isPro, units, activeBike } = useGarage();
  const [pending, setPending] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  const ask = useCallback(
    async (
      question: string,
      analytics: BikeAnalytics | null,
      local: LocalContext,
      documents: readonly { title: string; expiresOn: string | null; status: string }[],
    ): Promise<AssistantReply> => {
      const onDevice = (notice?: string): AssistantReply => ({
        text: answerQuestion(question, analytics, local).text,
        source: 'device',
        notice,
      });

      if (!isPro || !user || analytics === null || !activeBike) return onDevice();

      setPending(true);
      try {
        const context = buildAssistantContext(analytics, units as UnitPreferences, activeBike, documents);
        const result = await callBackend<{ answer: string; used: number; quota: number }>(
          'askAssistant',
          { question, context },
          user.uid,
        );
        setRemaining(Math.max(0, result.quota - result.used));
        return { text: result.answer, source: 'assistant' };
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        // Quota is worth naming; everything else falls back quietly.
        if (message.includes('questions this month')) {
          setRemaining(0);
          return onDevice(message);
        }
        return onDevice();
      } finally {
        setPending(false);
      }
    },
    [isPro, user, units, activeBike],
  );

  return { ask, pending, remaining };
}
