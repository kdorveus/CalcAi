import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { supabase } from '../utils/supabase';
import { useAuth } from './AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

// Conditionally import InAppPurchases to avoid errors on web
let InAppPurchases: any = null;
if (Platform.OS === 'android' || Platform.OS === 'ios') {
  try {
    InAppPurchases = require('expo-in-app-purchases');
  } catch (e) {
    console.warn('expo-in-app-purchases not available', e);
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
              if (InAppPurchases) {
                // Connect to the store
                await InAppPurchases.connectAsync();
                setIsIapConnected(true);
                
                // Get the products
                const { responseCode, results } = await InAppPurchases.getProductsAsync([GOOGLE_PLAY_PRODUCT_ID]);
                
                if (responseCode === InAppPurchases.IAPResponseCode.OK && results && results.length > 0) {
                  const product = results[0];
                  setProductInfo({
                    productId: product.productId,
                    price: product.price,
                    title: product.title,
                    description: product.description,
                    currency: product.priceCurrencyCode || 'USD'
                  });
                }
              } else {
                console.warn('InAppPurchases module not available');
              }
            } catch (error) {
              console.warn('Error initializing in-app purchases:', error);
            }
            
            // Set up purchase listener
            if (InAppPurchases) {
              InAppPurchases.setPurchaseListener(({ responseCode, results }: { responseCode: number, results: any[] }) => {
              if (responseCode === InAppPurchases.IAPResponseCode.OK && results && results.length > 0) {
                // Process each purchase
                results.forEach(async (purchase: any) => {
                  if (!purchase.acknowledged) {
                    console.log('Purchase successful:', purchase);
                    
                    try {
                      // IMPORTANT: Send purchase token to your backend for validation
                      // This is a crucial security step - verify the purchase on your server
                      // with Google Play's servers before granting premium access
                      
                      // For this example, we'll assume the purchase is valid
                      // In a real app, you MUST validate on your server first
                      
                      // Finish the transaction
                      await InAppPurchases.finishTransactionAsync(purchase, false);
                      
                      // Update the user's premium status
                      if (user) {
                        try {
                          // Update in Supabase
                          const { error } = await supabase
                            .from('users')
                            .update({ has_premium: true })
                            .eq('id', user.id);
                          
                          if (error) {
                            console.error('Error updating premium status:', error);
                          } else {
                            // Check premium status to update local state
                            await checkPremiumStatus();
                          }
                        } catch (error) {
                          console.error('Error updating user premium status:', error);
                        }
                      }
                    } catch (error) {
                      console.error('Error processing purchase:', error);
                    }
                  }
                });
              } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
                console.log('User canceled the purchase');
              } else if (responseCode === InAppPurchases.IAPResponseCode.DEFERRED) {
                console.log('Purchase deferred');
              } else {
                console.log('Purchase failed with code:', responseCode);
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
    
    // Cleanup: disconnect from the store
    return () => {
      if (isIapConnected && Platform.OS !== 'web' && InAppPurchases) {
        InAppPurchases.disconnectAsync().catch((err: any) => {
          console.error('Error disconnecting from IAP:', err);
        });
      }
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

  // Check premium status from Supabase
  const checkPremiumStatus = async (): Promise<boolean> => {
    // If no user, not premium
    if (!user) {
      setIsPremium(false);
      setIsPremiumCached(false);
      return false;
    }
    
    // Check cache first (only check Supabase every 30 minutes max)
    const now = Date.now();
    const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
    
    try {
      // If we have a cached value and it's recent enough, use it
      if (isPremiumCached && now - lastChecked < CACHE_DURATION) {
        return isPremium;
      }
      
      // Otherwise, query Supabase
      setPremiumLoading(true);
      
      const { data, error } = await supabase
        .from('users')
        .select('has_premium')
        .eq('id', user.id)
        .single();
      
      if (error) {
        // If no rows returned, treat as not premium but do not log as error
        if (error.code === 'PGRST116' && error.message && error.message.includes('multiple (or no) rows returned')) {
          setPremiumLoading(false);
          setIsPremium(false);
          setIsPremiumCached(true);
          await savePremiumStatus(false, now);
          setLastChecked(now);
          return false;
        } else {
          console.error('Error checking premium status:', error);
          setPremiumLoading(false);
          // If there's an error, use cached value if available
          return isPremiumCached ? isPremium : false;
        }
      }
      
      if (!data) {
        setPremiumLoading(false);
        setIsPremium(false);
        setIsPremiumCached(true);
        await savePremiumStatus(false, now);
        setLastChecked(now);
        return false;
      }
      
      // Update state and secure cache
      const hasPremium = data?.has_premium || false;
      setIsPremium(hasPremium);
      setIsPremiumCached(true);
      setLastChecked(now);
      
      // Save to secure storage
      await savePremiumStatus(hasPremium, now);
      
      setPremiumLoading(false);
      return hasPremium;
    } catch (error) {
      console.error('Error in premium check:', error);
      setPremiumLoading(false);
      // If there's an error, use cached value if available
      return isPremiumCached ? isPremium : false;
    }
  };

  // Handle payments based on platform
  const showPremiumPayment = async (): Promise<void> => {
    try {
      // For Android, use Google Play IAP
      if (Platform.OS === 'android') {
        console.log('Using Google Play for premium purchase');
        setPremiumLoading(true);
        
        if (InAppPurchases) {
          try {
            // Make sure IAP is connected
            if (!isIapConnected) {
              await InAppPurchases.connectAsync();
              setIsIapConnected(true);
            }
            
            // Purchase the item
            await InAppPurchases.purchaseItemAsync(GOOGLE_PLAY_PRODUCT_ID);
            // Result handling is done in the purchase listener
          } catch (error) {
            console.error('Error making purchase:', error);
            Alert.alert('Purchase Error', 'There was an error processing your purchase. Please try again.');
          }
        } else {
          console.warn('InAppPurchases module not available');
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
