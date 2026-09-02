import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { Txt } from './Text';

/**
 * The toast from the design: an `--ink` pill on `--bg` text, 96px above the
 * bottom edge, gone after 2.4 s.
 *
 * It is the app's single confirmation channel — "Fuel log saved · mileage
 * updated" and friends all come through here.
 */

type ToastContextValue = {
  show: (message: string, tone?: 'default' | 'error') => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 2400;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; tone: 'default' | 'error' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: 'default' | 'error' = 'default') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, tone });
    timer.current = setTimeout(() => setToast(null), DURATION_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 96 + insets.bottom,
            alignItems: 'center',
          }}
        >
          <Animated.View
            entering={FadeInDown.duration(180)}
            exiting={FadeOutDown.duration(180)}
            accessibilityLiveRegion="polite"
            accessible
            accessibilityLabel={toast.message}
            style={{
              backgroundColor: toast.tone === 'error' ? c.bad : c.ink,
              borderRadius: radius.pill - 2,
              paddingHorizontal: 18,
              paddingVertical: 11,
              maxWidth: '100%',
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 26,
              shadowOffset: { width: 0, height: 10 },
              elevation: 12,
            }}
          >
            <Txt role="toast" color={toast.tone === 'error' ? '#FFFFFF' : c.bg} numberOfLines={3}>
              {toast.message}
            </Txt>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
