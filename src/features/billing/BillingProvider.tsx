import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Application from 'expo-application';
import { useAuth } from '@/features/auth/AuthProvider';
import { callBackend } from '@/services/backend';
import { billingAvailable, googlePlay, PRO_PRODUCT_ID, type PlayProduct, type PlayPurchase } from './googlePlay';
import { billingResponseMessage } from './presentation';

type BillingContextValue = {
  product: PlayProduct | null; loading: boolean; busy: boolean; pending: boolean;
  message: string | null; error: string | null; canPurchase: boolean;
  reload: () => Promise<void>; restore: () => Promise<void>;
  upgrade: (offerToken: string) => Promise<void>; manage: () => Promise<void>;
};
const BillingContext = createContext<BillingContextValue | null>(null);
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Could not connect to Google Play. Try again.';

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Account changes dispose listeners and outstanding UI work from the old session.
  return <BillingSession key={`${user?.uid}:${user?.isAnonymous}`} uid={user && !user.isAnonymous ? user.uid : null}>{children}</BillingSession>;
}

function BillingSession({ uid, children }: { uid: string | null; children: React.ReactNode }) {
  const [product, setProduct] = useState<PlayProduct | null>(null);
  const [loading, setLoading] = useState(billingAvailable);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const restoring = useRef<Promise<void> | null>(null);
  const verifying = useRef(new Map<string, Promise<void>>());
  const purchasing = useRef(false);

  const reload = useCallback(async () => {
    if (!billingAvailable) { setLoading(false); return; }
    setLoading(true);
    try {
      const next = await googlePlay.getSubscription();
      if (!alive.current) return;
      setProduct(next);
      setError(next.offers.length ? null : 'No subscription plans are currently available for this Google Play account.');
    } catch (cause) { if (alive.current) { setProduct(null); setError(messageOf(cause)); } }
    finally { if (alive.current) setLoading(false); }
  }, []);

  const processPurchases = useCallback(async (purchases: PlayPurchase[]) => {
    if (!uid) return;
    const relevant = purchases.filter(purchase => purchase.productId === PRO_PRODUCT_ID);
    if (alive.current) setPending(relevant.some(purchase => purchase.state === 'PENDING'));
    const results = await Promise.allSettled(relevant.map(async purchase => {
      if (purchase.state === 'PENDING') {
        if (alive.current) setMessage('Payment is pending in Google Play. Pro starts after payment completes and is verified.');
        return; // Never grant or acknowledge a pending purchase.
      }
      if (purchase.state !== 'PURCHASED') return;
      const existing = verifying.current.get(purchase.purchaseToken);
      if (existing) return existing;
      const work = (async () => {
        if (alive.current) setMessage('Verifying your subscription…');
        await callBackend('verifyGooglePlayPurchase', {
          userId: uid, productId: purchase.productId, purchaseToken: purchase.purchaseToken,
        }, uid);
        if (alive.current) setMessage('Purchase verified. Your plan is synchronized with your Revora account.');
      })();
      verifying.current.set(purchase.purchaseToken, work);
      try { await work; } finally { verifying.current.delete(purchase.purchaseToken); }
    }));
    const failure = results.find(result => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
  }, [uid]);

  const restore = useCallback((): Promise<void> => {
    if (!uid || !billingAvailable) return Promise.resolve();
    if (restoring.current) return restoring.current;
    const work = (async () => {
      if (alive.current) { setBusy(true); setError(null); }
      try {
        // Server sync runs even if the Play store cannot be reached on this device.
        const results = await Promise.allSettled([
          googlePlay.queryPurchases().then(processPurchases),
          callBackend('syncGooglePlayEntitlement', {}, uid),
        ]);
        const failure = results.find(result => result.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
      } catch (cause) {
        if (alive.current) { setMessage(null); setError(messageOf(cause)); }
      } finally { if (alive.current) setBusy(false); restoring.current = null; }
    })();
    restoring.current = work;
    return work;
  }, [uid, processPurchases]);

  useEffect(() => {
    alive.current = true;
    // Starting native/server I/O is the purpose of this lifecycle effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    void restore();
    const unsubscribe = billingAvailable ? googlePlay.subscribe(event => {
      if (!uid) return;
      purchasing.current = false;
      setError(null);
      if (event.responseCode !== 0) {
        setBusy(false);
        setMessage(billingResponseMessage(event.responseCode));
        if (event.responseCode === 7) void restore();
        return;
      }
      setBusy(true);
      void processPurchases(event.purchases).catch(cause => {
        if (alive.current) { setMessage(null); setError(messageOf(cause)); }
      }).finally(() => { if (alive.current) setBusy(false); });
    }) : () => undefined;
    const resume = AppState.addEventListener('change', state => {
      if (state === 'active') { purchasing.current = false; void restore(); void reload(); }
    });
    let wasOffline = false;
    const network = NetInfo.addEventListener(state => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (online && wasOffline) { void restore(); void reload(); }
      wasOffline = !online;
    });
    // Repairs verification failures and pending payments while the screen stays open.
    const timer = setInterval(() => {
      if (AppState.currentState === 'active' && !purchasing.current) void restore();
    }, 60000);
    return () => { alive.current = false; unsubscribe(); resume.remove(); network(); clearInterval(timer); };
  }, [uid, reload, restore, processPurchases]);

  const upgrade = useCallback(async (offerToken: string) => {
    if (!uid || purchasing.current || busy || pending) return;
    purchasing.current = true;
    setBusy(true); setError(null); setMessage(null);
    try {
      const prepared = await callBackend<{ obfuscatedAccountId: string }>('prepareGooglePlayPurchase', {}, uid);
      if (!alive.current) return;
      const code = await googlePlay.launchPurchase(offerToken, prepared.obfuscatedAccountId);
      if (!alive.current) return;
      if (code !== 0) {
        purchasing.current = false; setBusy(false); setMessage(billingResponseMessage(code));
        if (code === 7) await restore();
      }
    } catch (cause) {
      purchasing.current = false;
      if (alive.current) { setBusy(false); setError(messageOf(cause)); }
    }
  }, [uid, busy, pending, restore]);

  const manage = useCallback(async () => {
    try {
      await Linking.openURL(`https://play.google.com/store/account/subscriptions?sku=${PRO_PRODUCT_ID}&package=${encodeURIComponent(Application.applicationId ?? '')}`);
    } catch { setError('Could not open Google Play. Open Play Store → Payments & subscriptions → Subscriptions.'); }
  }, []);

  return <BillingContext.Provider value={{ product, loading, busy, pending, message, error,
    canPurchase: !!uid && billingAvailable, reload, restore, upgrade, manage }}>{children}</BillingContext.Provider>;
}

export function useBilling() {
  const value = useContext(BillingContext);
  if (!value) throw new Error('useBilling requires BillingProvider');
  return value;
}
