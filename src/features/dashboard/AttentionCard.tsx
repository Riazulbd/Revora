import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';

import { Button, Card, Divider, Eyebrow, Icon, RowIcon, Txt, type IconName } from '@/components';
import type { AttentionItem } from '@/calculations/attention';
import { fontFamily, useTheme } from '@/theme';

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
 *
 * Silence is the answer riders act on, so the boards draw three different ways
 * of being silent and this renders all three. "Nothing is wrong" is a finding
 * (the green board); "nothing to watch yet" is a new garage, not a clean bill
 * of health; "I could not check" is neither, and painting a green tick the app
 * cannot stand behind is the one failure that would make this card worse than
 * no card at all.
 */

const ROW_ICON: Record<AttentionItem['kind'], IconName> = {
  safety: 'target',
  maintenance: 'drop',
  document: 'documents',
};

export function AttentionCard({
  items,
  isPending = false,
  hasError = false,
  hasRecords = true,
}: {
  items: readonly AttentionItem[];
  isPending?: boolean;
  hasError?: boolean;
  /** False on a brand-new garage: nothing is wrong, but nothing is watched yet. */
  hasRecords?: boolean;
}) {
  const router = useRouter();
  const { c, radius } = useTheme();

  if (hasError) {
    return (
      <View
        testID="attention-error"
        style={{
          borderRadius: radius.listCard,
          backgroundColor: c.warnS,
          paddingVertical: 13,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
        }}
      >
        <Icon name="alertTriangle" size={18} color={c.warn} strokeWidth={1.8} />
        <Txt role="meta" style={{ flex: 1, lineHeight: 18 }}>
          <Txt role="meta" tone="warn" style={{ fontFamily: fontFamily[700] }}>
            Can&rsquo;t check what needs attention
          </Txt>{' '}
          until your records load — not showing a green tick it can&rsquo;t stand behind.
        </Txt>
      </View>
    );
  }

  if (isPending && items.length === 0) return null;

  if (items.length === 0 && !hasRecords) {
    return (
      <View
        testID="attention-unwatched"
        style={{
          borderRadius: radius.listCard,
          backgroundColor: c.sur2,
          paddingVertical: 13,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
        }}
      >
        <Icon name="bell" size={18} color={c.mut} strokeWidth={1.8} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt role="rowTitleDense">Nothing to watch yet</Txt>
          <Txt role="metaSmall" tone="mut">
            Expiring documents and due rules will appear here once you add them.
          </Txt>
        </View>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View
        testID="attention-clear"
        style={{
          borderRadius: radius.listCard,
          backgroundColor: c.goodS,
          paddingVertical: 13,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
        }}
      >
        {/* The boards draw this one as a filled disc rather than a line glyph:
            it is the only mark on the Dashboard that reports good news. */}
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={10} fill={c.good} />
          <Path
            d="m7.5 12.5 3 3 6-6.5"
            stroke="#FFFFFF"
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt role="rowTitleDense">Nothing needs your attention</Txt>
          <Txt role="metaSmall" tone="mut">
            No documents expiring, no rules due. Go ride.
          </Txt>
        </View>
      </View>
    );
  }

  return (
    <Card style={{ paddingTop: 16, paddingBottom: 6, paddingHorizontal: 16 }} testID="card-attention">
      <Eyebrow tone="bad">NEEDS ATTENTION</Eyebrow>
      <View style={{ marginTop: 4 }}>
        {items.map((item, index) => {
          const tone = item.severity === 'critical' ? 'bad' : 'warn';
          const ink = item.severity === 'critical' ? c.bad : c.warn;

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
                  gap: 11,
                  paddingVertical: 11,
                  opacity: pressed ? 0.7 : 1,
                })}
                testID={`attention-${item.id}`}
              >
                <RowIcon size={32} tone={tone}>
                  <Icon name={ROW_ICON[item.kind]} size={15} color={ink} strokeWidth={1.8} />
                </RowIcon>

                <View style={{ flex: 1, gap: 2 }}>
                  <Txt role="rowTitleDense" numberOfLines={2}>
                    {item.title}
                  </Txt>
                  {/* The evidence carries the severity in colour, and the words
                      carry it too — "310 km past" reads as a problem in grey. */}
                  <Txt
                    role="metaSmall"
                    tone={item.kind === 'document' && item.severity === 'warning' ? 'mut' : tone}
                    numberOfLines={2}
                  >
                    {item.detail}
                  </Txt>
                </View>

                {item.action ? (
                  <Button
                    label={item.action.label}
                    variant="tinted"
                    size="micro"
                    onPress={() =>
                      router.push({
                        pathname: '/maintenance/rule',
                        params: { id: item.action?.ruleId ?? '', complete: '1' },
                      } as never)
                    }
                    accessibilityHint={item.title}
                    testID={`attention-action-${item.id}`}
                  />
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
