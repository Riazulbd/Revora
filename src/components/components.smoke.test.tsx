/**
 * Smoke-renders every shared component in both palettes, so a bad style value,
 * a View nested inside Text, or a missing icon glyph fails here rather than on
 * a rider's phone. Nothing about behaviour is asserted beyond "it renders".
 */
/* eslint-disable import/first -- jest.mock factories must precede the modules they replace */
import React from 'react';
import { act, create } from 'react-test-renderer';

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), back: jest.fn(), canGoBack: () => false }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native') as typeof import('react-native');
  const identity = <T,>(value: T) => value;
  const entering = { duration: () => ({}) };
  return {
    __esModule: true,
    default: { View: RN.View },
    useSharedValue: <T,>(value: T) => ({ value }),
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: identity,
    withRepeat: identity,
    Easing: { inOut: () => 0, ease: 0 },
    FadeInDown: entering,
    FadeOutDown: entering,
  };
});
jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

import { ThemeProvider, ForceDarkTheme } from '@/theme';
import {
  Badge,
  Banner,
  BarChart,
  Button,
  ButtonRow,
  Callout,
  Card,
  CardHeader,
  CheckRow,
  ChipGroup,
  ChoiceGrid,
  DateChip,
  DateField,
  DerivedField,
  Dialog,
  EmptyState,
  ErrorState,
  Eyebrow,
  Field,
  FieldRow,
  Footnote,
  Gauge,
  HeroCard,
  HeroFigure,
  HeroHead,
  Icon,
  IconSquareButton,
  Input,
  InsufficientData,
  KeyValueRow,
  LinkButton,
  ListCard,
  LoadingState,
  MenuRow,
  MiniBars,
  PhotoPanel,
  PhotoThumb,
  PickerField,
  ProBadge,
  ProgressBar,
  RecordRow,
  RowIcon,
  Screen,
  ScreenHeader,
  SearchBar,
  SectionEyebrow,
  Segmented,
  Sheet,
  SkeletonList,
  Sparkline,
  SpendBar,
  Stack,
  StatRow,
  StatTile,
  TabHeader,
  TextArea,
  Toggle,
  ToggleRow,
  ToastProvider,
  TrendChart,
  Txt,
} from '@/components';

const noop = () => undefined;

