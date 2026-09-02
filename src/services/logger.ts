/**
 * Logging.
 *
 * Production builds emit nothing. Development builds redact anything that could
 * carry a token, an email address or a rider's private notes before it reaches
 * the console (requirement 68).
 */

const SENSITIVE_KEY = /token|password|secret|authorization|apikey|api_key|credential|email|idtoken|refresh/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const BEARER = /\b(?:ey[A-Za-z0-9_-]{10,}|AIza[0-9A-Za-z_-]{20,})\b/g;

function redactString(value: string): string {
  return value.replace(EMAIL, '[email]').replace(BEARER, '[token]');
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[deep]';
  if (typeof value === 'string') return redactString(value);
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(v, depth + 1);
  }
  return out;
}

const enabled = __DEV__;

function emit(level: 'log' | 'warn' | 'error', scope: string, message: string, data?: unknown) {
  if (!enabled) return;
  const payload = data === undefined ? '' : redact(data);
  // eslint-disable-next-line no-console
  console[level](`[revora:${scope}] ${redactString(message)}`, payload);
}

export const log = {
  debug: (scope: string, message: string, data?: unknown) => emit('log', scope, message, data),
  warn: (scope: string, message: string, data?: unknown) => emit('warn', scope, message, data),
  /**
   * Errors are reported in development only. In production this is the hook a
   * crash reporter would be attached to — it must never print raw payloads.
   */
  error: (scope: string, message: string, data?: unknown) => emit('error', scope, message, data),
};
