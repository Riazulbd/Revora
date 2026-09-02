import { useEffect, useState } from 'react';
import mobileAds, { AdsConsent } from 'react-native-google-mobile-ads';

import { log } from '@/services/logger';

/**
 * Google Mobile Ads bootstrap.
 *
 * Runs once, only when a screen actually wants to show an ad — Pro riders never
 * initialise the SDK at all. Consent is gathered first (the UMP form shows only
 * where regulation requires it and is a no-op elsewhere), then the SDK starts.
 *
 * Every failure path ends with `ready: false` and no ad: an ad that cannot load
 * must cost the rider nothing, so nothing here throws and nothing blocks.
 */

let started: Promise<boolean> | null = null;

async function start(): Promise<boolean> {
  try {
    // Ask for (or refresh) consent where required. On an error — offline, or a
    // region with no requirement — ads still run in non-personalised mode.
    await AdsConsent.gatherConsent().catch((error) => {
      log.warn('ads', 'consent gathering skipped', { error: String(error) });
    });
    await mobileAds().initialize();
    return true;
  } catch (error) {
    log.warn('ads', 'initialise failed', { error: String(error) });
    return false;
  }
}

export function useAds(enabled: boolean): { ready: boolean } {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    if (started === null) started = start();
    void started.then((ok) => {
      if (!cancelled) setReady(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { ready };
}

/** The one banner unit Revora uses, on the Free-plan dashboard. */
export const DASHBOARD_BANNER_UNIT_ID = 'ca-app-pub-6481334810994565/2418053387';
