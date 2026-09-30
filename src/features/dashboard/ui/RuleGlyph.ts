import type { IconName } from '@/components';

/**
 * The glyph in front of a maintenance rule on the Dashboard.
 *
 * The board draws the oil rule as a droplet and the chain rule as the sun-like
 * mark, because a rider skimming two rows reads the picture before the words.
 * Purely presentational: nothing here changes a figure, and a rule whose name
 * matches nothing falls back to the wrench rather than guessing.
 */
const RULE_GLYPHS: readonly { match: RegExp; icon: IconName }[] = [
  { match: /chain|sprocket|belt/i, icon: 'sparkle' },
  { match: /oil|lube|lubric/i, icon: 'drop' },
  { match: /brake|pad|disc/i, icon: 'target' },
  { match: /tyre|tire|wheel|pressure/i, icon: 'circle' },
  { match: /battery|spark|plug|electric/i, icon: 'sparkle' },
  { match: /filter|air|coolant|valve/i, icon: 'settings' },
  { match: /insurance|tax|registration|fitness|document/i, icon: 'documents' },
];

export function ruleGlyph(name: string): IconName {
  return RULE_GLYPHS.find((entry) => entry.match.test(name))?.icon ?? 'wrench';
}
