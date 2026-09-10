import { GoogleAuth } from 'google-auth-library';
import type { PlaySubscription } from './domain';

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const base = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

export const play = {
  async get(packageName: string, token: string): Promise<PlaySubscription> {
    const client = await auth.getClient();
    const response = await client.request<PlaySubscription>({
      url: `${base}/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`,
      timeout: 15000,
    });
    return response.data;
  },
  async acknowledge(packageName: string, productId: string, token: string): Promise<void> {
    const client = await auth.getClient();
    await client.request({
      url: `${base}/${encodeURIComponent(packageName)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}:acknowledge`,
      method: 'POST', data: {}, timeout: 15000,
    });
  },
};