function Everything() {
  return (
    <ToastProvider>
      <Screen variant="tab" testID="screen-smoke">
        <TabHeader
          title="The Red One"
          subtitle="Bajaj Pulsar NS200 · Tue 16 Sep"
          action={
            <>
              <IconSquareButton icon="bell" count={3} accessibilityLabel="Notifications" onPress={noop} testID="cta-bell" />
              <IconSquareButton icon="camera" size={56} accessibilityLabel="Fast Capture" onPress={noop} testID="quick-capture" />
            </>
          }
        />
        <SearchBar onPress={noop} testID="cta-search" />
        <SearchBar value="oil" onChangeText={noop} onClear={noop} testID="input-search" />
        <HeroCard>
          <HeroHead eyebrow="Odometer" chip="Updated 3 days ago" />
          <HeroFigure value="34,712" unit="km" />
          <StatRow>
            <StatTile variant="hero" label="Mileage" value="41.2" sub="▲ 1.4 km/L" subTone="good" />
            <StatTile variant="hero" label="Cost / km" value="৳4.12" sub="all costs" />
            <StatTile variant="hero" label="Last fill" />
          </StatRow>
          <MiniBars values={[38, 40, 39, 41, 42]} height={80} reference={40} baseline="spread" />
        </HeroCard>
        <Sparkline values={[38, 40, 39, 41, 42]} />
        <Sparkline values={[38]} />
        <MiniBars values={[]} />
        <DateChip date="2026-09-13" />
        <Badge label="1 EXPIRING" tone="warn" icon="clock" />
        <CheckRow label="Engine oil & filter" description="Every 3,000 km" checked onChange={noop} />
        <Callout tone="good" title="Nothing needs your attention" body="No documents expiring, no rules due. Go ride." />
        <Callout tone="warn" lead="Can’t check what needs attention" message="until your records load." />
        <Banner tone="offline" lead="You’re offline." message="Fills you log now are saved on this phone and sync later." />
        <Banner tone="bad" lead="Not saved — litres is empty." message="Enter litres." link={{ label: 'Odometer history', onPress: noop }} />
        <Banner tone="good" lead="Motorcycle saved on this phone." message="It’ll sync." />
        <Banner tone="warn" label="OFFLINE" message="Legacy label form." compact />
        <Banner
          variant="plain"
          message="The current odometer isn’t edited here — it’s derived from readings."
          link={{ label: 'correct it in Odometer history', onPress: noop }}
        />
        <Banner variant="inset" message="After this change the current odometer stays 34,712 km." />
        <Card>
          <CardHeader title="Recent activity" action={<LinkButton label="View all" size="medium" onPress={noop} />} />
          <Eyebrow tone="bad">Needs attention</Eyebrow>
          <StatRow>
            <StatTile label="Fuel · Sep" value="৳2,840" />
            <StatTile label="Cost / km" />
            <StatTile label="Confidence" variant="centered" badge={<Badge variant="outlined" tone="good" label="HIGH" />} />
            <StatTile label="Mileage" variant="accent" value="41.2 km/L" />
            <StatTile label="Used" variant="outlined" value="1,702 km" tone="warn" />
            <StatTile label="Plan" badge={<Badge size="wide" tone="neutral" label="FREE" />} />
          </StatRow>
          <Gauge value={41.2} max={60} caption="km/L · measured 3 days ago" />
          <Gauge value={38} max={60} caption="km/L · estimated" estimated />
          <Gauge value={null} max={60} caption="—" />
          <TrendChart points={[{ value: 39, label: 'May' }, { value: 41, label: 'Jul' }, { value: 44, label: 'Sep' }]} />
          <BarChart data={[{ label: 'Apr', value: 3, caption: '3k' }, { label: 'Sep', value: 5, caption: '5k' }]} topLabel="6k" />
          <ProgressBar fraction={0.4} />
          <SpendBar category="Fuel" amount="৳2,840" fraction={0.7} />
          <InsufficientData title="Not enough data" message="Two more fills." />
        </Card>
        <Card variant="tinted" tone="accent">
          <Eyebrow>Current odometer</Eyebrow>
          <Input size="hero" value="6,214" unit="km" onChangeText={noop} testID="input-odometer" />
        </Card>
        <Card variant="dashed">
          <RecordRow variant="flush" title="16 Sep · 6,214 km" subtitle="8.2 L · Full tank" amount="৳1,004" badge={<Badge label="km/L later" />} />
        </Card>
        <SectionEyebrow first>Papers</SectionEyebrow>
        <SectionEyebrow top={20} tone="acc">
          What a fill looks like
        </SectionEyebrow>
        <Card variant="flush">
          <PhotoPanel onPress={noop} testID="photo-bike" />
          <PhotoPanel uri="file:///bike.jpg" height={180} />
        </Card>
        <PhotoThumb onPress={noop} testID="photo-thumb" />
        <PhotoThumb uri="file:///doc.jpg" width={56} height={72} radius={8} bordered tone="acc" />
        <ListCard testID="list-hub">
          <MenuRow label="Documents" icon="documents" iconTone="accent" onPress={noop} right={<Badge variant="outlined" tone="warn" label="1 EXPIRING" />} testID="hub-documents" />
          <MenuRow label="Your plan" leading={<ProBadge small />} dense onPress={noop} />
          <MenuRow label="Display name" subtitle="Tanvir" onPress={noop} />
          <RecordRow variant="flush" icon="drop" iconTone="bad" title="Engine oil" subtitle="Overdue by 310 km" subtitleTone="bad" onPress={noop} />
          <RecordRow variant="flush" icon="target" iconTone="bad" iconSize={32} dense title="Brakes marked action" subtitle="Front lever spongy" trailing={<Button label="Mark done" variant="tinted" size="micro" onPress={noop} />} />
          <RecordRow variant="flush" title="Full tank · Meghna Petrol" amount="৳1,004" subtitleContent={<Badge size="tag" tone="accent" label="Fuel" />} />
          <RecordRow title="Legacy card row" subtitle="still renders" leading={<RowIcon tone="good"><Icon name="check" /></RowIcon>} onPress={noop} />
          <KeyValueRow label="Litres" value="8.2 L · Full tank" />
          <ToggleRow title="This is a company bike" description="An employer covers part of the running cost" value onChange={noop} />
          <CheckRow label="Spillage" checked onChange={noop} />
        </ListCard>
        <Footnote>Status is recomputed from the current odometer.</Footnote>
        <ChipGroup options={[{ value: 'all', label: 'All fills' }, { value: 'full', label: 'Full', icon: 'clock' }]} value="all" onChange={noop} testID="chips" />
        <ChipGroup size="compact" options={[{ value: 'a', label: 'Oil' }]} value="a" onChange={noop} />
        <ChipGroup tone="warn" options={[{ value: 'a', label: 'Expiring' }]} value="a" onChange={noop} />
        <ChoiceGrid options={[{ value: 'a', label: 'Parking' }]} value={null} onChange={noop} />
        <Segmented options={[{ value: 'm', label: 'This month' }, { value: 'a', label: 'All time' }]} value="m" onChange={noop} size="compact" testID="seg" />
        <Segmented options={[{ value: 'km', label: 'km' }, { value: 'mi', label: 'mi' }]} value="km" onChange={noop} size="inline" />
        <Segmented
          options={[{ value: 'a', label: 'km/L' }, { value: 'b', label: 'L/100km' }, { value: 'c', label: 'mpg' }]}
          value="a"
          onChange={noop}
          size="inline"
          padX={10}
        />
        <FieldRow>
          <Field label="Date" icon="calendar" flex={1}>
            <DateField value="2026-09-16" onChange={noop} size="numeric" testID="input-date" />
            <DateField value={null} onChange={noop} size="compact" inset="bg" trailingIcon="chevronDown" />
          </Field>
          <Field label="Odometer" icon="odometer" flex={1.3} helper="helper">
            <Input size="numeric" value="34,712" unit="km" tone="warn" onChangeText={noop} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Litres" icon="drop" flex={1} error="Litres is empty">
            <Input size="numeric" value="" invalid onChangeText={noop} testID="input-litres" />
          </Field>
          <Field label="৳ / litre" flex={1}>
            <Input size="numeric" value="122.50" hint="last fill" hintTone="acc" onChangeText={noop} testID="input-price" />
          </Field>
          <Field label="Total" icon="banknote" flex={1}>
            <DerivedField value="1,004.50" />
          </Field>
        </FieldRow>
        <Input value="you@example.com" editable={false} onChangeText={noop} />
        <Input value="secret" secureTextEntry trailing={<IconSquareButton icon="eye" variant="plain" accessibilityLabel="Show password" onPress={noop} />} onChangeText={noop} />
        <Input size="compact" inset="bg" prefix="৳" value="0" onChangeText={noop} />
        <PickerField value="Bajaj" placeholder="Manufacturer" trailingIcon="chevronDown" onPress={noop} />
        <PickerField value="Rahim Motors" suffix="· from your history" weight="bold" size="compact" inset="bg" placeholder="Workshop" onPress={noop} />
        <PickerField value="13 Sep" size="mini" placeholder="Date" onPress={noop} />
        <FieldRow>
          <Input size="mini" inset value="34,712" onChangeText={noop} testID="input-correction" />
          <Input size="micro" value="9,200" prefix="৳" padX={12} onChangeText={noop} />
        </FieldRow>
        <TextArea value="" placeholder="Notes" onChangeText={noop} />
        <ButtonRow>
          <Button label="Save fill" size="xlarge" onPress={noop} testID="cta-save-fuel" />
          <Button label="Save changes" size="xlarge" subLabel="offline — saves on phone, syncs later" onPress={noop} />
        </ButtonRow>
        <Button label="Add fuel" icon="plus" size="compact" onPress={noop} />
        <Button label="Sign in" disabled onPress={noop} />
        <Button label="Sign in" loading loadingLabel="Signing in…" onPress={noop} />
        <Button label="Edit" variant="secondary" size="medium" onPress={noop} />
        <Button label="Delete" variant="ghost" tone="bad" size="medium" onPress={noop} />
        <Button label="Not now" variant="ghost" tone="mut" size="small" onPress={noop} />
        <Button label="Keep" variant="subtle" size="medium" onPress={noop} />
        <Button label="Open" variant="subtle" size="chip" onPress={noop} />
        <Button label="Remove" variant="danger" size="medium" onPress={noop} />
        <Button label="Add another" variant="dashed" onPress={noop} />
        <Button label="Remove accessory" variant="dangerSubtle" icon="cross" onPress={noop} />
        <Button label="Save changes" size="medium" radius={13} onPress={noop} />
        <LinkButton label="Show all fills" size="large" onPress={noop} />
        <EmptyState title="Your fills will live here" message="Log every fill." primaryAction={{ label: 'Log first fill', onPress: noop, testID: 'cta-first-fill' }} />
        <EmptyState size="compact" title="No partial fills" message="Every fill so far was a full tank." secondaryAction={{ label: 'Show all fills', onPress: noop }} />
        <EmptyState size="compact" icon="checkCircle" iconTone="good" title="Nothing needs your attention" message="Go ride." variant="page" />
        <EmptyState
          badge={<ProBadge wide />}
          title="The working behind every figure"
          message="Best and worst intervals, spending breakdowns, ownership cost."
          primaryAction={{ label: 'See Pro plans', onPress: noop, testID: 'cta-pro-plans' }}
        />
        <ErrorState title="Couldn’t load your records" message="Your data is safe on your account." onRetry={noop} testID="error" />
        <LoadingState title="Building your Proof Pack…" message="Rendering on this phone." />
        <SkeletonList />
        <Toggle value={false} onChange={noop} accessibilityLabel="Reminders" />
        <Stack>
          <Txt role="body">Stack child</Txt>
        </Stack>
        <ScreenHeader title="Edit fill" titleSuffix="· 13 Sep" subtitle="Three things to start." backTestID="cta-back" action={<Badge label="PRO" tone="accent" />} />
        <Dialog visible title="Remove tail box?" message="The record and its photo are deleted." confirmLabel="Remove" cancelLabel="Keep" destructive onConfirm={noop} onClose={noop} testID="dialog-remove">
          <Txt role="body">• Expected life (2,000 km) and the wear bar</Txt>
        </Dialog>
        <Sheet visible title="Ride more than one?" subtitle="Pro puts every bike on one account:" onClose={noop} testID="sheet-pro">
          <Txt role="body">Every motorcycle you own</Txt>
        </Sheet>
        <Sheet
          visible
          title="Mark engine oil done"
          subtitle="Early or late is fine — next due resets from what you enter."
          subtitleSize="small"
          onClose={noop}
          testID="sheet-complete"
        >
          <Icon name="odometer" size={44} opacity={0.55} />
        </Sheet>
      </Screen>
    </ToastProvider>
  );
}

describe('shared components', () => {
  it('render in the light palette', async () => {
    await act(async () => {
      create(
        <ThemeProvider>
          <Everything />
        </ThemeProvider>,
      );
    });
  });

  it('render in the dark palette', async () => {
    await act(async () => {
      create(
        <ThemeProvider>
          <ForceDarkTheme>
            <Everything />
          </ForceDarkTheme>
        </ThemeProvider>,
      );
    });
  });
});
