import React, { useEffect, useRef } from 'react';
import { View, Text, Platform, Alert, Image, StyleSheet, Animated } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from '../../hooks/useTranslation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../constants/Config';
import * as authService from '../../utils/authService';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t } = useTranslation();
  
  // Animated values for fade-in (initialized to 0 for instant start)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Extract params once
  const errorParam = params.error as string;
  const errorDescription = params.error_description as string;
  const token = params.token as string;

  useEffect(() => {
    // Start fade-in animation immediately
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

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
            authService.verifySession()
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
        } catch (error) {
          Alert.alert(t('auth.authError'), 'Failed to save session');
          router.replace('/auth/login');
        }
      }
    };

    processCallback();
  }, [errorParam, errorDescription, token, router, t, fadeAnim]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim }}>
        <Image 
          source={require('../../assets/images/icon.png')} 
          style={styles.icon}
          resizeMode="contain"
          fadeDuration={0}
        />
        <Text style={styles.welcomeText}>
          {t('auth.settingUpAccount')}
        </Text>
      </Animated.View>
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
    marginBottom: 24,
  },
  welcomeText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '500',
    textAlign: 'center',
  },
}); 