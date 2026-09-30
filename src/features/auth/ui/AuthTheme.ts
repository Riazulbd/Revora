import { lightColors, radius, spacing, textStyle, useTheme, type Theme } from '@/theme';

/**
 * The theme, for the entry screens.
 *
 * Identical to `useTheme()` inside the app. The difference is what happens
 * outside one: `useTheme` throws without a `ThemeProvider`, and the entry
 * screens are the ones mounted bare — by the QA harness
 * (`src/calculations/__audit__/account-linking.audit.test.tsx`, which replaces
 * `@/components` wholesale to watch the linking branch) and by anything else
 * that renders a route in isolation. A crash there would say nothing about the
 * screen; falling back to the light palette keeps the shape visible and the
 * branch under test observable.
 *
 * Nothing in the running app ever sees the fallback — `RootLayout` wraps
 * everything in `ThemeProvider` before a route mounts.
 */
const OUTSIDE_PROVIDER: Theme = {
  c: lightColors,
  dark: false,
  preference: 'light',
  setPreference: () => undefined,
  radius,
  spacing,
  text: textStyle,
};

export function useAuthTheme(): Theme {
  try {
    return useTheme();
  } catch {
    return OUTSIDE_PROVIDER;
  }
}
