import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Card,
  Divider,
  Footnote,
  Icon,
  IconSquareButton,
  ListCard,
  SearchBar,
  SectionEyebrow,
  Screen,
  Txt,
  type IconName,
} from '@/components';
import { countResults, searchRecords } from '@/calculations/search';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useDocuments } from '@/features/records/useRecordQueries';
import { Highlighted } from '@/features/dashboard/ui/SearchHighlight';
import { recentSearches, rememberSearch } from '@/features/dashboard/ui/recentSearches';
import { formatCurrency } from '@/utils/format';
import { HIT_SIZE, fontFamily, useTheme } from '@/theme';

/**
 * Search across the rider's own records.
 *
 * Reached from the Dashboard, and the reason the deeper screens can afford to
 * be deep. A rider who remembers "Rahim" or "10W-40" gets there directly rather
 * than walking a menu.
 *
 * Two of its three states carry the real weight. The resting screen offers a
 * way in — recent queries, and the three destinations riders most often opened
 * search to reach — because a blank box asks a question the rider came here to
 * answer. And the empty result says what is covered: "no results" tells nobody
 * whether they searched the wrong word or the wrong app.
 */

type Jump = { label: string; icon: IconName; tone: 'acc' | 'good' | 'mut'; route: string; testID: string };

const JUMP_TO: Jump[] = [
  { label: 'Documents', icon: 'documents', tone: 'acc', route: '/records/vault', testID: 'jump-documents' },
  { label: 'Proof Pack', icon: 'file', tone: 'good', route: '/records/proof-pack', testID: 'jump-proof-pack' },
  {
    label: 'Odometer history',
    icon: 'odometer',
    tone: 'mut',
    route: '/garage/odometer',
    testID: 'jump-odometer',
  },
];

export default function SearchScreen() {
  const router = useRouter();
  const { c, radius } = useTheme();
  const { analytics } = useGarageData();
  const { units } = useGarage();
  const documents = useDocuments();
  const [query, setQuery] = useState('');
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

  const open = (route: string, params?: Record<string, string>) => {
    setRecent(rememberSearch(query));
    router.push(params === undefined ? (route as never) : ({ pathname: route, params } as never));
  };

  return (
    <Screen testID="screen-search" contentStyle={{ paddingHorizontal: 20 }}>
      {/* The board pulls the 44px back target 10px left so the field lines up
          with the content edge. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: -10 }}>
        <IconSquareButton
          icon="chevronLeft"
          variant="plain"
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'))}
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

      {!typed ? (
        <View>
          {recent.length > 0 ? (
            <>
              <SectionEyebrow top={18}>RECENT</SectionEyebrow>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {recent.map((word) => (
                  <Pressable
                    key={word}
                    accessibilityRole="button"
                    accessibilityLabel={`Search again for ${word}`}
                    onPress={() => setQuery(word)}
                    testID={`search-recent-${word.replace(/\s+/g, '-')}`}
                    style={({ pressed }) => ({
                      minHeight: HIT_SIZE,
                      marginVertical: -(HIT_SIZE - 36) / 2,
                      justifyContent: 'center',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <View
                      style={{
                        height: 36,
                        paddingHorizontal: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 7,
                        borderRadius: radius.chip,
                        borderWidth: 1,
                        borderColor: c.brd,
                        backgroundColor: c.sur,
                      }}
                    >
                      <Icon name="clock" size={13} color={c.mut} strokeWidth={2} />
                      <Txt style={{ fontFamily: fontFamily[600], fontSize: 12.5, color: c.ink }}>{word}</Txt>
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <SectionEyebrow top={18}>JUMP TO</SectionEyebrow>
          <Card variant="list">
            {JUMP_TO.map((jump, index) => (
              <View key={jump.testID}>
                {index > 0 ? <Divider /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={jump.label}
                  onPress={() => router.push(jump.route as never)}
                  testID={jump.testID}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 11,
                    paddingVertical: 13,
                    minHeight: HIT_SIZE,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Icon
                    name={jump.icon}
                    size={16}
                    color={jump.tone === 'acc' ? c.acc : jump.tone === 'good' ? c.good : c.mut}
                    strokeWidth={1.8}
                  />
                  <Txt style={{ fontFamily: fontFamily[700], fontSize: 13.5, color: c.ink }}>
                    {jump.label}
                  </Txt>
                </Pressable>
              </View>
            ))}
          </Card>

          <Footnote>Searches your own records on this phone — works offline.</Footnote>
        </View>
      ) : total === 0 ? (
        <View>
          <Card style={{ paddingVertical: 24, paddingHorizontal: 20, marginTop: 16, alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: c.sur2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="search" size={22} color={c.mut} strokeWidth={2} />
            </View>
            <Txt align="center" style={{ fontFamily: fontFamily[700], fontSize: 15, color: c.ink }}>
              Nothing in your records matches “{query.trim()}”
            </Txt>
            <Txt
              align="center"
              style={{ fontFamily: fontFamily[500], fontSize: 13, lineHeight: 20.8, color: c.mut, maxWidth: 300 }}
            >
              Search covers your services, fuel logs, parts and products fitted, documents and their numbers,
              workshops, stations, and notes. It doesn&apos;t search the web or other people&apos;s bikes.
            </Txt>
          </Card>
          <Footnote>Typos matter less than you&rsquo;d think — matching is forgiving on spelling.</Footnote>
        </View>
      ) : (
        <View>
          {groups.map((group) => (
            <View key={group.kind}>
              <SectionEyebrow top={16}>{`${group.label} · ${group.results.length}`}</SectionEyebrow>
              <ListCard>
                {group.results.map((result) => (
                  <Pressable
                    key={result.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${result.title}. ${result.detail}`}
                    onPress={() => open(result.route, result.params)}
                    testID={`search-result-${result.id}`}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 12,
                      minHeight: HIT_SIZE,
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Highlighted text={result.title} query={query} numberOfLines={2} />
                      <Highlighted
                        text={result.detail}
                        query={query}
                        role="meta"
                        tone="mut"
                        numberOfLines={2}
                      />
                    </View>
                    {result.amountMinor === null ? (
                      <Icon name="chevronRight" size={15} color={c.mut} strokeWidth={2} />
                    ) : (
                      <Txt
                        numberOfLines={1}
                        style={{ fontFamily: fontFamily[700], fontSize: 13.5, color: c.ink }}
                      >
                        {formatCurrency(result.amountMinor, analytics?.currency ?? units.currency)}
                      </Txt>
                    )}
                  </Pressable>
                ))}
              </ListCard>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
