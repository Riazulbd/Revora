import { useMemo } from 'react';

import { attentionItems, type AttentionItem } from '@/calculations/attention';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useDocuments, useSafetyChecks } from '@/features/records/useRecordQueries';
import { todayIso } from '@/utils/date';

/**
 * The Dashboard's attention list, assembled from the three sources that can
 * each independently be wrong: maintenance rules, the document vault, and the
 * safety log.
 *
 * They arrive from three different queries, which is the reason this hook
 * exists rather than the list being a field on `analyseBike`. Analytics is a
 * pure function of one bike's records; documents and safety checks are their
 * own live queries with their own loading states, and folding them into
 * analytics would make every Dashboard figure wait on both.
 *
 * A source that has not loaded contributes nothing rather than blocking, so the
 * list fills in as the queries land. That is the right failure mode here: a
 * partially-populated list is useful, and a spinner where the odometer should
 * be is not.
 */
export function useAttention(): {
  items: AttentionItem[];
  count: number;
  isPending: boolean;
  /** A document expires (or has expired) inside the 30-day window — the amber
   *  dot the boards put on the Documents tile. */
  documentsExpiring: boolean;
} {
  const { units } = useGarage();
  const { analytics } = useGarageData();
  const documents = useDocuments();
  const safety = useSafetyChecks();

  const rules = analytics?.maintenance.rules;
  const documentList = documents.data;
  const checkList = safety.data;

  const items = useMemo(
    () =>
      attentionItems({
        rules: rules ?? [],
        documents: documentList ?? [],
        safetyChecks: checkList ?? [],
        distanceUnit: units.distance,
        today: analytics?.today ?? todayIso(),
      }),
    [rules, documentList, checkList, units.distance, analytics?.today],
  );

  return {
    items,
    count: items.length,
    isPending: analytics === null || documents.isPending || safety.isPending,
    documentsExpiring: items.some((item) => item.kind === 'document'),
  };
}
