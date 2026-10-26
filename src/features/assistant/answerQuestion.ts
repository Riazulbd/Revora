import type { BikeAnalytics } from '@/calculations/analytics';
import { RELIABLE_INTERVALS_REQUIRED } from '@/calculations/mileage';
import { averageMonthlyDistanceMetres } from '@/calculations/odometer';
import { formatLongDate, formatMonthLong, monthKey } from '@/utils/date';
import { formatCurrencySymbol, formatDistance, formatMileage, formatPricePerVolumeSymbol, formatRateSymbol, formatVolume } from '@/utils/format';

/**
 * The assistant.
 *
 * Every number it says comes from the same deterministic calculations the rest of
 * the app renders — the assistant looks them up, it never estimates or infers
 * them (requirement 36). It matches the question to an intent and reads the
 * answer out of `BikeAnalytics`.
 *
 * Because there is no model call, it works with no connection, and there is no
 * API key in this bundle to leak (requirement 35). If a server-side language
 * model is added later it should phrase these same looked-up figures, never
 * produce its own.
 */

export type AssistantAnswer = {
  text: string;
  /** True when the question was understood. */
  matched: boolean;
};

export const SUGGESTED_QUESTIONS: readonly string[] = [
  'When is my next service due?',
  "What's my average mileage?",
  'How much have I spent this month?',
  'What does this bike cost me per km?',
  'How much fuel have I used?',
  'Which parts are wearing out?',
  'Are any documents expiring?',
];

/**
 * Facts the assistant needs that live outside `BikeAnalytics` — the document
 * vault is loaded by its own screen, not by the dashboard analysis.
 */
export type AssistantContext = {
  documents: { expiredCount: number; expiringCount: number };
};

const NO_DOCUMENTS: AssistantContext = { documents: { expiredCount: 0, expiringCount: 0 } };

type Intent = {
  test: RegExp;
  answer: (analytics: BikeAnalytics, context: AssistantContext) => string;
};

