/**
 * Smoke-renders the maintenance pieces the boards added, in both palettes and
 * in every branch each of them draws. A View nested inside a Text, a missing
 * glyph or a bad style value fails here rather than on a rider's phone.
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

import { ForceDarkTheme, ThemeProvider } from '@/theme';
import { MaintenanceCompletionSheet } from './MaintenanceCompletionSheet';
import { MaintenanceInlineField, MaintenanceNumberField } from './MaintenanceFields';
import { MaintenanceGlyph, type MaintenanceGlyphName } from './MaintenanceGlyph';
import { MaintenancePicker } from './MaintenancePicker';

const noop = () => {};

const GLYPHS: readonly MaintenanceGlyphName[] = ['oil', 'chain', 'filter', 'plug', 'brake', 'off', 'generic'];

const BRANDS = [{ key: 'a', label: 'Shell Advance AX7 10W-40', note: 'used last time' }];
const WORKSHOPS = [{ key: 'Rahim Motors', label: 'Rahim Motors', note: 'from your history' }];

function Everything() {
  return (
    <>
      {GLYPHS.map((name) => (
        <MaintenanceGlyph key={name} name={name} color="#F4511E" />
      ))}

      <MaintenanceNumberField value="34712" onChangeText={noop} unit="km" accessibilityLabel="Odometer" />
      <MaintenanceInlineField label="Qty" value="1.2" onChangeText={noop} suffix="L" />
      <MaintenanceInlineField label="Price" value="" onChangeText={noop} prefix="৳" placeholder="0" />

      {/* open, closed, typing-your-own, and nothing-in-the-history-yet */}
      {[true, false].map((open) => (
        <MaintenancePicker
          key={String(open)}
          options={BRANDS}
          selectedKey="a"
          onSelect={noop}
          open={open}
          onOpenChange={noop}
          custom=""
          onCustomChange={noop}
          customPlaceholder="AMSOIL"
          otherLabel="Other — type a brand"
          backLabel="Pick one you’ve used before"
          placeholder="Which brand went in?"
          accessibilityLabel="Brand"
          testID="picker-open"
        />
      ))}
      <MaintenancePicker
        options={BRANDS}
        selectedKey={null}
        onSelect={noop}
        open={false}
        onOpenChange={noop}
        custom="Motul"
        onCustomChange={noop}
        customPlaceholder="AMSOIL"
        otherLabel="Other — type a brand"
        backLabel="Pick one you’ve used before"
        placeholder="Which brand went in?"
        accessibilityLabel="Brand"
        testID="picker-typing"
      />
      <MaintenancePicker
        options={[]}
        selectedKey={null}
        onSelect={noop}
        open={false}
        onOpenChange={noop}
        custom=""
        onCustomChange={noop}
        customPlaceholder="AMSOIL"
        otherLabel="Other — type a brand"
        backLabel="Pick one you’ve used before"
        placeholder="Which brand went in?"
        height={48}
        inset="bg"
        accessibilityLabel="Brand"
        testID="picker-empty"
      />

      <MaintenanceCompletionSheet
        visible
        onClose={noop}
        ruleName="Engine oil"
        glyph="oil"
        date="2026-09-16"
        onDateChange={noop}
        odometer="34712"
        onOdometerChange={noop}
        distanceLabel="km"
        place="workshop"
        onPlaceChange={noop}
        workshopOptions={WORKSHOPS}
        workshopKey="Rahim Motors"
        onWorkshopKeyChange={noop}
        workshopCustom=""
        onWorkshopCustomChange={noop}
        brandOptions={BRANDS}
        brandKey="a"
        onBrandKeyChange={noop}
        brandCustom=""
        onBrandCustomChange={noop}
        brandPlaceholder="AMSOIL"
        quantity="1.2"
        onQuantityChange={noop}
        quantityUnit="L"
        cost="780"
        onCostChange={noop}
        currencyLabel="৳"
        nextDueLine="The next due point moves to 8,000 km."
        busy={false}
        onConfirm={noop}
      />

      {/* Self-service hides the workshop field entirely. */}
      <MaintenanceCompletionSheet
        visible
        onClose={noop}
        ruleName="Chain clean, lube & tension"
        glyph="chain"
        date="2026-09-16"
        onDateChange={noop}
        odometer=""
        onOdometerChange={noop}
        distanceLabel="km"
        place="self"
        onPlaceChange={noop}
        workshopOptions={[]}
        workshopKey={null}
        onWorkshopKeyChange={noop}
        workshopCustom=""
        onWorkshopCustomChange={noop}
        brandOptions={[]}
        brandKey={null}
        onBrandKeyChange={noop}
        brandCustom=""
        onBrandCustomChange={noop}
        brandPlaceholder="DID"
        quantity=""
        onQuantityChange={noop}
        quantityUnit="pcs"
        cost=""
        onCostChange={noop}
        currencyLabel="৳"
        nextDueLine={null}
        busy={false}
        onConfirm={noop}
      />
    </>
  );
}

describe('maintenance UI', () => {
  it('renders in the light palette', async () => {
    await act(async () => {
      create(
        <ThemeProvider>
          <Everything />
        </ThemeProvider>,
      );
    });
  });

  it('renders in the dark palette', async () => {
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
