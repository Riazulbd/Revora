import React from 'react';
import { Image, type ImageStyle } from 'react-native';

import { useTheme } from '@/theme';

const LIGHT = require('../../assets/logo.png');
const DARK = require('../../assets/logo-dark.png');

/**
 * The approved Revora lockup.
 *
 * Two files, one design: the dark variant lifts only the neutral wordmark ink to
 * the dark theme's `--ink`. Geometry, proportion, the orange mark and the tagline
 * are byte-identical to the approved artwork — without it the wordmark sits at
 * roughly 1.05:1 against `--bg` in dark mode and simply disappears.
 */
export function Logo({ width = 230, style }: { width?: number; style?: ImageStyle }) {
  const { dark } = useTheme();
  // The source lockup is 1536 x 1024 with content spanning 1274 x 596.
  const height = Math.round((width * 1024) / 1536);

  return (
    <Image
      source={dark ? DARK : LIGHT}
      accessibilityLabel="Revora — know your bike"
      resizeMode="contain"
      style={[{ width, height }, style]}
    />
  );
}
