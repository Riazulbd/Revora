import React from 'react';
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';

/**
 * The icon set, transcribed path-for-path from the approved design
 * (design/Revora.dc.html). Nothing here is substituted for a lookalike from an
 * icon library — the geometry is the design's own.
 */

export type IconName =
  | 'dashboard'
  | 'fuel'
  | 'fuelTab'
  | 'garage'
  | 'expenses'
  | 'more'
  | 'wrench'
  | 'shield'
  | 'chevronLeft'
  | 'chevronRight'
  | 'chevronDown'
  | 'bell'
  | 'plus'
  | 'check'
  | 'checkLarge'
  | 'checkCircle'
  | 'cross'
  | 'document'
  | 'file'
  | 'camera'
  | 'alert'
  | 'wifiOff'
  | 'pencil'
  | 'copy'
  | 'building'
  | 'motorcycle'
  | 'send'
  | 'lock'
  | 'card'
  | 'minus'
  | 'circle'
  | 'search'
  // Redesign glyphs, transcribed from design/redesign/*.dc.html.
  | 'home'
  | 'fuelPump'
  | 'wallet'
  | 'garageTab'
  | 'dotsVertical'
  | 'alertTriangle'
  | 'alertCircle'
  | 'calendar'
  | 'odometer'
  | 'drop'
  | 'banknote'
  | 'documents'
  | 'target'
  | 'sparkle'
  | 'settings'
  | 'eye'
  | 'eyeOff'
  | 'clock';

type Shape =
  | { type: 'path'; d: string; filled?: boolean }
  | { type: 'polyline'; points: string }
  | { type: 'circle'; cx: number; cy: number; r: number; filled?: boolean }
  | { type: 'rect'; x: number; y: number; width: number; height: number; rx: number };

const p = (d: string): Shape => ({ type: 'path', d });

