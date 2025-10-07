import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform, ToastAndroid, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { sendWebhook } from '../utils/webhookService';

interface WebhookItem {
  url: string;
  active: boolean;
  title?: string;
}

interface UseWebhookManagerReturn {
  webhookUrls: WebhookItem[];
  setWebhookUrls: React.Dispatch<React.SetStateAction<WebhookItem[]>>;
  newWebhookUrl: string;
  setNewWebhookUrl: React.Dispatch<React.SetStateAction<string>>;
  newWebhookTitle: string;
  setNewWebhookTitle: React.Dispatch<React.SetStateAction<string>>;
  sendEquation: boolean;
  setSendEquation: React.Dispatch<React.SetStateAction<boolean>>;
  streamResults: boolean;
  setStreamResults: React.Dispatch<React.SetStateAction<boolean>>;
  bulkData: any[];
  setBulkData: React.Dispatch<React.SetStateAction<any[]>>;
  isSendingBulk: boolean;
  webhookSettingsLoaded: boolean;
  handleAddWebhook: () => void;
  handleDeleteWebhook: (url: string) => void;
  handleToggleWebhook: (url: string, active: boolean) => void;
  handleSendBulkData: () => Promise<void>;
  sendWebhookData: (equation: string, result: string) => Promise<void>;
  saveSettings: () => Promise<void>;
  sanitizeInput: (input: string) => string;
  validateWebhookUrl: (url: string) => string | null;
}

