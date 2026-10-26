import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';

/** The 1px hairline between rows inside a card (`border-top:1px solid #EEF0F3`). */
export function Divider({ inset = 0 }: { inset?: number }) {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.div, marginLeft: inset }} />;
}
