import type { IconName } from '@/components';

/**
 * The glyph a part or an accessory row opens on.
 *
 * The Figma boards draw a different mark per item — a link for the chain kit,
 * the brake disc for the pads, a ringed dot for a tyre, wind for the air
 * filter, a box for the tail box. Nothing about the record says which, so the
 * mark is chosen from the name the rider typed. It is decoration and it says
 * so: an unrecognised name gets the generic mark rather than a wrong one, and
 * no figure anywhere depends on it.
 */

const PART_GLYPHS: readonly { match: RegExp; icon: IconName }[] = [
  { match: /chain|sprocket|cog|gear/i, icon: 'link' },
  { match: /brake|pad|disc|rotor|caliper/i, icon: 'disc' },
  { match: /batter|cell/i, icon: 'battery' },
  { match: /tyre|tire|wheel|tube|rim/i, icon: 'circleDot' },
  { match: /air|filter/i, icon: 'wind' },
  { match: /oil|fluid|coolant|lubric/i, icon: 'droplet' },
  { match: /bulb|lamp|light|led|head ?light/i, icon: 'lightbulb' },
  { match: /plug|spark/i, icon: 'zap' },
];

const ACCESSORY_GLYPHS: readonly { match: RegExp; icon: IconName }[] = [
  { match: /box|case|carrier|luggage|rack|pannier|top ?box|tail/i, icon: 'package' },
  { match: /guard|crash|protect|slider|bar|cage/i, icon: 'shield' },
  { match: /lock|alarm|security|immobil/i, icon: 'lock' },
  { match: /mount|holder|phone|charger|usb/i, icon: 'smartphone' },
  { match: /light|lamp|led|horn/i, icon: 'lightbulb' },
  { match: /cam|record/i, icon: 'camera' },
];

export function partGlyph(name: string): IconName {
  return PART_GLYPHS.find((entry) => entry.match.test(name))?.icon ?? 'wrench';
}

export function accessoryGlyph(name: string): IconName {
  return ACCESSORY_GLYPHS.find((entry) => entry.match.test(name))?.icon ?? 'package';
}
