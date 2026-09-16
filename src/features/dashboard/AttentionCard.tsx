import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Card, Divider, Eyebrow, Icon, Txt } from '@/components';
import type { AttentionItem } from '@/calculations/attention';
import { useTheme } from '@/theme';

/**
 * What is wrong with the motorcycle, at the top of the Dashboard.
 *
 * This card is what pays for cutting the fifth tab. The screens behind these
 * rows — the safety log, the document vault, an overdue rule — are three and
 * four taps deep now, and that is only acceptable because the rider never has
 * to go looking: anything wrong comes here first.
 *
 * Which means the card has one job above being pretty. It must be trustworthy
 * enough that an empty card is believed. A row that lingers after the rider
 * fixed it, or a severity that overstates, and they stop reading it — after
 * which the depth of those screens is a straightforward regression.
 */
export function AttentionCard({ items }: { items: readonly AttentionItem[] }) {
  const router = useRouter();
  const { c, radius } = useTheme();

  if (items.length === 0) return null;

  return (
    <Card style={{ paddingVertical: 14 }}>
      <Eyebrow>NEEDS ATTENTION</Eyebrow>
      <View style={{ marginTop: 10 }}>
        {items.map((item, index) => {
          const tone = item.severity === 'critical' ? c.bad : c.warn;
          const soft = item.severity === 'critical' ? c.badS : c.warnS;

          return (
            <View key={item.id}>
              {index > 0 ? <Divider /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.detail}`}
                onPress={() =>
                  router.push(
                    item.params === undefined
                      ? item.route
                      : ({ pathname: item.route, params: item.params } as never),
                  )
                }
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 12,
                  opacity: pressed ? 0.7 : 1,
                })}
                testID={`attention-${item.id}`}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: radius.tile,
                    backgroundColor: soft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon
                    name={item.kind === 'document' ? 'document' : 'alert'}
                    size={16}
                    color={tone}
                    strokeWidth={2}
                  />
                </View>

                <View style={{ flex: 1, gap: 2 }}>
                  <Txt role="rowTitleDense" numberOfLines={2}>
                    {item.title}
                  </Txt>
                  <Txt role="metaSmall" tone="mut" numberOfLines={2}>
                    {item.detail}
                  </Txt>
                </View>

                {item.action ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.action.label}: ${item.title}`}
                    hitSlop={6}
                    onPress={() =>
                      router.push({
                        pathname: '/maintenance/rule',
                        params: { id: item.action?.ruleId ?? '', complete: '1' },
                      } as never)
                    }
                    style={({ pressed }) => ({
                      minHeight: 34,
                      justifyContent: 'center',
                      paddingHorizontal: 12,
                      borderRadius: radius.input,
                      borderWidth: 1,
                      borderColor: c.brd,
                      backgroundColor: pressed ? c.sur2 : 'transparent',
                    })}
                    testID={`attention-action-${item.id}`}
                  >
                    <Txt role="micro" tone="acc" numberOfLines={1}>
                      {item.action.label}
                    </Txt>
                  </Pressable>
                ) : (
                  <Icon name="chevronRight" size={15} color={c.mut} strokeWidth={2} />
                )}
              </Pressable>
            </View>
          );
        })}
      </View>
    </Card>
  );
}
