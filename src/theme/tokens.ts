/**
 * Colour tokens transcribed verbatim from the approved Revora design
 * (design/Revora.dc.html — the `body` and `body.dark` custom-property blocks).
 *
 * These are the single source of truth for colour. Never hard-code a hex value
 * in a screen or component; read it from `useTheme().c`.
 */

export type ThemeColors = {
  /** Page background behind cards. */
  bg: string;
  /** Card / sheet / input surface. */
  sur: string;
  /** Inset surface: stat tiles, track fills, segmented controls. */
  sur2: string;
  /** Primary text. */
  ink: string;
  /** Secondary / muted text. */
  mut: string;
  /** Hairline borders and dividers. */
  brd: string;
  /** Brand accent (Revora orange). */
  acc: string;
  /** Accent soft background. */
  accS: string;
  good: string;
  goodS: string;
  warn: string;
  warnS: string;
  bad: string;
  badS: string;
  /** Desk / chrome behind the device frame — used for the splash ground. */
  desk: string;
  /** Modal scrim. */
  scrim: string;
};

export const lightColors: ThemeColors = {
  bg: '#F5F6F8',
  sur: '#FFFFFF',
  sur2: '#F1F2F5',
  ink: '#14171B',
  mut: '#878E98',
  brd: '#E9EBEF',
  acc: '#F4511E',
  accS: '#FDEAE3',
  good: '#0FA968',
  goodS: '#E5F6EE',
  warn: '#B7791F',
  warnS: '#FBF0DA',
  bad: '#D92D20',
  badS: '#FBE9E7',
  desk: '#ECEDF0',
  scrim: 'rgba(16,20,24,0.45)',
};

export const darkColors: ThemeColors = {
  bg: '#101214',
  sur: '#191C20',
  sur2: '#23272C',
  ink: '#F2F4F6',
  mut: '#9AA1AA',
  brd: '#2C3138',
  acc: '#FF6B3D',
  accS: '#3A2118',
  good: '#4CC38A',
  goodS: '#17342A',
  warn: '#E0A33C',
  warnS: '#3A301A',
  bad: '#E5695A',
  badS: '#3B211D',
  desk: '#0A0B0C',
  scrim: 'rgba(0,0,0,0.6)',
};

/** Corner radii used by the design. */
export const radius = {
  chip: 7,
  badge: 8,
  tile: 11,
  pill: 14,
  input: 13,
  button: 14,
  smallCard: 14,
  listCard: 16,
  card: 18,
  dialog: 20,
  sheet: 22,
} as const;

/** Vertical rhythm used by the design. */
export const spacing = {
  /** Gap between stacked cards on a screen. */
  section: 16,
  /** Card inner padding. */
  card: 18,
  /** Horizontal padding of a tab screen. */
  screenX: 16,
  /** Horizontal padding of a pushed (stack) screen. */
  stackX: 20,
  /** Bottom padding so the tab bar never covers content. */
  tabBarClearance: 100,
} as const;

/** Minimum interactive size — Android accessibility guidance is 48dp. */
export const HIT_SIZE = 44;
export const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;
