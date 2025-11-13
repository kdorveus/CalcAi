import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import type React from 'react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Alert, Platform } from 'react-native';
// Conditionally import Purchases to avoid errors on web
import PurchasesModule from 'react-native-purchases';
import { PREMIUM_ENDPOINTS, STORAGE_KEYS } from '../constants/Config';
import { useAuth } from './AuthContext';

let Purchases: typeof PurchasesModule | null = null;
if (Platform.OS === 'android' || Platform.OS === 'ios') {
  try {
    Purchases = PurchasesModule;
  } catch {
    Purchases = null;
  }
}

// Product ID for Google Play
const GOOGLE_PLAY_PRODUCT_ID = 'YOUR_GOOGLE_PLAY_PRODUCT_ID';

// Stripe Price IDs
const STRIPE_PRICE_IDS = {
  yearly: 'price_1SFIQ3Dmsyc2Q0HRcMlXlfI5',
  lifetime: 'price_1SDR9ZDmsyc2Q0HRCNYKpUvW',
};

// Define product structure
type ProductInfo = {
  productId: string;
  price: string;
  title: string;
  description: string;
  currency: string;
};

// Define the shape of the context data
type PremiumContextType = {
  isPremium: boolean;
  checkPremiumStatus: () => Promise<boolean>;
  showPremiumPayment: (planType?: 'yearly' | 'lifetime') => Promise<void>;
  premiumLoading: boolean;
  stripePaymentUrl: string;
  isPremiumCached: boolean; // Added to indicate if we have a cached value
  productInfo: ProductInfo | null; // Product information from Google Play
};

// Create the context with a default value
const PremiumContext = createContext<PremiumContextType>({
  isPremium: false,
  checkPremiumStatus: async () => false,
  showPremiumPayment: async (_planType?: 'yearly' | 'lifetime') => {},
  premiumLoading: false,
  stripePaymentUrl: '', // Deprecated - will be generated dynamically
  isPremiumCached: false,
  productInfo: null,
});

// Define props for the PremiumProvider
interface PremiumProviderProps {
  children: ReactNode;
}

// Keys for secure storage
const PREMIUM_STATUS_KEY = 'PREMIUM_STATUS';
const PREMIUM_TIMESTAMP_KEY = 'PREMIUM_TIMESTAMP';

