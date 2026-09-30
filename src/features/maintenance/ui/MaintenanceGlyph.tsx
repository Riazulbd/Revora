import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import { Icon } from '@/components';

/**
 * The marks the Maintenance boards draw in the tinted square in front of a rule.
 *
 * Four of them exist nowhere else in the app — the sun for chain lube, the grate
 * for an air filter, the plug, and the crossed-out drop for a rule whose
 * reminders are off — so they are transcribed path-for-path from
 * `design/redesign/Maintenance.dc.html` rather than approximated with the
 * nearest glyph from the shared set. Everything else falls through to the shared
 * `Icon`, which is where a mark belongs once a second screen wants it.
 *
 * Rules are named by the rider ("Chain clean, lube & tension", "Front tyre"), so
 * the match is on words, exactly as `placeholdersFor()` matches placeholders.
 */

export type MaintenanceGlyphName = 'oil' | 'chain' | 'filter' | 'plug' | 'brake' | 'off' | 'generic';

const MATCHES: readonly { match: RegExp; glyph: MaintenanceGlyphName }[] = [
  { match: /chain|sprocket/, glyph: 'chain' },
  { match: /filter/, glyph: 'filter' },
  { match: /spark|plug/, glyph: 'plug' },
  { match: /brake|pad/, glyph: 'brake' },
  { match: /oil|lubric|coolant|fluid|grease/, glyph: 'oil' },
];

export function glyphForRule(ruleName: string): MaintenanceGlyphName {
  const needle = ruleName.trim().replace(/\s+/g, ' ').toLowerCase();
  // "Air filter" must not be read as "engine oil filter": the filter rule wins
  // because it is tested first, which is the order a rider would read it in.
  return MATCHES.find((entry) => entry.match.test(needle))?.glyph ?? 'generic';
}

const DROP = 'M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z';

export function MaintenanceGlyph({
  name,
  size = 18,
  color,
  strokeWidth = 1.8,
}: {
  name: MaintenanceGlyphName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  if (name === 'generic') return <Icon name="wrench" size={size} color={color} strokeWidth={strokeWidth} />;
  if (name === 'brake') return <Icon name="target" size={size} color={color} strokeWidth={strokeWidth} />;

  const stroke = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'oil' ? <Path d={DROP} {...stroke} /> : null}

      {name === 'off' ? (
        <>
          <Path d={DROP} {...stroke} />
          <Path d="M9 14a3 3 0 0 0 3 3" {...stroke} />
        </>
      ) : null}

      {name === 'chain' ? (
        <>
          <Circle cx={12} cy={12} r={3} {...stroke} />
          <Path
            d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"
            {...stroke}
          />
        </>
      ) : null}

      {name === 'filter' ? <Path d="M4 6h16M4 12h16M4 18h16M8 6v12M16 6v12" {...stroke} /> : null}

      {name === 'plug' ? <Path d="M9 3h6v5a3 3 0 0 1-6 0V3ZM12 11v4M10 15h4M12 15v6" {...stroke} /> : null}
    </Svg>
  );
}
