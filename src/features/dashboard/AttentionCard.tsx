import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';

import { Button, Card, CardHeader, Divider, Icon, RowIcon, Txt, type IconName } from '@/components';
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
  safety: 'disc',
  maintenance: 'droplet',
  document: 'fileText',
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
          borderRadius: radius.card,
          backgroundColor: c.warnS,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Icon name="triangleAlert" size={20} color={c.warnIcon} />
        <Txt role="meta" style={{ flex: 1, lineHeight: 18 }}>
          <Txt role="meta" tone="warn" style={{ fontFamily: fontFamily[600] }}>
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
          borderRadius: radius.card,
          backgroundColor: c.sur2,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Icon name="bell" size={20} color={c.mut} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt role="rowTitle">Nothing to watch yet</Txt>
          <Txt role="meta" tone="mut">
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
          borderRadius: radius.card,
          backgroundColor: c.goodS,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {/* A filled disc rather than a line glyph: it is the only mark on the
            Dashboard that reports good news. */}
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
          <Txt role="rowTitle">Nothing needs your attention</Txt>
          <Txt role="meta" tone="mut">
            No documents expiring, no rules due. Go ride.
          </Txt>
        </View>
      </View>
    );
  }

  return (
    <Card style={{ gap: 4 }} testID="card-attention">
      {/* Figma `Needs attention`: the heading with a red count pill, then rows
          of a 40px tone tile, title, evidence, and either the one action that
          clears the row ("Mark done", a black pill) or a chevron. */}
      <CardHeader title="Needs attention" count={items.length} tone="bad" />
      <View>
        {items.map((item, index) => {
          const tone = item.severity === 'critical' ? 'bad' : 'warn';

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
                  paddingVertical: 10,
                  minHeight: 48,
                  opacity: pressed ? 0.7 : 1,
                })}
                testID={`attention-${item.id}`}
              >
                <RowIcon icon={ROW_ICON[item.kind]} tone={tone} />

                <View style={{ flex: 1, gap: 2 }}>
                  <Txt role="rowTitle" numberOfLines={2}>
                    {item.title}
                  </Txt>
                  {/* The evidence carries the severity in colour, and the words
                      carry it too — "310 km past" reads as a problem in grey. */}
                  <Txt
                    role="meta"
                    tone={item.kind === 'document' && item.severity === 'warning' ? 'mut' : tone}
                    numberOfLines={2}
                  >
                    {item.detail}
                  </Txt>
                </View>

                {item.action ? (
                  <Button
                    label={item.action.label}
                    variant="ink"
                    size="chip"
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
                  <Icon name="chevronRight" size={20} color={c.faint} />
                )}
              </Pressable>
            </View>
          );
        })}
      </View>
    </Card>
  );
}
