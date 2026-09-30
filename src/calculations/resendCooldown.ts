/**
 * The Reset password board's "Resend · 0:42" button.
 *
 * A reset link takes a minute or two to arrive, and a rider who taps Resend
 * four times in ten seconds gets four links and Firebase's rate limiter. The
 * board answers that with a cooldown printed on the button itself, so the wait
 * is visible rather than a tap that silently does nothing.
 */

/** How long the button stays inert after a link is sent. */
export const RESEND_COOLDOWN_SECONDS = 60;

/** `m:ss`, the board's tabular countdown. Never negative. */
export function formatCooldown(secondsLeft: number): string {
  const clamped = Math.max(0, Math.ceil(secondsLeft));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * The button's label: the countdown while the cooldown runs, the plain word
 * once it has elapsed.
 */
export function resendLabel(secondsLeft: number): string {
  return secondsLeft > 0 ? `Resend · ${formatCooldown(secondsLeft)}` : 'Resend';
}

/** Seconds still to wait, given when the link went out and the time now. */
export function cooldownRemaining(sentAtMs: number, nowMs: number): number {
  const elapsed = (nowMs - sentAtMs) / 1000;
  if (!Number.isFinite(elapsed) || elapsed < 0) return RESEND_COOLDOWN_SECONDS;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed));
}
