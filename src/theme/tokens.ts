/**
 * Colour tokens transcribed from the Figma redesign
 * (design/figma/figma.css — every hex below appears there, with the screens
 * that use it listed in design/figma/spec/).
 *
 * Figma draws light only. The dark palette keeps the same roles and is built
 * from the design's own dark-accent family (`#101214`, `#23272C`, `#9AA1AA`,
 * `#FF6B3D`, `#4CC38A`), so a dark screen reads as the hero card grown to fill
 * the page.
 *
 * These are the single source of truth for colour. Never hard-code a hex value
 * in a screen or component; read it from `useTheme().c`.
 */

export type ThemeColors = {
  /** Page background behind cards (flat screens: forms, details). */
  bg: string;
  /** Card / sheet surface. */
  sur: string;
  /** Inset surface: date chips, neutral icon tiles, track fills. */
  sur2: string;
  /** Text field fill (`Box` in the design). */
  field: string;
  /** Primary text. */
  ink: string;
  /** Secondary text. */
  mut: string;
  /** Tertiary: placeholders, chevrons, inactive tab icons. */
  faint: string;
  /** Long-form body copy (legal pages). */
  prose: string;
  /** Outer borders: icon buttons, segmented tracks, tab bar, fields. */
  brd: string;
  /** Hairline between rows inside a card. */
  div: string;
  /** The heavier outline on a secondary action ("Attach pump receipt"). */
  brdStrong: string;
  /** Brand accent: primary button fill, selected offer border. */
  acc: string;
  /** Accent as text: links, "View all", "Revora Pro". */
  accText: string;
  /** Accent as a mark: chart strokes, accent icons. */
  accBright: string;
  /** The second step of the chart ramp (`#F4A27F`). */
  accLight: string;
  /** The fourth step of the chart ramp: a dark slate. */
  slate: string;
  /** Accent soft background: icon tiles, tinted buttons. */
  accS: string;
  /** Border on an accent-soft surface. */
  accBrd: string;
  /** Background of a selected option card. */
  accSel: string;
  good: string;
  goodS: string;
  /** Border on a good-soft surface (`#BFE6D2`). */
  goodBrd: string;
  /** Warning text. */
  warn: string;
  /** Warning glyph inside a warning tile. */
  warnIcon: string;
  warnS: string;
  /** Border on a warn-soft surface (`#F1DDB2`). */
  warnBrd: string;
  /** Danger text. */
  bad: string;
  /** Danger glyph, notification dot. */
  badIcon: string;
  badS: string;
  /** Border on a bad-soft surface (`#F3C7C1`). */
  badBrd: string;
  info: string;
  infoS: string;
  /** Top of the warm page wash on root and list screens. */
  washTop: string;
  /** The wash's 30% stop. */
  washMid: string;
  /** Dark-accent hero card: gradient from → to, at 135°. */
  heroFrom: string;
  heroTo: string;
  /** Hairline around the hero (only drawn where the page is dark too). */
  heroBrd: string;
  /** Stat tile inside the hero. */
  heroTile: string;
  /** Chip inside the hero ("Updated 3 days ago"). */
  heroChip: string;
  heroInk: string;
  heroMut: string;
  heroChipInk: string;
  /** Chart bars and rules inside the hero. */
  heroLine: string;
  heroAcc: string;
  heroGood: string;
  /** Desk / chrome behind the device frame — used for the splash ground. */
  desk: string;
  /** Modal scrim. */
  scrim: string;
};

