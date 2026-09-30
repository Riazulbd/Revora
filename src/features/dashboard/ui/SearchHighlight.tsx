import React from 'react';

import { Txt } from '@/components';
import { useTheme } from '@/theme';

/**
 * The matched word, tinted the way the board draws it (`background:var(--accS)`).
 *
 * Only a literal, case-insensitive hit is marked. Search itself is far more
 * forgiving than that — it ignores hyphens and case, so "10w40" finds "10W-40" —
 * and a highlighter that tried to reproduce that forgiveness would end up
 * underlining the wrong half of a part number. When it cannot mark the word
 * honestly it marks nothing, and the row still reads.
 */
export function Highlighted({
  text,
  query,
  role = 'rowTitle',
  tone = 'ink',
  numberOfLines,
}: {
  text: string;
  query: string;
  role?: 'rowTitle' | 'meta';
  tone?: 'ink' | 'mut';
  numberOfLines?: number;
}) {
  const { c } = useTheme();
  const needle = query.trim();
  const at = needle === '' ? -1 : text.toLowerCase().indexOf(needle.toLowerCase());

  if (at < 0) {
    return (
      <Txt role={role} tone={tone} {...(numberOfLines === undefined ? {} : { numberOfLines })}>
        {text}
      </Txt>
    );
  }

  return (
    <Txt role={role} tone={tone} {...(numberOfLines === undefined ? {} : { numberOfLines })}>
      {text.slice(0, at)}
      <Txt role={role} tone={tone} style={{ backgroundColor: c.accS }}>
        {text.slice(at, at + needle.length)}
      </Txt>
      {text.slice(at + needle.length)}
    </Txt>
  );
}