const ICONS: Record<IconName, Shape[]> = {
  dashboard: [p('M4 15a8 8 0 0 1 16 0M12 15l3.5-4.5M4.5 19h15')],
  fuel: [p('M5 21V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15M4 21h11M14 9h2a2 2 0 0 1 2 2v4.5a1.5 1.5 0 0 0 3 0V9l-2.5-2.5')],
  fuelTab: [
    p('M5 20V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v14M4 20h11M14 9h2a2 2 0 0 1 2 2v4.5a1.5 1.5 0 0 0 3 0V9l-2.5-2.5M7.5 8h4'),
  ],
  garage: [p('M3 20V9l9-6 9 6v11M7 20v-7h10v7M7 16.5h10')],
  expenses: [
    p('M3 8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5zM21 11h-4.5a1.75 1.75 0 0 0 0 3.5H21'),
  ],
  more: [p('M5 12h.01M12 12h.01M19 12h.01')],
  wrench: [
    p('M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z'),
  ],
  shield: [p('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z')],
  chevronLeft: [{ type: 'polyline', points: '15 6 9 12 15 18' }],
  chevronRight: [{ type: 'polyline', points: '9 6 15 12 9 18' }],
  chevronDown: [{ type: 'polyline', points: '6 9 12 15 18 9' }],
  bell: [p('M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9'), p('M13.7 21a2 2 0 0 1-3.4 0')],
  plus: [p('M12 5v14M5 12h14')],
  minus: [p('M5 12h14')],
  check: [p('M20 6L9 17l-5-5')],
  checkLarge: [p('M4.5 12.5 10 18 19.5 7')],
  checkCircle: [{ type: 'circle', cx: 12, cy: 12, r: 9 }, p('M8.5 12.5 11 15l4.5-5')],
  cross: [{ type: 'circle', cx: 12, cy: 12, r: 9 }, p('M9 9l6 6M15 9l-6 6')],
  document: [{ type: 'rect', x: 4, y: 3, width: 16, height: 18, rx: 2 }, p('M8 7h8M8 11h8M8 15h5')],
  file: [p('M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM14 2v6h6')],
  camera: [
    p('M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z'),
    { type: 'circle', cx: 12, cy: 13, r: 3.5 },
  ],
  alert: [p('M12 8v5M12 16.5v.01M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z')],
  wifiOff: [
    p('M1.5 8.5a16 16 0 0 1 6-3.3M12 12.5a7 7 0 0 1 4.5 1.6M8.5 16.5a4 4 0 0 1 7 0M12 20h.01M3 3l18 18M10.7 5.1A16 16 0 0 1 22.5 8.5'),
  ],
  pencil: [p('M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z')],
  copy: [
    { type: 'rect', x: 9, y: 9, width: 12, height: 12, rx: 2 },
    p('M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'),
  ],
  building: [p('M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4')],
  motorcycle: [
    { type: 'circle', cx: 5.5, cy: 17, r: 3 },
    { type: 'circle', cx: 18.5, cy: 17, r: 3 },
    p('M5.5 17h5l2.5-6h3.5M12 8h3l1.5 3M9 8.5 11 11'),
  ],
  send: [p('M22 2 11 13M22 2l-7 20-4-9-9-4z')],
  lock: [{ type: 'rect', x: 4, y: 10, width: 16, height: 11, rx: 2 }, p('M8 10V7a4 4 0 0 1 8 0v3')],
  card: [{ type: 'rect', x: 4, y: 3, width: 16, height: 18, rx: 2 }, p('M8 12h8')],
  circle: [{ type: 'circle', cx: 12, cy: 12, r: 9 }],
  search: [
    { type: 'circle', cx: 11, cy: 11, r: 7 },
    { type: 'path', d: 'm20 20-3.5-3.5' },
  ],
  // Tab bar (Dashboard board, bottom band).
  home: [p('M3 10.5 12 3l9 7.5M5 9.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9.5M10 21v-6h4v6')],
  fuelPump: [
    p('M3 22h12M4 9h10M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5'),
  ],
  wallet: [p('M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4Z')],
  garageTab: [{ type: 'rect', x: 3, y: 8, width: 18, height: 11, rx: 2 }, p('M8 8V6a4 4 0 0 1 8 0v2')],
  // Header overflow (⋮) — three filled 1.6px dots.
  dotsVertical: [
    { type: 'circle', cx: 12, cy: 5, r: 1.6, filled: true },
    { type: 'circle', cx: 12, cy: 12, r: 1.6, filled: true },
    { type: 'circle', cx: 12, cy: 19, r: 1.6, filled: true },
  ],
  // Banners and error states.
  alertTriangle: [p('m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'), p('M12 9v4M12 17h.01')],
  alertCircle: [{ type: 'circle', cx: 12, cy: 12, r: 9 }, p('M12 7.5v5.5'), { type: 'circle', cx: 12, cy: 16.4, r: 1.2, filled: true }],
  // Field labels on Add fuel.
  calendar: [{ type: 'rect', x: 3.5, y: 5, width: 17, height: 16, rx: 2.5 }, p('M3.5 9.5h17M8 3v4M16 3v4')],
  odometer: [p('M4.5 19a9 9 0 1 1 15 0'), p('M12 14.5 15.5 9'), { type: 'circle', cx: 12, cy: 14.5, r: 1.6, filled: true }],
  drop: [p('M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z')],
  banknote: [{ type: 'rect', x: 2.5, y: 6, width: 19, height: 12, rx: 2 }, { type: 'circle', cx: 12, cy: 12, r: 2.6 }],
  // The Documents quick action and vault rows.
  documents: [
    p('M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z'),
    p('M8 8h8M8 12h8M8 16h5'),
  ],
  // Needs-attention row (safety / brakes).
  target: [
    { type: 'circle', cx: 12, cy: 12, r: 9 },
    { type: 'circle', cx: 12, cy: 12, r: 3.5 },
    p('M12 3.8v2M12 18.2v2M3.8 12h2M18.2 12h2'),
  ],
  sparkle: [p('M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8')],
  settings: [
    { type: 'circle', cx: 12, cy: 12, r: 3 },
    p('M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'),
  ],
  eye: [p('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z'), { type: 'circle', cx: 12, cy: 12, r: 3 }],
  eyeOff: [p('M17.9 17.9A10 10 0 0 1 12 19c-6.5 0-10-7-10-7a17 17 0 0 1 4.1-4.9M9.9 5.2A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.1 3M14.1 14.1a3 3 0 1 1-4.2-4.2M3 3l18 18')],
  clock: [{ type: 'circle', cx: 12, cy: 12, r: 9 }, p('M12 7v5l3 2')],
};

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  /**
   * Fades the whole glyph. Used where a board dims the mark rather than
   * recolouring it — the photo placeholders draw it at `#C6CAD1`, which is
   * `--mut` at a little over half strength on either ground.
   */
  opacity?: number;
};

export function Icon({ name, size = 20, color, strokeWidth = 2, opacity }: IconProps) {
  const { c } = useTheme();
  const stroke = color ?? c.ink;
  const shapes = ICONS[name];

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...(opacity === undefined ? {} : { opacity })}>
      {shapes.map((shape, index) => {
        const common = {
          stroke,
          strokeWidth,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
          fill: 'none' as const,
        };
        if (shape.type === 'path') {
          return <Path key={index} d={shape.d} {...common} {...(shape.filled ? { fill: stroke, stroke: 'none' } : {})} />;
        }
        if (shape.type === 'polyline') return <Polyline key={index} points={shape.points} {...common} />;
        if (shape.type === 'circle') {
          return (
            <Circle
              key={index}
              cx={shape.cx}
              cy={shape.cy}
              r={shape.r}
              {...common}
              {...(shape.filled ? { fill: stroke, stroke: 'none' } : {})}
            />
          );
        }
        return (
          <Rect
            key={index}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            rx={shape.rx}
            {...common}
          />
        );
      })}
    </Svg>
  );
}
