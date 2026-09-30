import {
  RESEND_COOLDOWN_SECONDS,
  cooldownRemaining,
  formatCooldown,
  resendLabel,
} from './resendCooldown';

describe('formatCooldown', () => {
  test("the board's own countdown", () => {
    expect(formatCooldown(42)).toBe('0:42');
  });

  test('seconds under ten keep the leading zero', () => {
    expect(formatCooldown(9)).toBe('0:09');
    expect(formatCooldown(0)).toBe('0:00');
  });

  test('a full minute rolls over', () => {
    expect(formatCooldown(60)).toBe('1:00');
    expect(formatCooldown(61)).toBe('1:01');
  });

  test('a part second still shows the second the rider is waiting out', () => {
    expect(formatCooldown(41.2)).toBe('0:42');
  });

  test('a negative remainder never prints a minus', () => {
    expect(formatCooldown(-3)).toBe('0:00');
  });
});

describe('resendLabel', () => {
  test('counts down while the cooldown runs', () => {
    expect(resendLabel(42)).toBe('Resend · 0:42');
  });

  test('drops the clock once it has elapsed', () => {
    expect(resendLabel(0)).toBe('Resend');
    expect(resendLabel(-1)).toBe('Resend');
  });
});

describe('cooldownRemaining', () => {
  const sent = 1_700_000_000_000;

  test('a link just sent has the whole cooldown to run', () => {
    expect(cooldownRemaining(sent, sent)).toBe(RESEND_COOLDOWN_SECONDS);
  });

  test('eighteen seconds in leaves the board figure', () => {
    expect(cooldownRemaining(sent, sent + 18_000)).toBe(42);
  });

  test('past the cooldown it is zero, not negative', () => {
    expect(cooldownRemaining(sent, sent + 120_000)).toBe(0);
  });

  test('a clock that jumped backwards restarts the wait rather than unlocking it', () => {
    expect(cooldownRemaining(sent, sent - 5_000)).toBe(RESEND_COOLDOWN_SECONDS);
  });
});
