import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Card,
  DividedList,
  Eyebrow,
  Input,
  RecordRow,
  Screen,
  ScreenHeader,
  Txt,
} from '@/components';
import { countResults, searchRecords } from '@/calculations/search';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useDocuments } from '@/features/records/useRecordQueries';
import { formatCurrency } from '@/utils/format';

/**
 * Search across the rider's own records.
 *
 * Reached from the Dashboard, and the reason the deeper screens can afford to
 * be deep. A rider who remembers "Rahim" or "10W-40" gets there directly rather
 * than walking a menu.
 *
 * The empty result is the screen's most important state. "No results" tells a
 * rider nothing about whether they searched the wrong word or the wrong app, so
 * it says what is covered — and what is not.
 */
const SUGGESTIONS = ['insurance', 'oil', 'chain', 'brake'];

export default function SearchScreen() {
  const router = useRouter();
  const { analytics } = useGarageData();
  const { units } = useGarage();
  const documents = useDocuments();
  const [query, setQuery] = useState('');

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

  return (
    <Screen testID="screen-search">
      <ScreenHeader title="Search" />

      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search records, documents, workshops…"
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        testID="input-search"
      />

      {!typed ? (
        <View style={{ gap: 10, marginTop: 20 }}>
          <Eyebrow>TRY</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SUGGESTIONS.map((word) => (
              <Txt
                key={word}
                role="chip"
                tone="acc"
                onPress={() => setQuery(word)}
                style={{ paddingVertical: 8, paddingHorizontal: 13 }}
                testID={`search-suggestion-${word}`}
              >
                {word}
              </Txt>
            ))}
          </View>
          <Txt role="helper" tone="mut" style={{ marginTop: 6 }}>
            Searches your services, fuel logs, parts and products fitted, documents and their numbers,
            workshops, stations, and notes.
          </Txt>
        </View>
      ) : total === 0 ? (
        <View style={{ gap: 8, marginTop: 24 }}>
          <Txt role="cardTitle">Nothing in your records matches “{query.trim()}”</Txt>
          <Txt role="body" tone="mut">
            Search covers your services, fuel logs, parts and products fitted, documents and their numbers,
            workshops, stations, and notes. It doesn&apos;t search the web or other people&apos;s bikes.
          </Txt>
          <Txt role="helper" tone="mut">
            Spelling matters less than you&apos;d think — hyphens and capitals are ignored, so “10w40” finds
            “10W-40”.
          </Txt>
        </View>
      ) : (
        <View style={{ gap: 18, marginTop: 20 }}>
          {groups.map((group) => (
            <View key={group.kind} style={{ gap: 10 }}>
              <Eyebrow>{`${group.label} · ${group.results.length}`}</Eyebrow>
              <Card variant="list" style={{ paddingVertical: 4 }}>
                <DividedList>
                  {group.results.map((result) => (
                    <RecordRow
                      key={result.id}
                      title={result.title}
                      subtitle={result.detail}
                      trailing={
                        result.amountMinor === null ? undefined : (
                          <Txt role="value" numberOfLines={1}>
                            {formatCurrency(result.amountMinor, analytics?.currency ?? units.currency)}
                          </Txt>
                        )
                      }
                      onPress={() =>
                        router.push(
                          result.params === undefined
                            ? (result.route as never)
                            : ({ pathname: result.route, params: result.params } as never),
                        )
                      }
                      testID={`search-result-${result.id}`}
                    />
                  ))}
                </DividedList>
              </Card>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
