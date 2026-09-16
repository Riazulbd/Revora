import { PixelRatio, type TextStyle } from 'react-native';

/**
 * Typography transcribed from the approved design. Every `font:` shorthand in
 * the design artboards maps to one of the roles below.
 *
 * Set in Google Sans Flex at weights 400/500/600/700/800 (MIT AND OFL-1.1).
 * It replaced Manrope in the 2026 redesign; the px scale survived that change
 * unaltered, so only the family and a handful of weights moved — which is why
 * the role names below still line up with the screens that use them.
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

type TypeSpec = { size: number; weight: FontWeight; lineHeight?: number; letterSpacing?: number };

const spec = (size: number, weight: FontWeight, lineHeight?: number, letterSpacing?: number): TypeSpec => ({
  size,
  weight,
  ...(lineHeight === undefined ? {} : { lineHeight }),
  ...(letterSpacing === undefined ? {} : { letterSpacing }),
});

/**
 * Named roles. The numbers are the exact px values from the design.
 */
export const type = {
  /** `font:700 26px` — auth screen titles. */
  authTitle: spec(26, 700),
  /** `font:700 24px` — root tab titles (Fuel, Garage, Expenses, More). */
  tabTitle: spec(24, 700),
  /** `font:700 22px` — dashboard greeting. */
  greeting: spec(22, 700),
  /** `font:700 20px` — pushed screen titles. */
  screenTitle: spec(20, 700),
  /** `font:700 17px` — card headline. */
  cardTitle: spec(17, 700),
  /** `font:600 17px` — the welcome screen's "Know your bike." line. */
  heroLine: spec(17, 700),
  /** `font:700 16px` — dialog title, primary button on tall forms. */
  dialogTitle: spec(16, 700),
  /** `font:600 40px/1` — hero odometer number. */
  hero: spec(40, 700, 40),
  /** `font:700 34px` — fuel detail total. */
  figure: spec(34, 700),
  /** `font:700 20px` — large numeric inputs. */
  inputLarge: spec(20, 700),
  /** `font:500 15px` — standard input text. */
  input: spec(15, 500),
  /** `font:600 16px` — numeric input text. */
  inputNumeric: spec(16, 700),
  /** `font:700 15.5px` — primary button label. */
  buttonPrimary: spec(15.5, 700),
  /** `font:700 14px` — secondary button label. */
  button: spec(14, 700),
  /** `font:700 13.5px` — compact button label. */
  buttonSmall: spec(13.5, 700),
  /** `font:700 10.5px letter-spacing .09em` — card section eyebrow. */
  eyebrow: spec(10.5, 700, undefined, 0.95),
  /** `font:700 9.5px letter-spacing .06em` — stat tile label. */
  tileLabel: spec(9.5, 700, undefined, 0.57),
  /** `font:700 12px` — form field label. */
  fieldLabel: spec(12, 700),
  /** `font:700 14px` — list row title. */
  rowTitle: spec(14, 700),
  /** `font:700 13.5px` — dense list row title. */
  rowTitleDense: spec(13.5, 700),
  /** `font:600 14px` — menu row label. */
  menuLabel: spec(14, 600),
  /** `font:600 13px` — key/value row. */
  kv: spec(13, 600),
  /** `font:600 13.5px` — feature bullet, toggle label. */
  bullet: spec(13.5, 600),
  /** `font:500 13.5px` — screen subtitle. */
  subtitle: spec(13.5, 500),
  /** `font:500 13px/1.6` — body copy. */
  body: spec(13, 500, 20.8),
  /** `font:500 12.5px` — secondary body. */
  bodySmall: spec(12.5, 500),
  /** `font:500 12px` — meta line. */
  meta: spec(12, 500),
  /** `font:500 11.5px` — dense meta line. */
  metaSmall: spec(11.5, 500),
  /** `font:500 11.5px/1.5` — helper text under a field. */
  helper: spec(11.5, 500, 17.25),
  /** `font:500 11px` — smallest meta. */
  micro: spec(11, 500),
  /** `font:700 11.5px` — inline link. */
  link: spec(11.5, 700),
  /** `font:700 13px` — prominent inline link. */
  linkLarge: spec(13, 700),
  /** `font:700 10.5px` — status badge. */
  badge: spec(10.5, 700),
  /** `font:700 11px` — count chip. */
  chip: spec(11, 700),
  /** `font:800 9px letter-spacing .06em` — PRO badge. */
  pro: spec(9, 800, undefined, 0.54),
  /** `font:700 10px` — tab bar label. */
  tabLabel: spec(10, 700),
  /** `font:700 12.5px` — toast. */
  toast: spec(12.5, 700),
  /** `font:600 12px` — statusbar-ish / small emphasis. */
  smallStrong: spec(12, 600),
  /** `font:600 13px` — medium emphasis. */
  mediumStrong: spec(13, 600),
  /** `font:600 14px` — list value. */
  value: spec(14, 600),
  /** `font:600 20px` — allowance figure. */
  figureSmall: spec(20, 700),
  /** `font:600 15px`/`font:700 15px` — tile value. */
  tileValue: spec(15, 700),
  /** `font:700 17px` — fuel summary tile value. */
  tileValueLarge: spec(17, 700),
} as const;

export type TypeRole = keyof typeof type;

export function textStyle(role: TypeRole, color?: string): TextStyle {
  const t = type[role];
  return {
    fontFamily: fontFamily[t.weight],
    fontSize: t.size,
    ...(t.lineHeight === undefined ? {} : { lineHeight: t.lineHeight }),
    ...(t.letterSpacing === undefined ? {} : { letterSpacing: t.letterSpacing }),
    ...(color === undefined ? {} : { color }),
  };
}
