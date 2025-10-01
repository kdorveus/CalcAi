import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WEBHOOK_ENDPOINTS, STORAGE_KEYS } from '../constants/Config';

/**
 * Sends data to a webhook URL through the Cloudflare Worker proxy
 * This ensures server-side validation of premium status and rate limiting
 */
export async function sendWebhook(webhookUrl: string, data: any): Promise<{ success: boolean; error?: string }> {
  try {
    // Get session token
    const token = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
    
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    // Send through worker proxy
    const response = await axios.post(
      WEBHOOK_ENDPOINTS.SEND,
      {
        webhookUrl,
        data,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 10000,
      }
    );

    return { success: true };
  } catch (error: any) {
    if (error.response?.status === 403) {
      return { success: false, error: 'Premium subscription required' };
    }
    return { success: false, error: error.message || 'Webhook failed' };
  }
}

/**
 * Sends data to multiple webhook URLs in parallel
 */
export async function sendWebhookBatch(
  webhookUrls: string[],
  data: any
): Promise<{ successes: number; failures: number }> {
  const promises = webhookUrls.map(url => sendWebhook(url, data));
  const results = await Promise.allSettled(promises);
  
  const successes = results.filter(
    r => r.status === 'fulfilled' && r.value.success
  ).length;
  const failures = results.length - successes;
  
  return { successes, failures };
}
