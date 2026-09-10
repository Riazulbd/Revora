import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

export const PRO_PRODUCT_ID = 'revora_pro';
export type PlayPurchase = { productId: string; purchaseToken: string; state: 'PURCHASED' | 'PENDING' | 'UNSPECIFIED' };
export type PlayPhase = { formattedPrice: string; billingPeriod: string; billingCycleCount: number; recurrenceMode: number };
export type PlayOffer = { basePlanId: string; offerToken: string; phases: PlayPhase[] };
export type PlayProduct = { productId: string; title: string; description: string; offers: PlayOffer[] };
export type PlayEvent = { responseCode: number; purchases: PlayPurchase[] };

interface Bridge {
  getSubscription(): Promise<PlayProduct>;
  queryPurchases(): Promise<PlayPurchase[]>;
  launchPurchase(offerToken: string, accountId: string): Promise<number>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}
const native = NativeModules.RevoraBilling as Bridge | undefined;
export const billingAvailable = Platform.OS === 'android' && native !== undefined;
function bridge(): Bridge {
  if (!billingAvailable || !native) throw new Error('Google Play subscriptions require the Android app from Google Play.');
  return native;
}
function timed<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Google Play did not respond. Try again.')), 30000);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
export const googlePlay = {
  getSubscription: () => timed(bridge().getSubscription()),
  queryPurchases: () => timed(bridge().queryPurchases()),
  launchPurchase: (offer: string, account: string) => timed(bridge().launchPurchase(offer, account)),
  subscribe(listener: (event: PlayEvent) => void): () => void {
    const subscription = new NativeEventEmitter(bridge()).addListener('RevoraBillingPurchases', listener);
    return () => subscription.remove();
  },
};
