import React from 'react';
import { View } from 'react-native';

import { log } from '@/services/logger';
import { Button } from './Button';
import { Icon } from './Icon';
import { Txt } from './Text';
import { useTheme } from '@/theme';

type State = { error: Error | null };

/**
 * The last line of defence.
 *
 * A render crash shows a Revora-shaped screen with a way out, never a red box or
 * a white void. The error text itself is never shown — it goes to the logger,
 * which redacts before it prints.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error) {
    log.error('boundary', 'render failed', { message: error.message });
  }

  private reset = () => this.setState({ error: null });

  override render() {
    if (!this.state.error) return this.props.children;
    return <Fallback onReset={this.reset} />;
  }
}

function Fallback({ onReset }: { onReset: () => void }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.bg,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        gap: 16,
      }}
    >
      <View
        style={{
          width: 66,
          height: 66,
          borderRadius: 33,
          backgroundColor: c.badS,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="alert" size={28} color={c.bad} strokeWidth={2.2} />
      </View>
      <Txt role="cardTitle" align="center">
        Something went wrong
      </Txt>
      <Txt role="body" tone="mut" align="center">
        Revora hit an unexpected problem on this screen. Your logged data is safe on this device.
      </Txt>
      <Button label="Try again" onPress={onReset} size="medium" style={{ height: 48 }} />
    </View>
  );
}
