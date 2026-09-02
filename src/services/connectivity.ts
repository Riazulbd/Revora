import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/**
 * Connectivity, as the rider experiences it.
 *
 * "Connected to Wi-Fi" is not the same as "the internet works", so a captive
 * portal counts as offline here. Nothing in the app blocks on this — Firestore
 * queues writes regardless — it only drives what the rider is told.
 */

export type Connectivity = {
  isOnline: boolean;
  /** Null until the first NetInfo reading arrives. */
  isKnown: boolean;
};

function readState(state: NetInfoState): boolean {
  if (state.isConnected === false) return false;
  // `isInternetReachable` is null while it is still being determined; treat that
  // as online so the app does not flash an offline banner on every cold start.
  return state.isInternetReachable !== false;
}

export function useConnectivity(): Connectivity {
  const [state, setState] = useState<Connectivity>({ isOnline: true, isKnown: false });

  useEffect(() => {
    let mounted = true;
    const unsubscribe = NetInfo.addEventListener((next) => {
      if (!mounted) return;
      setState({ isOnline: readState(next), isKnown: true });
    });
    NetInfo.fetch()
      .then((next) => {
        if (mounted) setState({ isOnline: readState(next), isKnown: true });
      })
      .catch(() => {
        // Leave the optimistic default in place.
      });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return state;
}

export async function isOnlineNow(): Promise<boolean> {
  try {
    return readState(await NetInfo.fetch());
  } catch {
    return true;
  }
}
