import React from 'react';

import { Badge, type BadgeTone } from '@/components';

/** The count chip and status badge share one shape across every screen. */
export function StatusTone({
  label,
  tone,
  small = false,
}: {
  label: string;
  tone: BadgeTone;
  small?: boolean;
}) {
  return <Badge label={label} tone={tone} size={small ? 'default' : 'chip'} />;
}
