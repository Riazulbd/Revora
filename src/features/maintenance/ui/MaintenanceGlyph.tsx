import React from 'react';

import { Icon, type IconName } from '@/components';

/**
 * The mark in the tinted square in front of a maintenance rule.
 *
 * The Figma boards draw one Lucide glyph per kind of job — a droplet for oil,
 * a link for the chain, a disc for brakes, wind for the air filter, a
 * thermometer for coolant, a bolt for the spark plug — and a crossed bell for
 * a rule whose reminders are off. Rules are named by the rider ("Chain clean,
 * lube & tension", "Front tyre"), so the match is on words, exactly as
 * `placeholdersFor()` matches placeholders. An unrecognised name gets the
 * wrench rather than a wrong mark; no figure anywhere depends on it.
 */

export type MaintenanceGlyphName = 'droplet' | 'link' | 'wind' | 'zap' | 'disc' | 'thermometer' | 'tyre' | 'bellOff' | 'wrench';

const MATCHES: readonly { match: RegExp; glyph: MaintenanceGlyphName }[] = [
  { match: /chain|sprocket/, glyph: 'link' },
  // "Air filter" must not be read as "engine oil filter": the filter rule wins
  // because it is tested first, which is the order a rider would read it in.
  { match: /air|filter/, glyph: 'wind' },
  { match: /spark|plug/, glyph: 'zap' },
  { match: /brake|pad|rotor|caliper/, glyph: 'disc' },
  { match: /coolant|radiator|thermo/, glyph: 'thermometer' },
  { match: /tyre|tire|wheel|tread/, glyph: 'tyre' },
  { match: /oil|lubric|fluid|grease|fork/, glyph: 'droplet' },
];

export function glyphForRule(ruleName: string): MaintenanceGlyphName {
  const needle = ruleName.trim().replace(/\s+/g, ' ').toLowerCase();
  return MATCHES.find((entry) => entry.match.test(needle))?.glyph ?? 'wrench';
}

/** True when the rule is about a fluid, which is bought by the litre. */
export function isFluidGlyph(name: MaintenanceGlyphName): boolean {
  return name === 'droplet' || name === 'thermometer';
}

export function MaintenanceGlyph({
  name,
  size = 20,
  color,
  strokeWidth,
}: {
  name: MaintenanceGlyphName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  const icon: IconName = name;
  return <Icon name={icon} size={size} color={color} {...(strokeWidth === undefined ? {} : { strokeWidth })} />;
}
