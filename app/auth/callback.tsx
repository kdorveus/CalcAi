import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, Platform, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from '../../hooks/useTranslation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../constants/Config';
import * as authService from '../../utils/authService';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const errorParam = params.error as string;
  const errorDescription = params.error_description as string;
  const token = params.token as string;
  const { t } = useTranslation();
  const { user, setUser, setSession } = useAuth() as any; // Force type to access setters

  useEffect(() => {
    const handleCallback = async () => {
      console.log("[AuthCallback] Mounted. Params:", params);

      // Handle error
      if (errorParam) {
        console.error(`[AuthCallback] Error from URL: ${errorParam} - ${errorDescription}`);
        Alert.alert(t('auth.authError'), errorDescription || errorParam);
        router.replace('/auth/login');
        return;
      }

      // Handle success with token
      if (token) {
        try {
          console.log("[AuthCallback] Received token, storing and rehydrating user...");
          
          // Store the token
          await AsyncStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, token);
          
          // Verify session and get user data to rehydrate the context
          const { user: verifiedUser, error } = await authService.verifySession();
          
          if (error || !verifiedUser) {
            console.error("[AuthCallback] Failed to verify session:", error);
            Alert.alert(t('auth.authError'), 'Failed to verify session');
            router.replace('/auth/login');
            return;
          }
          
          // Store user data
          await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(verifiedUser));
          
          // Force immediate rehydration by reloading the page on web or navigating on native
          if (Platform.OS === 'web') {
            // On web, reload to trigger AuthContext reinitialization
            window.location.href = '/';
          } else {
            // On native, redirect to home (AuthContext will pick up the stored user)
            router.replace('/');
          }
        } catch (error) {
          console.error("[AuthCallback] Error storing token:", error);
          Alert.alert(t('auth.authError'), 'Failed to save session');
          router.replace('/auth/login');
        }
        return;
      }

      console.log("[AuthCallback] No token or error. Waiting...");
    };

    handleCallback();
  }, [router, params, errorParam, errorDescription, token, t]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
      <ActivityIndicator size="large" color="#1E90FF" />
      <Text style={{ color: 'white', marginTop: 20 }}>
        {t('auth.signInToContinue')}...
      </Text>
    </View>
  );
} 