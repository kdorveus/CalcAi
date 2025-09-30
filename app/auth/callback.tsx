import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, Platform, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from '../../hooks/useTranslation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../constants/Config';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const errorParam = params.error as string;
  const errorDescription = params.error_description as string;
  const token = params.token as string;
  const { t } = useTranslation();

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
          console.log("[AuthCallback] Received token, storing and redirecting...");
          
          // Store the token
          await AsyncStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, token);
          
          // Redirect to home
          router.replace('/');
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
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' }}>
      <ActivityIndicator size="large" color="#1E90FF" />
      <Text style={{ color: 'white', marginTop: 20 }}>
        {t('auth.signInToContinue')}...
      </Text>
    </View>
  );
} 