import { PixelRatio, type TextStyle } from 'react-native';

/**
 * Typography transcribed from the Figma redesign. Every font declaration in
 * design/figma/figma.css maps to one of the roles below.
 *
 * Set in Google Sans Flex at weights 400/500/600/700/800 (MIT AND OFL-1.1).
 * The role names predate the Figma redesign and were kept so screens did not
 * have to change to pick up the new scale; the values are all new.
 *
 * Single face on purpose. The artboards ship stylesheet links for two further
 * families, but neither is used by a single element, and loading a typeface no
 * glyph is set in costs start-up time for nothing.
 */
export const fontFamily = {
  400: 'GoogleSansFlex_400Regular',
  500: 'GoogleSansFlex_500Medium',
  600: 'GoogleSansFlex_600SemiBold',
  700: 'GoogleSansFlex_700Bold',
  800: 'GoogleSansFlex_800ExtraBold',
} as const;

export type FontWeight = keyof typeof fontFamily;

/**
 * Accessibility font scaling is honoured, but capped so that a 200% system font
 * does not break dense financial rows. Layouts are built to flex; the cap only
 * stops the extreme end. (Requirement 57: never disable scaling outright.)
 */
export const MAX_FONT_SCALE = 1.35;

export function fontScale(): number {
  return Math.min(PixelRatio.getFontScale(), MAX_FONT_SCALE);
}

type TypeSpec = { size: number; weight: FontWeight; lineHeight: number; letterSpacing?: number };

/**
 * Figma sets every text box at 1.25× its size (12/15, 14/18, 16/20, 24/30,
 * 48/60), so that is the default leading; long-form copy passes its own.
 */
const spec = (size: number, weight: FontWeight, lineHeight?: number, letterSpacing?: number): TypeSpec => ({
  size,
  weight,
  lineHeight: lineHeight ?? Math.round(size * 1.25),
  ...(letterSpacing === undefined ? {} : { letterSpacing }),
});

/**
 * Named roles. Sizes, weights and tracking are the exact values from
 * design/figma/figma.css; the comment names a layer that uses each one.
 */
export const type = {
  /** `700 28px` — auth screen titles ("Welcome back"). */
  authTitle: spec(28, 700),
  /** `700 28px` — root tab titles (Fuel, Costs, Garage, More). */
  tabTitle: spec(28, 700),
  /** `700 24px` — the Dashboard's bike name. */
  greeting: spec(24, 700),
  /** `600 16px` — pushed screen titles, centred in the top bar. */
  screenTitle: spec(16, 600),
  /** `600 16px` — card heading ("Needs attention", "All fills"). */
  cardTitle: spec(16, 600),
  /** `500 18px` — the welcome screen's supporting line. */
  heroLine: spec(18, 500),
  /** `700 20px` — dialog and sheet title. */
  dialogTitle: spec(20, 700),
  /** `700 48px −0.02em` — hero figure (odometer, average mileage). */
  hero: spec(48, 700, 60, -0.96),
  /** `500 18px` — the unit beside a hero figure ("km", "km/L"). */
  heroUnit: spec(18, 500),
  /** `700 52px −0.02em` — amount entry ("Total paid ৳1,004"). */
  figure: spec(52, 700, 65, -1.04),
  /** `700 30px −0.02em` — display headline ("Every bike. Every number."). */
  display: spec(30, 700, 38, -0.6),
  /** `700 22px` — detail screen headline figure. */
  headline: spec(22, 700),
  /** `700 20px` — large numeric inputs. */
  inputLarge: spec(20, 700),
  /** `400 15px` — text field value. */
  input: spec(15, 400),
  /** `600 16px` — numeric field value. */
  inputNumeric: spec(16, 600),
  /** `600 16px` — primary button label. */
  buttonPrimary: spec(16, 600),
  /** `600 14px` — secondary button label. */
  button: spec(14, 600),
  /** `600 13px` — compact pill label ("Mark done"). */
  buttonSmall: spec(13, 600),
  /** `600 12px 0.06em` uppercase — section eyebrow ("UNITS", "ODOMETER"). */
  eyebrow: spec(12, 600, 15, 0.72),
  /** `500 12px` — stat tile label ("Mileage", "Spend"). */
  tileLabel: spec(12, 500),
  /** `500 12px` — form field label ("Station"). */
  fieldLabel: spec(12, 500),
  /** `600 14px` — list row title. */
  rowTitle: spec(14, 600),
  /** `600 14px` — dense list row title. */
  rowTitleDense: spec(14, 600),
  /** `600 15px` — fill row and settings row title, row amount. */
  rowTitleLarge: spec(15, 600),
  /** `600 15px` — menu row label. */
  menuLabel: spec(15, 600),
  /** `600 14px` — key/value row value. */
  kv: spec(14, 600),
  /** `500 14px` — feature bullet, toggle label. */
  bullet: spec(14, 500),
  /** `400 13px` — screen subtitle ("Bajaj Pulsar NS200 · Tue 16 Sep"). */
  subtitle: spec(13, 400),
  /** `400 14px / 1.5` — body copy. */
  body: spec(14, 400, 21),
  /** `400 13px` — secondary body. */
  bodySmall: spec(13, 400, 19),
  /** `400 12px` — meta line under a row title. */
  meta: spec(12, 400),
  /** `400 12px` — dense meta line. */
  metaSmall: spec(12, 400),
  /** `400 12px / 1.4` — helper text under a field, footnotes. */
  helper: spec(12, 400, 17),
  /** `500 12px` — smallest meta. */
  micro: spec(12, 500),
  /** `600 13px` — inline link ("View all"). */
  link: spec(13, 600),
  /** `600 14px` — prominent inline link ("Forgot password?"). */
  linkLarge: spec(14, 600),
  /** `600 12px` — status tag ("Full", "Partial"). */
  badge: spec(12, 600),
  /** `700 12px` — count chip. */
  chip: spec(12, 700),
  /** `700 12px` — PRO chip. */
  pro: spec(12, 700),
  /** `600 13px` — active tab label. */
  tabLabel: spec(13, 600),
  /** `600 13px` — toast. */
  toast: spec(13, 600),
  /** `600 12px` — small emphasis. */
  smallStrong: spec(12, 600),
  /** `600 13px` — medium emphasis. */
  mediumStrong: spec(13, 600),
  /** `600 14px` — list value. */
  value: spec(14, 600),
  /** `700 24px` — bento card figure ("৳2,840"). */
  figureSmall: spec(24, 700),
  /** `700 18px` — stat tile value. */
  tileValue: spec(18, 700),
  /** `700 20px` — stat tile value in the Dashboard hero. */
  tileValueLarge: spec(20, 700),
} as const;

export type TypeRole = keyof typeof type;

export function textStyle(role: TypeRole, color?: string): TextStyle {
  const t = type[role];
  return {
    fontFamily: fontFamily[t.weight],
    fontSize: t.size,
    lineHeight: t.lineHeight,
    ...(t.letterSpacing === undefined ? {} : { letterSpacing: t.letterSpacing }),
    ...(color === undefined ? {} : { color }),
  };
}
