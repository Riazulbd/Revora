/**
 * Audit section 14 — Android usability & accessibility, static half.
 *
 * Every expected number below is a literal computed by hand from the design /
 * source comments; nothing calls the module under test to derive an expectation.
 *
 * Rendered with react-test-renderer because @testing-library/react-native 14's
 * peer package `test-renderer` is not installed in this repo.
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from '@/theme';
import { Button, LinkButton } from '@/components/Button';
import { Toggle, CheckRow } from '@/components/Toggle';
import { ChipGroup, Segmented } from '@/components/Segmented';
import { MenuRow } from '@/components/Rows';
import { CopyButton } from '@/components/Copyable';
import { useRecordMutation, type RecordMutation } from '@/features/shared/useRecordMutation';


jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: { View: RN.View },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: (fn: () => object) => fn(),
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    Easing: { inOut: () => undefined, ease: undefined },
  };
});
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => undefined) }));
const mockToastShow = jest.fn();
jest.mock('@/components/Toast', () => ({ useToast: () => ({ show: mockToastShow }) }));
jest.mock('@/components', () => ({ useToast: () => ({ show: mockToastShow }) }));
jest.mock('@/services/syncStatus', () => ({ trackWrite: jest.fn() }));


function mount(ui: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<ThemeProvider>{ui}</ThemeProvider>);
  });
  return tree;
}

/** The host View that a Pressable renders (string type = host component). */
function hostByTestId(tree: ReactTestRenderer, testID: string): ReactTestInstance {
  return tree.root.find((n) => typeof n.type === 'string' && n.props.testID === testID);
}
function hostByLabel(tree: ReactTestRenderer, label: string): ReactTestInstance {
  return tree.root.find((n) => typeof n.type === 'string' && n.props.accessibilityLabel === label);
}
function flat(node: ReactTestInstance): Record<string, unknown> {
  return StyleSheet.flatten(node.props.style) as Record<string, unknown>;
}
/** Text content beneath a node, joined. */
function textOf(node: ReactTestInstance): string {
  return node
    .findAll((n) => typeof n.type === 'string' && String(n.type) === 'Text')
    .flatMap((t) => React.Children.toArray(t.props.children))
    .filter((c): c is string => typeof c === 'string')
    .join('');
}

