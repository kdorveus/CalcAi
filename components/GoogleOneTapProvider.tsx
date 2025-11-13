/**
 * Google One Tap Provider Component
 * Manages Google One Tap authentication flow
 * Only renders on web platform and doesn't block app loading
 */

import type React from 'react';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { GOOGLE_CLIENT_ID } from '../constants/Config';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleOneTap } from '../hooks/useGoogleOneTap';

export const GoogleOneTapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, signInWithGoogleOneTap } = useAuth();
  const hasPromptedRef = useRef(false);

  const { isInitialized, prompt } = useGoogleOneTap({
    clientId: GOOGLE_CLIENT_ID,
    onSuccess: (credential) => {
      // Process authentication non-blocking
      const processAuth = async () => {
        const { error } = await signInWithGoogleOneTap(credential);
        if (error) {
          console.error('Google One Tap authentication failed:', error);
        }
      };

      // Use requestIdleCallback to process auth without blocking UI
      if ('requestIdleCallback' in globalThis) {
        (globalThis as any).requestIdleCallback(processAuth);
      } else {
        // Fallback: process immediately but asynchronously
        processAuth();
      }
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
    if (isInitialized && !user && !hasPromptedRef.current && GOOGLE_CLIENT_ID) {
      // Prompt immediately - the hook already handles async loading
      prompt();
      hasPromptedRef.current = true;
    }
  }, [isInitialized, user, prompt]);

  return <>{children}</>;
};
