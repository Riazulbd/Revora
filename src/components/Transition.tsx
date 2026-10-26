import React, { createContext, useContext, useMemo, useState } from 'react';

/**
 * Whether a navigator is mid-transition right now.
 *
 * On Android a screen that is sliding or fading is redrawn from scratch every
 * frame — every icon path, every rounded clip, every gradient — and on a
 * 1080×2392 panel that alone costs more than a frame budget, which is the
 * stutter a rider sees when they open a screen. While a transition runs,
 * `Screen` renders itself into one hardware texture instead, so each frame is
 * a single textured quad. The flag is cleared when the transition ends, so
 * scrolling (which must redraw) never pays for the texture.
 *
 * Nested navigators combine: a tab switch and a stack push each count.
 */
const TransitioningContext = createContext(false);

export function useTransitioning(): boolean {
  return useContext(TransitioningContext);
}

export function TransitioningProvider({ active, children }: { active: boolean; children: React.ReactNode }) {
  const parent = useContext(TransitioningContext);
  return <TransitioningContext.Provider value={parent || active}>{children}</TransitioningContext.Provider>;
}

/**
 * The listeners a navigator needs to report its transitions, and the flag they
 * drive. Hand `listeners` to `screenListeners` and `active` to the provider.
 */
export function useTransitionListeners() {
  const [active, setActive] = useState(false);
  const listeners = useMemo(
    () => ({
      transitionStart: () => setActive(true),
      transitionEnd: () => setActive(false),
    }),
    [],
  );
  return { active, listeners };
}
