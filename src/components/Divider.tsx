import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';

/** `<div style="height:1px;background:var(--brd)">` from the design. */
export function Divider({ inset = 0 }: { inset?: number }) {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.brd, marginLeft: inset }} />;
}
