import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Image, Platform, StyleSheet, View } from 'react-native';
import { STORAGE_KEYS } from '../../constants/Config';
import { useTranslation } from '../../hooks/useTranslation';
import * as authService from '../../utils/authService';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t } = useTranslation();

  // Extract params once
  const errorParam = params.error as string;
  const errorDescription = params.error_description as string;
  const token = params.token as string;

  useEffect(() => {
    // Handle authentication callback
    const processCallback = async () => {
      // Error handling
      if (errorParam) {
        Alert.alert(t('auth.authError'), errorDescription || errorParam);
        router.replace('/auth/login');
        return;
      }

      // Token processing
      if (token) {
        try {
          // Parallel operations for speed
          const [, verifyResult] = await Promise.all([
            AsyncStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, token),
            authService.verifySession(),
          ]);

          const { user: verifiedUser, error } = verifyResult;

          if (error || !verifiedUser) {
            Alert.alert(t('auth.authError'), 'Failed to verify session');
            router.replace('/auth/login');
            return;
          }

          // Store user and redirect
          await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(verifiedUser));

          if (Platform.OS === 'web') {
            window.location.href = '/';
          } else {
            router.replace('/');
          }
        } catch (_error) {
          Alert.alert(t('auth.authError'), 'Failed to save session');
          router.replace('/auth/login');
        }
      }
    };

    processCallback();
  }, [errorParam, errorDescription, token, router, t]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/images/icon.png')}
        style={styles.icon}
        resizeMode="contain"
        fadeDuration={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  icon: {
    width: 120,
    height: 120,
  },
});
