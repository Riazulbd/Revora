import React from 'react';
import { View } from 'react-native';

import { Card, Eyebrow, Icon, Txt } from '@/components';
import { fontFamily, useTheme } from '@/theme';
import type { IsoDate } from '@/types';
import { formatLongDate } from '@/utils/date';

/**
 * The chrome the two legal boards share (Figma `E6 Legal — Privacy`,
 * `E7 Legal — Terms`).
 *
 * Both open on a two-line `700 24px` title — a sentence, not a document name —
 * with a "Last updated" chip under it, then a white summary card whose accent
 * eyebrow says out loud that it is a summary, then the sections in `700 16px`
 * over `400 14px` prose.
 */

export function AccountDocTitle({ title, updatedOn }: { title: string; updatedOn: IsoDate }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 12, paddingHorizontal: 4 }}>
      <Txt role="greeting">{title}</Txt>
      <View
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingLeft: 10,
          paddingRight: 12,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: c.sur,
          borderWidth: 1,
          borderColor: c.brd,
        }}
      >
        <Icon name="clock" size={16} color={c.mut} />
        <Txt role="smallStrong" tone="mut">{`Last updated ${formatLongDate(updatedOn)}`}</Txt>
      </View>
    </View>
  );
}

/** Figma `Summary card`: the accent eyebrow and a `500 14px` ink paragraph 8px under it. */
export function AccountDocSummary({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const { c } = useTheme();
  return (
    <Card style={{ gap: 8 }} testID={testID}>
      <Eyebrow tone="acc">In short — a summary, not the contract</Eyebrow>
      <Txt style={{ fontFamily: fontFamily[500], fontSize: 14, lineHeight: 21, color: c.ink }}>{children}</Txt>
    </Card>
  );
}

/** Figma `Section`: `700 16px` heading, `400 14px` prose 6px under it, `padding:0 4px`. */
export function AccountDocSection({ title, body }: { title: string; body: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6, paddingHorizontal: 4 }}>
      <Txt role="cardTitle" style={{ fontFamily: fontFamily[700] }}>
        {title}
      </Txt>
      <Txt role="body" color={c.prose}>
        {body}
      </Txt>
    </View>
  );
}

/** The 20px rhythm between sections, 4px under whatever precedes them. */
export function AccountDocSections({ children }: { children: React.ReactNode }) {
  return <View style={{ gap: 20, paddingTop: 4 }}>{children}</View>;
}