// Create the PremiumProvider component
export const PremiumProvider: React.FC<PremiumProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [isPremiumCached, setIsPremiumCached] = useState<boolean>(false);
  const [premiumLoading, setPremiumLoading] = useState<boolean>(false);
  const [_lastChecked, setLastChecked] = useState<number>(0);
  const [stripePaymentUrl, _setStripePaymentUrl] = useState<string>(''); // Deprecated
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [_isIapConnected, setIsIapConnected] = useState<boolean>(false);

  // Save premium status to secure storage
  const savePremiumStatus = useCallback(async (status: boolean, timestamp: number) => {
    try {
      if (Platform.OS === 'web') {
        // Use AsyncStorage for web
        await AsyncStorage.setItem(PREMIUM_STATUS_KEY, status.toString());
        await AsyncStorage.setItem(PREMIUM_TIMESTAMP_KEY, timestamp.toString());
      } else {
        // Use SecureStore for native
        await SecureStore.setItemAsync(PREMIUM_STATUS_KEY, status.toString());
        await SecureStore.setItemAsync(PREMIUM_TIMESTAMP_KEY, timestamp.toString());
      }
    } catch {}
  }, []);

  // Check premium status from Cloudflare Worker
  const checkPremiumStatus = useCallback(async (): Promise<boolean> => {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
      if (!token) {
        setIsPremium(false);
        return false;
      }

      const response = await axios.get(PREMIUM_ENDPOINTS.CHECK, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      });

      const premium = response.data.isPremium === true;
      setIsPremium(premium);
      setIsPremiumCached(true);
      await savePremiumStatus(premium, Date.now());
      return premium;
    } catch {
      setIsPremium(false);
      return false;
    }
  }, [savePremiumStatus]);

  // Initialize IAP and load cached premium status on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Load cached premium status
        if (Platform.OS === 'web') {
          // Use AsyncStorage for web
          const cachedStatus = await AsyncStorage.getItem(PREMIUM_STATUS_KEY);
          const cachedTimestamp = await AsyncStorage.getItem(PREMIUM_TIMESTAMP_KEY);

          if (cachedStatus && cachedTimestamp) {
            const status = cachedStatus === 'true';
            const timestamp = Number.parseInt(cachedTimestamp, 10);

            setIsPremium(status);
            setLastChecked(timestamp);
            setIsPremiumCached(true);
          }
        } else {
          // Use SecureStore for native
          const cachedStatus = await SecureStore.getItemAsync(PREMIUM_STATUS_KEY);
          const cachedTimestamp = await SecureStore.getItemAsync(PREMIUM_TIMESTAMP_KEY);

          if (cachedStatus && cachedTimestamp) {
            const status = cachedStatus === 'true';
            const timestamp = Number.parseInt(cachedTimestamp, 10);

            setIsPremium(status);
            setLastChecked(timestamp);
            setIsPremiumCached(true);
          }

          // Initialize IAP for native platforms
          if (Platform.OS === 'android' || Platform.OS === 'ios') {
            try {
              if (Purchases) {
                // Configure RevenueCat
                Purchases.configure({
                  apiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '',
                });
                setIsIapConnected(true);

                // Get the products
                const products = await Purchases.getProducts([GOOGLE_PLAY_PRODUCT_ID]);

                if (products && products.length > 0) {
                  const product = products[0];
                  setProductInfo({
                    productId: product.identifier,
                    price: product.priceString,
                    title: product.title,
                    description: product.description,
                    currency: product.currencyCode,
                  });
                }
              }
            } catch {}

            // Set up purchase listener
            if (Purchases) {
              Purchases.addCustomerInfoUpdateListener(async (customerInfo: any) => {
                // Check if premium entitlement is active
                if (customerInfo.entitlements.active.premium) {
                  // For now, just update local state
                  setIsPremium(true);
                  setIsPremiumCached(true);
                  await savePremiumStatus(true, Date.now());
                }
              });
            }
          }
        }
      } catch {}
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savePremiumStatus]);

  // Check premium status when user changes
  useEffect(() => {
    if (user) {
      checkPremiumStatus();
    } else {
      setIsPremium(false);
      setIsPremiumCached(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, checkPremiumStatus]);

  // Legacy check premium status
  const _checkPremiumStatusLegacy = async (): Promise<boolean> => {
    // For now, use only cached local status
    if (isPremiumCached) {
      return isPremium;
    }

    setIsPremium(false);
    setIsPremiumCached(true);
    return false;
  };

  // Handle payments based on platform
  const showPremiumPayment = useCallback(
    async (planType: 'yearly' | 'lifetime' = 'lifetime'): Promise<void> => {
      try {
        // For Android, use Google Play IAP
        if (Platform.OS === 'android') {
          setPremiumLoading(true);

          if (Purchases) {
            try {
              // Purchase the product
              await Purchases.purchaseProduct(GOOGLE_PLAY_PRODUCT_ID);
            } catch (error: any) {
              if (error.userCancelled) {
                return;
              }
              Alert.alert(
                'Purchase Error',
                'There was an error processing your purchase. Please try again.'
              );
            }
          } else {
            Alert.alert('Purchase Error', 'In-app purchases are not available on this device.');
          }

          setPremiumLoading(false);
        } else if (Platform.OS === 'ios') {
          Alert.alert('Coming Soon', 'iOS in-app purchases are coming soon!');
        }
        // For web and other platforms, use Stripe Checkout
        else {
          setPremiumLoading(true);

          try {
            const token = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
            if (!token) {
              Alert.alert('Authentication Required', 'Please sign in to purchase premium.');
              setPremiumLoading(false);
              return;
            }

            // Get the price ID for the selected plan
            const priceId = STRIPE_PRICE_IDS[planType];

            // Create checkout session via worker
            const response = await axios.post(
              PREMIUM_ENDPOINTS.CREATE_CHECKOUT,
              { priceId },
              {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 10000,
              }
            );

            const { url } = response.data;

            if (Platform.OS === 'web') {
              // For web, open in the same tab
              globalThis.window.location.href = url;
            } else {
              // For other platforms, use WebBrowser
              const result = await WebBrowser.openBrowserAsync(url);

              // After browser closes, check premium status
              if (result.type === 'dismiss' || result.type === 'cancel') {
                // User closed the browser, check if payment was completed
                setTimeout(() => {
                  checkPremiumStatus();
                }, 1000);
              }
            }
          } catch (error: any) {
            const errorMessage =
              error.response?.data?.error ||
              error.response?.data?.details ||
              error.message ||
              'Could not start checkout. Please try again.';
            Alert.alert('Checkout Error', errorMessage);
          } finally {
            setPremiumLoading(false);
          }
        }
      } catch {
        Alert.alert('Error', 'Could not open payment page. Please try again.');
        setPremiumLoading(false);
      }
    },
    [checkPremiumStatus]
  );

  const contextValue = useMemo(
    () => ({
      isPremium,
      checkPremiumStatus,
      showPremiumPayment,
      premiumLoading,
      stripePaymentUrl,
      isPremiumCached,
      productInfo,
    }),
    [
      isPremium,
      checkPremiumStatus,
      showPremiumPayment,
      premiumLoading,
      stripePaymentUrl,
      isPremiumCached,
      productInfo,
    ]
  );

  return <PremiumContext.Provider value={contextValue}>{children}</PremiumContext.Provider>;
};

// Export the hook to use the premium context
export const usePremium = () => useContext(PremiumContext);