export const lightColors: ThemeColors = {
  bg: '#F5F6F8',
  sur: '#FFFFFF',
  sur2: '#F1F2F5',
  field: '#F5F6F8',
  ink: '#14171B',
  mut: '#6B727C',
  faint: '#878E98',
  prose: '#3B4048',
  brd: '#E9EBEF',
  div: '#EEF0F3',
  brdStrong: '#C9CED4',
  acc: '#D2400F',
  accText: '#C93D0E',
  accBright: '#F4511E',
  accLight: '#F4A27F',
  slate: '#4A515B',
  accS: '#FDEAE3',
  accBrd: '#F6D3C5',
  accSel: '#FFF7F3',
  good: '#0B7F4E',
  goodS: '#E5F6EE',
  goodBrd: '#BFE6D2',
  warn: '#93611A',
  warnIcon: '#B7791F',
  warnS: '#FBF0DA',
  warnBrd: '#F1DDB2',
  bad: '#B42318',
  badIcon: '#D92D20',
  badS: '#FBE9E7',
  badBrd: '#F3C7C1',
  info: '#2563EB',
  infoS: '#E8F0FE',
  washTop: '#FFE6DA',
  washMid: '#F8F3F1',
  heroFrom: '#1E2227',
  heroTo: '#101214',
  heroBrd: 'transparent',
  heroTile: '#23272C',
  heroChip: '#262A30',
  heroInk: '#FFFFFF',
  heroMut: '#9AA1AA',
  heroChipInk: '#C9CED4',
  heroLine: '#2C3138',
  heroAcc: '#FF6B3D',
  heroGood: '#4CC38A',
  desk: '#ECEDF0',
  scrim: 'rgba(16,20,24,0.45)',
};

export const darkColors: ThemeColors = {
  bg: '#0E1012',
  sur: '#181B1F',
  sur2: '#22262B',
  field: '#101214',
  ink: '#F2F4F6',
  mut: '#9AA1AA',
  faint: '#7A818B',
  prose: '#C9CED4',
  brd: '#2A2F36',
  div: '#23272C',
  brdStrong: '#3B4048',
  acc: '#FF6B3D',
  accText: '#FF8A63',
  accBright: '#FF6B3D',
  accLight: '#F4A27F',
  slate: '#6B727C',
  accS: '#3A2118',
  accBrd: '#5A2E1E',
  accSel: '#24160F',
  good: '#4CC38A',
  goodS: '#17342A',
  goodBrd: '#245A42',
  warn: '#E0A33C',
  warnIcon: '#E0A33C',
  warnS: '#3A301A',
  warnBrd: '#5E4A22',
  bad: '#F07A6B',
  badIcon: '#E5695A',
  badS: '#3B211D',
  badBrd: '#5F2F29',
  info: '#7AA7FF',
  infoS: '#1A2740',
  washTop: '#2A1A13',
  washMid: '#141517',
  heroFrom: '#262B31',
  heroTo: '#191C20',
  heroBrd: '#2C3138',
  heroTile: '#2C3138',
  heroChip: '#30353C',
  heroInk: '#FFFFFF',
  heroMut: '#9AA1AA',
  heroChipInk: '#C9CED4',
  heroLine: '#3B4048',
  heroAcc: '#FF6B3D',
  heroGood: '#4CC38A',
  desk: '#0A0B0C',
  scrim: 'rgba(0,0,0,0.6)',
};

/** Corner radii used by the design. */
export const radius = {
  /** Filter chips, tags, count badges: all pills. */
  chip: 999,
  badge: 999,
  /** Inset tiles: date chip 14, light stat tile 16. */
  tile: 16,
  /** 40px icon tile. */
  iconTile: 12,
  /** Buttons, segmented tracks, the tab bar. */
  pill: 999,
  input: 14,
  button: 999,
  /** Option cards (plan offers, choice rows). */
  smallCard: 20,
  listCard: 24,
  card: 24,
  /** The dark-accent hero. */
  hero: 28,
  dialog: 28,
  sheet: 28,
} as const;

/** Vertical rhythm used by the design. */
export const spacing = {
  /** Gap between stacked blocks on a screen. */
  section: 16,
  /** Card inner padding. */
  card: 16,
  /** Horizontal padding of every screen. */
  screenX: 16,
  /** Pushed screens share the tab gutter in the redesign. */
  stackX: 16,
  /** Bottom padding so the floating tab bar never covers content. */
  tabBarClearance: 112,
} as const;

/** Minimum interactive size — Android accessibility guidance is 48dp. */
export const HIT_SIZE = 48;
export const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;
