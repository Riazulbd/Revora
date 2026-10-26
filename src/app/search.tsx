import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Footnote,
  Icon,
  IconSquareButton,
  ListCard,
  MenuRow,
  RowIcon,
  SearchBar,
  Screen,
  SectionEyebrow,
  Txt,
  type IconName,
  type RowTone,
} from '@/components';
import { countResults, searchRecords, type SearchResultKind } from '@/calculations/search';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useDocuments } from '@/features/records/useRecordQueries';
import { Highlighted } from '@/features/dashboard/ui/SearchHighlight';
import { recentSearches, rememberSearch } from '@/features/dashboard/ui/recentSearches';
import { formatCurrencySymbol } from '@/utils/format';
import { HIT_SIZE, fontFamily, useTheme } from '@/theme';

/**
 * Search across the rider's own records (Figma `B5 Search — Results`).
 *
 * A rider who remembers "Rahim" or "10W-40" gets there directly rather than
 * walking a menu. The resting screen offers a way in — recent queries, and
 * the destinations riders most often opened search to reach — because a blank
 * box asks a question the rider came here to answer. And the empty result says
 * what is covered: "no results" tells nobody whether they searched the wrong
 * word or the wrong app.
 */

/** Figma `Tile` per result kind: a wrench on blue for services, the pump on the accent for fills, the cog for parts. */
const KIND_LOOK: Record<SearchResultKind, { icon: IconName; tone: RowTone }> = {
  service: { icon: 'wrench', tone: 'info' },
  fuel: { icon: 'fuel', tone: 'accent' },
  part: { icon: 'cog', tone: 'neutral' },
  product: { icon: 'droplet', tone: 'neutral' },
  accessory: { icon: 'package', tone: 'neutral' },
  document: { icon: 'fileText', tone: 'warn' },
};

type Jump = { label: string; icon: IconName; tone: RowTone; route: string; testID: string };

const JUMP_TO: Jump[] = [
  { label: 'Documents', icon: 'fileText', tone: 'accent', route: '/records/vault', testID: 'jump-documents' },
  { label: 'Proof Pack', icon: 'fileCheck', tone: 'good', route: '/records/proof-pack', testID: 'jump-proof-pack' },
  { label: 'Odometer history', icon: 'gauge', tone: 'neutral', route: '/garage/odometer', testID: 'jump-odometer' },
];

export default function SearchScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { analytics } = useGarageData();
  const { units } = useGarage();
  const documents = useDocuments();
  // A deep link can arrive with the words already typed (`/search?q=oil`).
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(typeof q === 'string' ? q : '');
  const [recent, setRecent] = useState<readonly string[]>(() => recentSearches());

  const groups = useMemo(() => {
    if (analytics === null) return [];
    return searchRecords(query, {
      services: analytics.services.all,
      serviceItems: analytics.serviceItems,
      fuelEntries: analytics.fuel.entries,
      parts: [...analytics.parts.active, ...analytics.parts.removed].map((p) => p.part),
      accessories: analytics.accessories.all,
      documents: documents.data ?? [],
    });
  }, [analytics, documents.data, query]);

  const total = countResults(groups);
  const typed = query.trim() !== '';
  const currency = analytics?.currency ?? units.currency;

  const open = (route: string, params?: Record<string, string>) => {
    setRecent(rememberSearch(query));
    router.push(params === undefined ? (route as never) : ({ pathname: route, params } as never));
  };

  return (
    <Screen testID="screen-search" contentStyle={{ gap: 16 }}>
      {/* Figma `Search row`: the round back button and the field, `gap:10px`. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconSquareButton
          icon="chevronLeft"
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/more'))}
          testID="cta-search-back"
        />
        <View style={{ flex: 1 }}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            onClear={() => setQuery('')}
            onSubmitEditing={() => setRecent(rememberSearch(query))}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            testID="input-search"
          />
        </View>
      </View>

      {/* Figma `Recent`: 48px chips with the clock, kept for the session. */}
      {recent.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionEyebrow first style={{ marginBottom: 0, paddingLeft: 0 }}>
            Recent
          </SectionEyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {recent.map((word) => (
              <Pressable
                key={word}
                accessibilityRole="button"
                accessibilityLabel={`Search again for ${word}`}
                onPress={() => setQuery(word)}
                testID={`search-recent-${word.replace(/\s+/g, '-')}`}
                style={({ pressed }) => ({
                  height: HIT_SIZE,
                  paddingLeft: 12,
                  paddingRight: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: c.brd,
                  backgroundColor: c.sur,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Icon name="clock" size={16} color={c.mut} />
                <Txt style={{ fontFamily: fontFamily[600], fontSize: 13, color: c.ink }}>{word}</Txt>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {!typed ? (
        <View style={{ gap: 10 }}>
          <SectionEyebrow first style={{ marginBottom: 0, paddingLeft: 0 }}>
            Jump to
          </SectionEyebrow>
          <ListCard>
            {JUMP_TO.map((jump) => (
              <MenuRow
                key={jump.testID}
                icon={jump.icon}
                iconTone={jump.tone}
                label={jump.label}
                onPress={() => router.push(jump.route as never)}
                testID={jump.testID}
              />
            ))}
          </ListCard>
        </View>
      ) : total === 0 ? (
        <View style={{ backgroundColor: c.sur, borderRadius: 24, paddingVertical: 24, paddingHorizontal: 20, alignItems: 'center', gap: 10 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.sur2, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="search" size={22} color={c.mut} />
          </View>
          <Txt role="rowTitleLarge" align="center">
            {`Nothing in your records matches “${query.trim()}”`}
          </Txt>
          <Txt role="bodySmall" tone="mut" align="center" style={{ maxWidth: 300 }}>
            Search covers your services, fuel logs, parts and products fitted, documents and their numbers,
            workshops, stations, and notes. It doesn&apos;t search the web or other people&apos;s bikes.
          </Txt>
        </View>
      ) : (
        groups.map((group) => (
          /* Figma `Group services` …: the eyebrow with its count, then 64px rows in one card. */
          <View key={group.kind} style={{ gap: 10 }}>
            <SectionEyebrow first style={{ marginBottom: 0, paddingLeft: 0 }}>
              {`${group.label} · ${group.results.length}`}
            </SectionEyebrow>
            <ListCard>
              {group.results.map((result) => {
                const look = KIND_LOOK[result.kind];
                return (
                  <Pressable
                    key={result.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${result.title}. ${result.detail}`}
                    onPress={() => open(result.route, result.params)}
                    testID={`search-result-${result.id}`}
                    style={({ pressed }) => ({
                      minHeight: 64,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 12,
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <RowIcon icon={look.icon} tone={look.tone} />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Highlighted text={result.title} query={query} role="rowTitleLarge" numberOfLines={2} />
                      <Highlighted text={result.detail} query={query} role="meta" tone="mut" numberOfLines={2} />
                    </View>
                    {result.amountMinor === null ? (
                      <Icon name="chevronRight" size={20} color={c.faint} />
                    ) : (
                      <Txt role="value" numberOfLines={1}>
                        {formatCurrencySymbol(result.amountMinor, currency)}
                      </Txt>
                    )}
                  </Pressable>
                );
              })}
            </ListCard>
          </View>
        ))
      )}

      <Footnote style={{ marginTop: 0 }}>Searches your own records on this phone — works offline.</Footnote>
    </Screen>
  );
}
