import React from 'react';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';
import { ICON_DATA, type IconDataName } from './iconData';

/**
 * The icon set. The Figma redesign draws every glyph from Lucide at 20px with
 * a 1.67px stroke (2 units on Lucide's 24 grid), and `iconData.ts` carries
 * Lucide's own geometry — see scripts/gen-icons.mjs to add one.
 *
 * Icons are named as in Lucide, camel-cased (`fileText`, `circleCheck`). The
 * names the app used before the redesign stay valid as aliases, so a screen
 * that asks for `odometer` gets the design's `gauge`.
 */
const ALIASES = {
  dashboard: 'gauge',
  fuelTab: 'fuel',
  fuelPump: 'fuel',
  garage: 'warehouse',
  garageTab: 'bike',
  motorcycle: 'bike',
  expenses: 'wallet',
  more: 'menu',
  checkLarge: 'check',
  checkCircle: 'circleCheck',
  cross: 'x',
  document: 'fileText',
  documents: 'fileText',
  alert: 'triangleAlert',
  alertTriangle: 'triangleAlert',
  alertCircle: 'circleAlert',
  card: 'creditCard',
  home: 'house',
  dotsVertical: 'ellipsisVertical',
  odometer: 'gauge',
  drop: 'droplet',
  target: 'disc',
} as const satisfies Record<string, IconDataName>;

export type IconName = IconDataName | keyof typeof ALIASES;

function resolve(name: IconName): IconDataName {
  return name in ALIASES ? ALIASES[name as keyof typeof ALIASES] : (name as IconDataName);
}

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  /**
   * Fades the whole glyph, for placeholders that dim the mark rather than
   * recolour it.
   */
  opacity?: number;
};

export function Icon({ name, size = 20, color, strokeWidth = 2, opacity }: IconProps) {
  const { c } = useTheme();
  const stroke = color ?? c.ink;
  const nodes = ICON_DATA[resolve(name)];

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(opacity === undefined ? {} : { opacity })}
    >
      {nodes.map(([tag, attrs], index) => {
        const a = attrs as Record<string, string>;
        switch (tag as string) {
          case 'path':
            return <Path key={index} d={a.d} />;
          case 'circle':
            return <Circle key={index} cx={a.cx} cy={a.cy} r={a.r} />;
          case 'ellipse':
            return <Ellipse key={index} cx={a.cx} cy={a.cy} rx={a.rx} ry={a.ry} />;
          case 'rect':
            return <Rect key={index} x={a.x ?? 0} y={a.y ?? 0} width={a.width} height={a.height} rx={a.rx} ry={a.ry} />;
          case 'line':
            return <Line key={index} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} />;
          case 'polyline':
            return <Polyline key={index} points={a.points} />;
          case 'polygon':
            return <Polygon key={index} points={a.points} />;
          default:
            return null;
        }
      })}
    </Svg>
  );
}
