import type { IconName } from '@/components';

/**
 * The glyph a part or an accessory row opens on.
 *
 * The boards draw a different mark per item — a cog for the chain set, the
 * brake rotor for the pads, a battery for the battery, a box for the tail box.
 * Nothing about the record says which, so the mark is chosen from the name the
 * rider typed. It is decoration and it says so: an unrecognised name gets the
 * generic mark rather than a wrong one, and no figure anywhere depends on it.
 */

const PART_GLYPHS: readonly { match: RegExp; icon: IconName }[] = [
  { match: /chain|sprocket|cog|gear/i, icon: 'settings' },
  { match: /brake|pad|disc|rotor|caliper/i, icon: 'target' },
  { match: /batter|cell/i, icon: 'card' },
  { match: /tyre|tire|wheel|tube|rim/i, icon: 'circle' },
  { match: /oil|filter|fluid|coolant|lubric/i, icon: 'drop' },
  { match: /bulb|lamp|light|led|head ?light/i, icon: 'sparkle' },
  { match: /plug|spark/i, icon: 'sparkle' },
];

const ACCESSORY_GLYPHS: readonly { match: RegExp; icon: IconName }[] = [
  { match: /box|case|carrier|luggage|rack|pannier|top ?box|tail/i, icon: 'garageTab' },
  { match: /guard|crash|protect|slider|bar|cage/i, icon: 'shield' },
  { match: /lock|alarm|security|immobil/i, icon: 'lock' },
  { match: /mount|holder|phone|charger|usb/i, icon: 'card' },
  { match: /light|lamp|led|horn/i, icon: 'sparkle' },
  { match: /cam|record/i, icon: 'camera' },
];

export function partGlyph(name: string): IconName {
  return PART_GLYPHS.find((entry) => entry.match.test(name))?.icon ?? 'wrench';
}

export function accessoryGlyph(name: string): IconName {
  return ACCESSORY_GLYPHS.find((entry) => entry.match.test(name))?.icon ?? 'shield';
}
