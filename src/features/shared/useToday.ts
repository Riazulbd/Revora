import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { IsoDate } from '@/types';
import { todayIso } from '@/utils/date';

/**
 * Today's calendar date, kept honest across a day boundary.
 *
 * Maintenance countdowns and document expiries are measured in days from today.
 * A phone left on the dashboard overnight, or an app resumed the next morning,
 * would otherwise keep counting from yesterday. This re-reads the date whenever
 * the app comes back to the foreground, and once at local midnight while it is
 * open (requirement 51 / 64).
 */
export function useToday(): IsoDate {
  const [today, setToday] = useState<IsoDate>(() => todayIso());

  useEffect(() => {
    const sync = () => {
      const next = todayIso();
      setToday((current) => (current === next ? current : next));
    };

    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') sync();
    });

    // Fire once at the next local midnight, then hand over to the daily interval.
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5, 0);
    let daily: ReturnType<typeof setInterval> | null = null;
    const toMidnight = setTimeout(() => {
      sync();
      daily = setInterval(sync, 24 * 60 * 60 * 1000);
    }, Math.max(1000, midnight.getTime() - now.getTime()));

    return () => {
      subscription.remove();
      clearTimeout(toMidnight);
      if (daily !== null) clearInterval(daily);
    };
  }, []);

  return today;
}
