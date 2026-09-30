import React from 'react';
import { Pressable, View } from 'react-native';

import { Banner, ProBadge, Txt } from '@/components';
import { useTheme } from '@/theme';

/**
 * The three notices the "Quota out & offline" board draws.
 *
 * Each one is a bordered `--sur` card on the 11px radius with an 18px amber
 * glyph and a bold amber opening sentence — the tone is never the only signal,
 * the sentence itself says what happened.
 */

/** "This month's 100 questions are used." */
export function QuotaExhaustedNotice({ quota, resetLabel }: { quota: number; resetLabel: string }) {
  return (
    <Banner
      tone="warn"
      icon="clock"
      compact
      lead={`This month’s ${quota} questions are used.`}
      message={`The quota resets on ${resetLabel}. A failed question is refunded automatically.`}
      testID="banner-assistant-quota"
    />
  );
}

/** "You're offline." The earlier answers stay on screen; nothing is cleared. */
export function AssistantOfflineNotice() {
  return (
    <Banner
      tone="warn"
      icon="wifiOff"
      compact
      lead="You’re offline."
      message="The Assistant needs a connection — your earlier answers stay readable below."
      testID="banner-assistant-offline"
    />
  );
}

/**
 * The Free note: a PRO pill where the other two notices put a glyph.
 *
 * `Banner` has no badge slot, so this one is drawn here rather than bent into a
 * shape it was not designed for.
 */
export function AssistantFreeNotice({ onPress, testID }: { onPress: () => void; testID: string }) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Revora Pro. On Free, this screen makes the case and routes to Your plan — it never fakes an answer."
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        backgroundColor: c.sur,
        borderWidth: 1,
        borderColor: c.brd,
        borderRadius: 11,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        minHeight: 44,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <ProBadge style={{ alignSelf: 'flex-start' }} />
      <View style={{ flex: 1 }}>
        <Txt role="bodySmall" style={{ lineHeight: 18.75 }}>
          On Free, this screen makes the case and routes to Your plan — it never fakes an answer.
        </Txt>
      </View>
    </Pressable>
  );
}
