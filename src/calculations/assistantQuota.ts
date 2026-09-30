import type { IsoDate } from '@/types';

/**
 * The Pro assistant's monthly allowance.
 *
 * It mirrors `MONTHLY_QUOTA` in `functions/src/assistant.ts`, which is the
 * authority — the backend refuses the 101st question whatever the client
 * believes. This copy exists only so the screen can say "100 questions a month"
 * before the first answer has come back with a real count.
 */
export const ASSISTANT_MONTHLY_QUOTA = 100;

/**
 * The calendar date the quota rolls over: the first of the following month.
 *
 * A calendar date, not an instant — the Assistant board prints "The quota
 * resets on 1 Oct", and a `Date` built from a UTC timestamp would say
 * "30 Sep" for a rider in Dhaka for six hours of every month.
 */
export function nextQuotaResetIso(today: IsoDate): IsoDate {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01` as IsoDate;
}

/**
 * Questions left, or null when nothing has been asked yet this session and the
 * server has not said. Null renders as the allowance itself, never as zero.
 */
export function questionsRemaining(
  used: number | null,
  quota: number = ASSISTANT_MONTHLY_QUOTA,
): number | null {
  if (used === null || !Number.isFinite(used)) return null;
  return Math.max(0, quota - Math.max(0, Math.trunc(used)));
}
