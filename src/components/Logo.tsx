import React from 'react';
import { Image, type ImageStyle } from 'react-native';

const LOCKUP = require('../../assets/logo.png');

/**
 * The approved Revora lockup.
 *
 * One file, because there is only one piece of artwork: it is drawn on a black
 * field with a near-black wordmark. A "dark variant" produced by knocking that
 * background out erases the wordmark and clips the underlines, so wherever this
 * appears the surrounding screen is pinned dark instead — see `ForceDarkTheme`.
 */
export function Logo({ width = 230, style }: { width?: number; style?: ImageStyle }) {
  // The source lockup is 1536 x 1024; `contain` keeps the whole field visible.
  const height = Math.round((width * 1024) / 1536);

  return (
    <Image
      source={LOCKUP}
      accessibilityLabel="Revora — know your bike"
      resizeMode="contain"
      style={[{ width, height }, style]}
    />
  );
}