describe('A11Y-01 Button swallows a synchronous double tap', () => {
  it('two presses inside 600 ms call onPress once', () => {
    const onPress = jest.fn();
    const tree = mount(<Button label="Save fuel" onPress={onPress} testID="cta" />);
    const host = hostByTestId(tree, 'cta');
    // Pressability's onClick honours `disabled`, the same path a platform click takes.
    expect(typeof host.props.onClick).toBe('function');
    act(() => { host.props.onClick({}); });
    act(() => { hostByTestId(tree, 'cta').props.onClick({}); });
    // expected: 1 (second press is < 600 ms after the first)
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a press while an async handler is in flight is ignored', async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((r) => { resolve = r; });
    const onPress = jest.fn(() => pending);
    const realNow = Date.now;
    let now = 1_000_000;
    Date.now = () => now;
    try {
      const tree = mount(<Button label="Save fuel" onPress={onPress} testID="cta" />);
      act(() => { hostByTestId(tree, 'cta').props.onClick({}); });
      now += 1_000; // well past the 600 ms debounce; only the in-flight guard remains
      const host = hostByTestId(tree, 'cta');
      // expected: while busy the host is disabled
      expect(host.props.accessibilityState).toEqual({ disabled: true, busy: true });
      act(() => { host.props.onClick({}); });
      // expected: still 1 — the second click was dropped by the disabled guard
      expect(onPress).toHaveBeenCalledTimes(1);
      await act(async () => { resolve(); await pending; });
      // expected: after settle, re-enabled
      expect(hostByTestId(tree, 'cta').props.accessibilityState).toEqual({ disabled: false, busy: false });
      expect(onPress).toHaveBeenCalledTimes(1);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('A11Y-02 Button keeps its accessible name while loading', () => {
  it('a loading Save button still exposes "Save fuel" to TalkBack', () => {
    const tree = mount(<Button label="Save fuel" onPress={() => undefined} loading testID="cta" />);
    const host = hostByTestId(tree, 'cta');
    const name = host.props.accessibilityLabel ?? textOf(host);
    // expected: "Save fuel" — either an explicit accessibilityLabel or visible text
    expect(name).toBe('Save fuel');
  });
});

describe('A11Y-03 useRecordMutation refuses an overlapping submit', () => {
  it('second submit while first is in flight resolves null without running mutationFn', async () => {
    let resolve!: (v: string) => void;
    const first = new Promise<string>((r) => { resolve = r; });
    const mutationFn = jest.fn(() => first);
    const client = new QueryClient();
    const captured = { current: null as RecordMutation<void, string> | null };
    function Probe() {
      const m = useRecordMutation<void, string>({ mutationFn });
      const ref = useRef(m);
      ref.current = m;
      useEffect(() => { captured.current = ref.current; });
      captured.current = m;
      return null;
    }
    act(() => {
      create(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
    });
    let p1!: Promise<string | null>;
    let p2!: Promise<string | null>;
    await act(async () => {
      p1 = captured.current!.submit();
      p2 = captured.current!.submit();
      await p2;
    });
    // expected: second call short-circuits to null
    await expect(p2).resolves.toBeNull();
    // expected: 1 — the write ran exactly once
    expect(mutationFn).toHaveBeenCalledTimes(1);
    await act(async () => { resolve('ok'); await p1; });
    await expect(p1).resolves.toBe('ok');
  });
});

describe('A11Y-04 touch targets: explicit height/minHeight >= HIT_SIZE (44)', () => {
  const noop = () => undefined;
  const dim = (s: Record<string, unknown>) => Number(s.minHeight ?? s.height);

  it('Button size=small renders 44 high', () => {
    const tree = mount(<Button label="Edit" size="small" onPress={noop} testID="t" />);
    expect(flat(hostByTestId(tree, 't')).height).toBe(44); // design: 44 compact
  });
  it('Segmented option has minHeight 44', () => {
    const tree = mount(<Segmented options={[{ value: 'a', label: 'Full' }, { value: 'b', label: 'Partial' }]} value="a" onChange={noop} testID="seg" />);
    expect(flat(hostByLabel(tree, 'Full')).minHeight).toBe(44);
  });
  it('MenuRow has minHeight 48', () => {
    const tree = mount(<MenuRow label="Accessories" onPress={noop} testID="t" />);
    expect(flat(hostByTestId(tree, 't')).minHeight).toBe(48);
  });
  it('CheckRow has minHeight 46', () => {
    const tree = mount(<CheckRow label="Exclude" checked={false} onChange={noop} testID="t" />);
    expect(flat(hostByTestId(tree, 't')).minHeight).toBe(46);
  });
  it('Toggle explicit height is >= 44', () => {
    const tree = mount(<Toggle value={false} onChange={noop} accessibilityLabel="Dark mode" testID="t" />);
    // source: 46x26 track; hitSlop 10 each side → effective 26 + 10 + 10 = 46. Explicit box is 26.
    expect(dim(flat(hostByTestId(tree, 't')))).toBeGreaterThanOrEqual(44);
  });
  it('ChipGroup pill explicit minHeight is >= 44', () => {
    const tree = mount(<ChipGroup options={[{ value: 'a', label: 'All fills' }]} value="a" onChange={noop} />);
    const pill = tree.root.find((n) => typeof n.type === 'string' && n.props.accessibilityRole === 'button');
    // source: minHeight 32; hitSlop top/bottom 6 → effective 32 + 6 + 6 = 44.
    expect(dim(flat(pill))).toBeGreaterThanOrEqual(44);
  });
  it('CopyButton explicit minHeight is >= 44', () => {
    const tree = mount(<CopyButton label="Chassis number" value="ABC123" testID="t" />);
    // source: minHeight HIT_SIZE - 12 = 44 - 12 = 32; hitSlop 8 → effective 32 + 8 + 8 = 48.
    expect(dim(flat(hostByTestId(tree, 't')))).toBeGreaterThanOrEqual(44);
  });
  it('LinkButton has an explicit height', () => {
    const tree = mount(<LinkButton label="Analytics" onPress={noop} testID="t" />);
    // source: no height/minHeight; 11.5px text + hitSlop 10 → roughly 14 + 10 + 10 = 34 < 44.
    expect(Number.isFinite(dim(flat(hostByTestId(tree, 't'))))).toBe(true);
  });
});