export const useWebhookManager = (
  t: (key: string) => string,
  bubbleIdRef: React.MutableRefObject<number>
): UseWebhookManagerReturn => {
  const [webhookUrls, setWebhookUrls] = useState<WebhookItem[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState<string>('');
  const [newWebhookTitle, setNewWebhookTitle] = useState<string>('');
  const [sendEquation, setSendEquation] = useState<boolean>(true);
  const [streamResults, setStreamResults] = useState<boolean>(true);
  const [bulkData, setBulkData] = useState<any[]>([]);
  const [isSendingBulk, setIsSendingBulk] = useState<boolean>(false);
  const [webhookSettingsLoaded, setWebhookSettingsLoaded] = useState<boolean>(false);
  const pendingWebhookDataRef = useRef<{ equation: string; result: string }[]>([]);

  // Defer webhook settings loading to not block initial render
  useEffect(() => {
    const loadWebhookSettings = async () => {
      try {
        const [storedUrls, storedSendEquation, storedStreamResults] = await Promise.all([
          AsyncStorage.getItem('webhookUrls'),
          AsyncStorage.getItem('sendEquation'),
          AsyncStorage.getItem('streamResults'),
        ]);

        // Use requestAnimationFrame to defer state updates
        requestAnimationFrame(() => {
          if (storedUrls) {
            const parsedUrls = JSON.parse(storedUrls);
            const webhookItems = parsedUrls.map((url: string | WebhookItem) => {
              if (typeof url === 'string') {
                return { url, active: true };
              }
              return url;
            });
            setWebhookUrls(webhookItems);
          }

          if (storedSendEquation) {
            setSendEquation(JSON.parse(storedSendEquation));
          }

          if (storedStreamResults) {
            setStreamResults(JSON.parse(storedStreamResults));
          }

          setWebhookSettingsLoaded(true);
        });
      } catch (error) {
        setWebhookSettingsLoaded(true);
      }
    };

    // Defer loading by 150ms to prioritize initial render
    const timer = setTimeout(loadWebhookSettings, 150);
    return () => clearTimeout(timer);
  }, []);

  // Helper function to sanitize user input
  const sanitizeInput = useCallback((input: string): string => {
    if (!input) return '';

    let sanitized = input.replace(/<[^>]*>/g, '');

    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    return sanitized.substring(0, 1000);
  }, []);

  // Helper function to validate webhook URLs
  const validateWebhookUrl = useCallback((url: string): string | null => {
    try {
      if (!url || typeof url !== 'string') return null;
      if (!url.startsWith('http://') && !url.startsWith('https://')) return null;

      const parsedUrl = new URL(url);

      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return null;

      return url;
    } catch (e) {
      return null;
    }
  }, []);

  // Send data to webhooks
  const sendWebhookData = useCallback(
    async (equation: string, result: string) => {
      if (!webhookSettingsLoaded) {
        pendingWebhookDataRef.current.push({
          equation: sanitizeInput(equation),
          result: sanitizeInput(result),
        });
        return;
      }

      const activeWebhooks = webhookUrls.filter((webhook) => webhook.active);

      if (activeWebhooks.length === 0) {
        pendingWebhookDataRef.current.push({
          equation: sanitizeInput(equation),
          result: sanitizeInput(result),
        });
        return;
      }

      const sanitizedEquation = sanitizeInput(equation);
      const sanitizedResult = sanitizeInput(result);

      const dataToSend = {
        equation: sendEquation ? sanitizedEquation : undefined,
        result: sanitizedResult,
      };

      if (streamResults) {
        try {
          const promises = activeWebhooks
            .map((webhook) => {
              const validatedUrl = validateWebhookUrl(webhook.url);
              if (!validatedUrl) {
                console.warn('Invalid webhook URL detected:', webhook.url);
                return Promise.resolve();
              }

              return axios.post(validatedUrl, dataToSend, {
                headers: {
                  'Content-Type': 'application/json',
                  'X-Requested-With': 'XMLHttpRequest',
                },
                timeout: 5000,
              });
            })
            .filter(Boolean);

          await Promise.allSettled(promises);
        } catch (error) {
          if (Platform.OS === 'android') {
            ToastAndroid.show(t('mainApp.couldNotSendData'), ToastAndroid.SHORT);
          }
        }
      } else {
        const newItem = {
          id: bubbleIdRef.current++,
          timestamp: Date.now(),
          data: JSON.stringify(dataToSend),
        };
        setBulkData((prev) => [...prev, newItem]);
      }
    },
    [webhookSettingsLoaded, webhookUrls, sendEquation, streamResults, sanitizeInput, validateWebhookUrl, t, bubbleIdRef]
  );

  // Handle adding webhook
  const handleAddWebhook = useCallback(() => {
    const trimmedUrl = newWebhookUrl.trim();
    const trimmedTitle = newWebhookTitle.trim();
    const urlExists = webhookUrls.some((webhook) => webhook.url === trimmedUrl);

    if (trimmedUrl && !urlExists) {
      if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
        const newWebhook = {
          url: trimmedUrl,
          active: true,
          title: trimmedTitle || undefined,
        };
        setWebhookUrls([...webhookUrls, newWebhook]);
        setNewWebhookUrl('');
        setNewWebhookTitle('');
      } else {
        Alert.alert(t('mainApp.invalidUrl'), t('mainApp.invalidUrlMessage'));
      }
    } else if (urlExists) {
      Alert.alert(t('mainApp.duplicate'), t('mainApp.duplicateUrlMessage'));
    } else {
      Alert.alert(t('mainApp.invalidUrl'), t('mainApp.invalidUrlMessage'));
    }
  }, [newWebhookUrl, newWebhookTitle, webhookUrls, t]);

  // Handle deleting webhook
  const handleDeleteWebhook = useCallback(
    (urlToDelete: string) => {
      setWebhookUrls(webhookUrls.filter((webhook) => webhook.url !== urlToDelete));
    },
    [webhookUrls]
  );

  // Handle toggling webhook
  const handleToggleWebhook = useCallback(
    (url: string, active: boolean) => {
      setWebhookUrls(webhookUrls.map((webhook) => (webhook.url === url ? { ...webhook, active } : webhook)));
    },
    [webhookUrls]
  );

  // Handle sending bulk data
  const handleSendBulkData = useCallback(async () => {
    if (bulkData.length === 0) {
      Alert.alert(t('mainApp.noData'), t('mainApp.noDataMessage'));
      return;
    }
    const activeWebhooks = webhookUrls.filter((webhook) => webhook.active);
    if (activeWebhooks.length === 0) {
      Alert.alert(t('mainApp.noActiveUrls'), t('mainApp.noActiveUrlsMessage'));
      return;
    }

    setIsSendingBulk(true);
    let successCount = 0;
    let failureCount = 0;

    try {
      const bulkSendPromises = bulkData.map((item) => {
        const itemData = { data: item.data };
        const urlPromises: Promise<any>[] = [];

        for (const webhook of activeWebhooks) {
          const webhookUrl: string = webhook.url;

          const promise = sendWebhook(webhookUrl, itemData)
            .then((response) => {
              const successPayload = {
                url: webhookUrl,
                response: response,
              };
              return successPayload;
            })
            .catch((error) => {
              const failurePayload = {
                url: webhookUrl,
                error: error,
              };
              throw failurePayload;
            });

          urlPromises.push(promise);
        }

        return Promise.allSettled(urlPromises);
      });

      const allItemsResults = await Promise.allSettled(bulkSendPromises);

      for (let i = 0; i < allItemsResults.length; i++) {
        const itemOutcome = allItemsResults[i];

        if (itemOutcome.status === 'fulfilled') {
          const urlResults = itemOutcome.value;

          for (let j = 0; j < urlResults.length; j++) {
            const urlOutcome = urlResults[j];

            if (urlOutcome.status === 'fulfilled') {
              successCount++;
            } else {
              failureCount++;
            }
          }
        } else {
          failureCount += activeWebhooks.length;
        }
      }

      setBulkData([]);

      Alert.alert(
        t('mainApp.bulkSendComplete'),
        `Successfully sent data to ${successCount} endpoints.\nFailed to send data to ${failureCount} endpoints.`
      );
    } catch (error) {
      Alert.alert(t('mainApp.bulkSendError'), t('mainApp.bulkSendErrorMessage'));
    } finally {
      setIsSendingBulk(false);
    }
  }, [bulkData, webhookUrls, t]);

  // Save settings
  const saveSettings = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.setItem('webhookUrls', JSON.stringify(webhookUrls)),
        AsyncStorage.setItem('sendEquation', JSON.stringify(sendEquation)),
        AsyncStorage.setItem('streamResults', JSON.stringify(streamResults)),
      ]);
    } catch (error) {
      if (Platform.OS === 'android') {
        ToastAndroid.show(t('mainApp.couldNotSaveSettings'), ToastAndroid.SHORT);
      }
    }
  }, [webhookUrls, sendEquation, streamResults, t]);

  return {
    webhookUrls,
    setWebhookUrls,
    newWebhookUrl,
    setNewWebhookUrl,
    newWebhookTitle,
    setNewWebhookTitle,
    sendEquation,
    setSendEquation,
    streamResults,
    setStreamResults,
    bulkData,
    setBulkData,
    isSendingBulk,
    webhookSettingsLoaded,
    handleAddWebhook,
    handleDeleteWebhook,
    handleToggleWebhook,
    handleSendBulkData,
    sendWebhookData,
    saveSettings,
    sanitizeInput,
    validateWebhookUrl,
  };
};