const INTENTS: Intent[] = [
  {
    // Documents first: "is my insurance expiring" must not be caught by the
    // maintenance-due pattern below.
    test: /document|insurance|registration|tax token|licence|license|fitness|expir/i,
    answer: (_analytics, context) => {
      const { expiredCount, expiringCount } = context.documents;
      if (expiredCount === 0 && expiringCount === 0) {
        return 'Nothing in your document vault is expired or expiring in the next 30 days.';
      }
      const parts: string[] = [];
      if (expiredCount > 0) parts.push(`${expiredCount} expired`);
      if (expiringCount > 0) parts.push(`${expiringCount} expiring within 30 days`);
      return `You have ${parts.join(' and ')}. Open the Document vault to see which.`;
    },
  },
  {
    test: /(next|when).*(service|due|oil|maintenance)|due (soon|next)/i,
    answer: (a) => {
      const next = a.maintenance.nextDue;
      if (!next) {
        return a.maintenance.rules.length === 0
          ? 'You have no maintenance rules set up yet. Add one in Maintenance and I can track it against your odometer.'
          : 'None of your rules have a projected due point yet — mark one complete and I can count down to the next one.';
      }
      const { rule, status } = next;
      const distancePart =
        status.remainingMetres === null
          ? null
          : status.remainingMetres < 0
            ? `overdue by ${formatDistance(-status.remainingMetres, a.units.distance)}`
            : `about ${formatDistance(status.remainingMetres, a.units.distance)} away`;
      const datePart =
        status.dueOnDate === null ? null : `due by ${formatLongDate(status.dueOnDate)}`;

      const pace = averageMonthlyDistanceMetres(a.odometer.points);
      const paceNote =
        pace !== null && status.remainingMetres !== null && status.remainingMetres > 0
          ? ` At your pace (~${formatDistance(pace, a.units.distance)}/month) that is roughly ${Math.max(
              1,
              Math.round(status.remainingMetres / pace),
            )} month${Math.round(status.remainingMetres / pace) === 1 ? '' : 's'}.`
          : '';

      return `${rule.name} is next${status.dueAtMetres === null ? '' : ` — due at ${formatDistance(status.dueAtMetres, a.units.distance)}`}, ${[distancePart, datePart].filter(Boolean).join(' and ')}.${paceNote}`;
    },
  },
  {
    test: /(average|avg).*(mileage|km\/l|consumption|economy)|mileage/i,
    answer: (a) => {
      if (a.mileage.average === null) {
        return 'I do not have a complete full-to-full interval yet, so any figure I gave you would be an estimate rather than a measurement.';
      }
      const best =
        a.mileage.best && a.mileage.worst
          ? ` Your best interval was ${formatMileage(a.mileage.best.efficiency, a.units.mileage)} and your worst ${formatMileage(a.mileage.worst.efficiency, a.units.mileage)}.`
          : ` Best and worst unlock at ${RELIABLE_INTERVALS_REQUIRED} intervals — you have ${a.mileage.count}.`;
      return `Your average is ${formatMileage(a.mileage.average, a.units.mileage)} across ${a.mileage.count} full-to-full interval${a.mileage.count === 1 ? '' : 's'}.${best}`;
    },
  },
  {
    test: /(spent|spend|cost).*(month|this month)/i,
    answer: (a) => {
      const month = formatMonthLong(monthKey(a.today));
      if (a.thisMonthMinor === 0) return `Nothing logged for ${month} yet.`;
      return `You have spent ${formatCurrencySymbol(a.thisMonthMinor, a.currency)} in ${month}, of which ${formatCurrencySymbol(a.fuel.thisMonthSpendMinor, a.currency)} was fuel across ${a.fuel.thisMonthFills} fill${a.fuel.thisMonthFills === 1 ? '' : 's'}.`;
    },
  },
  {
    test: /(per|\/)\s*(km|mile|kilometre)|running cost|cost per/i,
    answer: (a) => {
      if (a.ownership.costPerDistanceScaled === null) {
        return 'I need more distance before I can work out a cost per kilometre — log a couple of odometer readings and it appears.';
      }
      return `Running cost is ${formatRateSymbol(a.ownership.costPerDistanceScaled, a.currency)} per ${a.units.distance}, from ${formatCurrencySymbol(a.ownership.runningCostMinor, a.currency)} over ${formatDistance(a.ownership.distanceMetres, a.units.distance)}. Purchase price is kept out of that figure.`;
    },
  },
  {
    test: /(fuel|petrol|litres?).*(used|total|how much)|how much fuel/i,
    answer: (a) => {
      const totalMl = a.fuel.entries.reduce((sum, entry) => sum + entry.litresMl, 0);
      if (totalMl === 0) return 'No fuel logged yet.';
      return `You have logged ${formatVolume(totalMl, a.units.volume)} across ${a.fuel.entries.length} fill${a.fuel.entries.length === 1 ? '' : 's'}, at an average of ${formatPricePerVolumeSymbol(a.fuel.averagePricePerLitreMinor, a.currency)} per ${a.units.volume}.`;
    },
  },
  {
    test: /(part|pads|chain|tyre|tire).*(wear|worn|life|replace)|which parts/i,
    answer: (a) => {
      const active = a.parts.active;
      if (active.length === 0) return 'No parts are being tracked yet. Add one with its expected life and I will watch it for you.';
      const worn = active
        .filter((p) => p.life.isOverdue || (p.life.remainingPercent !== null && p.life.remainingPercent <= 20))
        .map((p) =>
          p.life.isOverdue
            ? `${p.part.name} is overdue by ${formatDistance(p.life.overdueMetres, a.units.distance)}`
            : `${p.part.name} has ${p.life.remainingPercent}% left`,
        );
      if (worn.length === 0) {
        return `All ${active.length} tracked part${active.length === 1 ? ' is' : 's are'} comfortably within their expected life.`;
      }
      return `Worth looking at: ${worn.join('; ')}.`;
    },
  },
  {
    test: /(odometer|distance|how far|kilometres|mileage total)/i,
    answer: (a) =>
      a.odometer.currentMetres === null
        ? 'No odometer reading recorded yet.'
        : `Your odometer reads ${formatDistance(a.odometer.currentMetres, a.units.distance)}, and you have covered ${formatDistance(a.odometer.totalDistanceMetres, a.units.distance)} since your first reading.`,
  },
  {
    test: /(service|workshop).*(history|last|spent)/i,
    answer: (a) => {
      if (a.services.all.length === 0) return 'No services recorded yet.';
      const last = a.services.all[0]!;
      return `Your last service was "${last.title}" on ${formatLongDate(last.date)}${last.selfService ? ' (self-service)' : last.workshop ? ` at ${last.workshop}` : ''}. You have spent ${formatCurrencySymbol(a.services.totalSpendMinor, a.currency)} on services in total.`;
    },
  },
];

export function answerQuestion(
  question: string,
  analytics: BikeAnalytics | null,
  context: AssistantContext = NO_DOCUMENTS,
): AssistantAnswer {
  if (analytics === null) {
    return { text: 'Add a motorcycle first and I can answer questions about it.', matched: false };
  }

  const trimmed = question.trim();
  if (trimmed === '') return { text: 'Ask me anything about this bike’s records.', matched: false };

  for (const intent of INTENTS) {
    if (intent.test.test(trimmed)) {
      return { text: intent.answer(analytics, context), matched: true };
    }
  }

  return {
    text: "I can only answer from what you've logged, and I don't recognise that one. Try asking about your next service, your average mileage, what you've spent this month, or your cost per kilometre.",
    matched: false,
  };
}

