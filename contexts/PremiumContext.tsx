import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

// Conditionally import Purchases to avoid errors on web
import PurchasesModule from 'react-native-purchases';
let Purchases: typeof PurchasesModule | null = null;
if (Platform.OS === 'android' || Platform.OS === 'ios') {
  try {
    Purchases = PurchasesModule;
  } catch (e) {
    console.warn('react-native-purchases not available', e);
  }
}

// Product ID for Google Play
const GOOGLE_PLAY_PRODUCT_ID = 'YOUR_GOOGLE_PLAY_PRODUCT_ID';

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
  showPremiumPayment: () => Promise<void>;
  premiumLoading: boolean;
  stripePaymentUrl: string;
  isPremiumCached: boolean; // Added to indicate if we have a cached value
  productInfo: ProductInfo | null; // Product information from Google Play
};

// Create the context with a default value
const PremiumContext = createContext<PremiumContextType>({
  isPremium: false,
  checkPremiumStatus: async () => false,
  showPremiumPayment: async () => {},
  premiumLoading: false,
  stripePaymentUrl: 'https://buy.stripe.com/bJe4gzeXH8bE5I31Xs24003', // Default payment URL from Stripe
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
  const [lastChecked, setLastChecked] = useState<number>(0);
  const [stripePaymentUrl] = useState<string>('https://buy.stripe.com/bJe4gzeXH8bE5I31Xs24003');
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [isIapConnected, setIsIapConnected] = useState<boolean>(false);
  
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
            const timestamp = parseInt(cachedTimestamp, 10);
            
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
            const timestamp = parseInt(cachedTimestamp, 10);
            
            setIsPremium(status);
            setLastChecked(timestamp);
            setIsPremiumCached(true);
          }
          
          // Initialize IAP for native platforms
          if (Platform.OS === 'android' || Platform.OS === 'ios') {
            try {
              if (Purchases) {
                // Configure RevenueCat
                Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '' });
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
                    currency: product.currencyCode
                  });
                }
              } else {
                console.warn('Purchases module not available');
              }
            } catch (error) {
              console.warn('Error initializing in-app purchases:', error);
            }
            
            // Set up purchase listener
            if (Purchases) {
              Purchases.addCustomerInfoUpdateListener(async (customerInfo: any) => {
                console.log('Customer info updated:', customerInfo);
                // Check if premium entitlement is active
                if (customerInfo.entitlements.active['premium']) {
                  console.log('Premium entitlement active');
                  
                  // TODO: Update premium status via Cloudflare
                  // For now, just update local state
                  setIsPremium(true);
                  setIsPremiumCached(true);
                  await savePremiumStatus(true, Date.now());
                }
              });
            }
          }
        }
      } catch (error) {
        console.error('Error initializing premium features:', error);
      }
    };
    
    initialize();
    
    // Cleanup: no need to disconnect from RevenueCat
    return () => {
      // RevenueCat handles cleanup automatically
    };
  }, []);
  
  // Check premium status when user changes
  useEffect(() => {
    if (user) {
      checkPremiumStatus();
    } else {
      setIsPremium(false);
      setIsPremiumCached(false);
    }
  }, [user]);

  // Save premium status to secure storage
  const savePremiumStatus = async (status: boolean, timestamp: number) => {
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
    } catch (error) {
      console.error('Error saving premium status:', error);
    }
  };

  // Check premium status - Placeholder for Cloudflare
  const checkPremiumStatus = async (): Promise<boolean> => {
    // TODO: Replace with Cloudflare premium status check
    console.log("[PremiumContext] checkPremiumStatus - awaiting Cloudflare integration");
    
    // For now, use only cached local status
    if (isPremiumCached) {
      return isPremium;
    }
    
    setIsPremium(false);
    setIsPremiumCached(true);
    return false;
  };

  // Handle payments based on platform
  const showPremiumPayment = async (): Promise<void> => {
    try {
      // For Android, use Google Play IAP
      if (Platform.OS === 'android') {
        console.log('Using RevenueCat for premium purchase');
        setPremiumLoading(true);
        
        if (Purchases) {
          try {
            // Purchase the product
            const { customerInfo } = await Purchases.purchaseProduct(GOOGLE_PLAY_PRODUCT_ID);
            // The purchase listener will handle updating the premium status
            console.log('Purchase completed:', customerInfo);
          } catch (error: any) {
            if (error.userCancelled) {
              console.log('User canceled the purchase');
            } else {
              console.error('Error making purchase:', error);
              Alert.alert('Purchase Error', 'There was an error processing your purchase. Please try again.');
            }
          }
        } else {
          console.warn('Purchases module not available');
          Alert.alert('Purchase Error', 'In-app purchases are not available on this device.');
        }
        
        setPremiumLoading(false);
      } 
      // For iOS, will need Apple IAP implementation here
      else if (Platform.OS === 'ios') {
        // TODO: Implement iOS IAP when needed
        Alert.alert('Coming Soon', 'iOS in-app purchases are coming soon!');
      }
      // For web and other platforms, use Stripe
      else {
        console.log('Using Stripe for premium purchase');
        if (Platform.OS === 'web') {
          // For web, open in a new tab
          window.open(stripePaymentUrl, '_blank');
        } else {
          // For other platforms, use WebBrowser
          await WebBrowser.openBrowserAsync(stripePaymentUrl);
          
          // After payment, we should check premium status again
          setTimeout(() => {
            checkPremiumStatus();
          }, 5000); // Check after 5 seconds
        }
      }
    } catch (error) {
      console.error('Error opening payment page:', error);
      Alert.alert('Error', 'Could not open payment page. Please try again.');
    }
  };

  return (
    <PremiumContext.Provider
      value={{
        isPremium,
        checkPremiumStatus,
        showPremiumPayment,
        premiumLoading,
        stripePaymentUrl,
        isPremiumCached,
        productInfo,
      }}
    >
      {children}
    </PremiumContext.Provider>
  );
};

// Export the hook to use the premium context
export const usePremium = () => useContext(PremiumContext);
