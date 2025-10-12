/**
 * Google One Tap Provider Component
 * Manages Google One Tap authentication flow
 * Only renders on web platform and doesn't block app loading
 */

import type React from 'react';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { AUTH_ENDPOINTS } from '../constants/Config';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleOneTap } from '../hooks/useGoogleOneTap';

export const GoogleOneTapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, signInWithGoogleOneTap } = useAuth();
  const [hasPrompted, setHasPrompted] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  // Fetch Google Client ID from worker
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const fetchClientId = async () => {
      try {
        const response = await fetch(AUTH_ENDPOINTS.GOOGLE_CLIENT_ID);
        const data = await response.json();
        setClientId(data.clientId);
      } catch (error) {
        console.error('Failed to fetch Google Client ID:', error);
      }
    };

    fetchClientId();
  }, []);

  const { isInitialized, prompt } = useGoogleOneTap({
    clientId: clientId || '',
    onSuccess: (credential) => {
      (async () => {
        const { error } = await signInWithGoogleOneTap(credential);
        if (error) {
          console.error('Google One Tap authentication failed:', error);
        }
      })();
    },
    onError: (error) => {
      console.error('Google One Tap error:', error);
    },
    autoSelect: false,
    cancelOnTapOutside: true,
    context: 'signin',
  });

  // Show One Tap prompt when initialized and user is not logged in
  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    // Only prompt once per session and only if user is not logged in and we have clientId
    if (isInitialized && !user && !hasPrompted && clientId) {
      // Delay prompt to ensure app is fully loaded
      const timeoutId = setTimeout(() => {
        prompt();
        setHasPrompted(true);
      }, 2000); // 2 second delay after initialization

      return () => clearTimeout(timeoutId);
    }
  }, [isInitialized, user, hasPrompted, clientId, prompt]);

  return <>{children}</>;
};
