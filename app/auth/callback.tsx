import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, Platform, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from '../../hooks/useTranslation';
// import { supabase } from '@/utils/supabase'; // No longer needed here
// import { useAuth } from '@/contexts/AuthContext'; // No longer needed here

// This screen exists solely to catch the OAuth redirect.
// The actual redirection logic after successful login or on error
// is handled by the useProtectedRoute hook in app/_layout.tsx,
// which monitors the global AuthContext state.
export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const errorParam = params.error as string;
  const errorDescription = params.error_description as string;
  const { t } = useTranslation();

  useEffect(() => {
    console.log("[AuthCallback] Mounted. Params:", params);

    // If there's an error passed directly in the URL, handle it immediately.
    if (errorParam) {
      console.error(`[AuthCallback] Error from URL: ${errorParam} - ${errorDescription}`);
      // Show alert and redirect to login, don't wait for context update.
      Alert.alert(t('auth.authError'), errorDescription || errorParam);
      router.replace('/auth/login');
      return; // Stop further execution in this effect
    }

    // If no immediate error, just log and wait.
    // The screen will show "Finalizing..." until the AuthContext state changes
    // and the useProtectedRoute hook in _layout.tsx triggers a redirect.
    console.log("[AuthCallback] No immediate error in params. Waiting for AuthContext update and redirect from root layout...");

    // No dependency array change needed, only runs once on mount effectively
  }, [router, params, errorParam, errorDescription]); // Added params to deps

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' }}>
      <ActivityIndicator size="large" color="#1E90FF" />
      <Text style={{ color: 'white', marginTop: 20 }}>
        {t('auth.signInToContinue')}...
      </Text>
    </View>
  );
} 