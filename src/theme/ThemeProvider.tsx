import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { darkColors, lightColors, radius, spacing, type ThemeColors } from './tokens';
import { textStyle, type TypeRole } from './typography';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'revora.theme-preference';

export type Theme = {
  /** Colour tokens for the resolved scheme. */
  c: ThemeColors;
  /** True when the dark palette is active. */
  dark: boolean;
  /** What the user chose (may be `system`). */
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  radius: typeof radius;
  spacing: typeof spacing;
  /** Convenience: `t.text('body', t.c.mut)`. */
  text: (role: TypeRole, color?: string) => ReturnType<typeof textStyle>;
};

const ThemeContext = createContext<Theme | null>(null);

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && isPreference(stored)) setPreferenceState(stored);
      })
      .catch(() => {
        // A missing preference is not an error — the system default stands.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    void AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {
      // Preference is cosmetic; failing to persist it must never break the app.
    });
  }, []);

  const dark = preference === 'system' ? system === 'dark' : preference === 'dark';

  const value = useMemo<Theme>(() => {
    const c = dark ? darkColors : lightColors;
    return {
      c,
      dark,
      preference,
      setPreference,
      radius,
      spacing,
      text: textStyle,
    };
  }, [dark, preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Pins a subtree to the dark palette.
 *
 * The Revora lockup is artwork on a black field, and its wordmark is near-black
 * by design, so it only reads on a dark ground — which is exactly how the
 * approved design shows the welcome screen. Rather than knock the background
 * out of the artwork (which destroys the wordmark), the entry screens are dark
 * whatever the system or the rider's preference says.
 */
export function ForceDarkTheme({ children }: { children: React.ReactNode }) {
  const parent = useTheme();
  const value = useMemo<Theme>(() => ({ ...parent, c: darkColors, dark: true }), [parent]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
