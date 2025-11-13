/**
 * Google One Tap Hook
 * Implements Google One Tap authentication for web platform
 * Lazy loads the Google Identity Services library to avoid blocking app load
 */

import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

interface GoogleOneTapConfig {
  clientId: string;
  onSuccess: (credential: string) => void;
  onError?: (error: Error) => void;
  autoSelect?: boolean;
  cancelOnTapOutside?: boolean;
  context?: 'signin' | 'signup' | 'use';
}

interface MomentNotification {
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
  getDismissedReason: () => string;
}

interface GoogleAccounts {
  id: {
    initialize: (config: any) => void;
    prompt: () => void;
    cancel: () => void;
  };
}

declare global {
  interface Window {
    google?: {
      accounts: GoogleAccounts;
    };
  }
}

/**
 * Hook to manage Google One Tap authentication
 * Only works on web platform
 */
export function useGoogleOneTap(config: GoogleOneTapConfig) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const initAttemptedRef = useRef(false);

  // Load Google Identity Services script
  useEffect(() => {
    // Only run on web platform
    if (Platform.OS !== 'web' || typeof globalThis.window === 'undefined') {
      return;
    }

    // Check if already loaded
    if (globalThis.window.google?.accounts?.id) {
      setIsLoaded(true);
      return;
    }

    // Script is loaded in HTML head - check if it's ready
    // Per Google's official docs: script loads with async defer in head
    const checkScriptReady = () => {
      if (globalThis.window.google?.accounts?.id) {
        setIsLoaded(true);
        return;
      }
      // Script might still be loading, check again after a short delay
      setTimeout(checkScriptReady, 100);
    };

    // Start checking when script is ready
    checkScriptReady();
  }, []);

  // Initialize Google One Tap
  useEffect(() => {
    if (!isLoaded || Platform.OS !== 'web' || typeof globalThis.window === 'undefined') {
      return;
    }

    if (!globalThis.window.google?.accounts?.id) {
      return;
    }

    // Require a valid clientId before initializing
    if (!config.clientId || config.clientId.trim().length === 0) {
      // Reset initialization flag when clientId is not valid
      // This allows re-initialization when clientId becomes available
      initAttemptedRef.current = false;
      setIsInitialized(false);
      return;
    }

    // Prevent multiple initializations with the same clientId
    if (initAttemptedRef.current) {
      return;
    }

    initAttemptedRef.current = true;

    try {
      globalThis.window.google.accounts.id.initialize({
        client_id: config.clientId,
        callback: (response: any) => {
          if (response.credential) {
            config.onSuccess(response.credential);
          } else {
            config.onError?.(new Error('No credential received'));
          }
        },
        auto_select: config.autoSelect ?? false,
        cancel_on_tap_outside: config.cancelOnTapOutside ?? true,
        context: config.context ?? 'signin',
        // Opt-in to FedCM and use the new moment notification callback
        // This is the modern, FedCM-compliant way to handle UI status.
        use_fedcm_for_prompt: true,
        moment_notification: (notification: MomentNotification) => {
          // Handle skipped moment (user closed the prompt without action)
          if (notification.isSkippedMoment()) {
          }
          // Handle dismissed moment (user actively dismissed the prompt)
          if (notification.isDismissedMoment()) {
            notification.getDismissedReason();
          }
        },
      });

      setIsInitialized(true);
    } catch (error) {
      console.error('Google One Tap initialization error:', error);
      config.onError?.(error as Error);
      initAttemptedRef.current = false;
    }
  }, [
    isLoaded,
    config.clientId,
    config.autoSelect,
    config.cancelOnTapOutside,
    config.context,
    config.onSuccess,
    config.onError,
  ]);

  // Prompt One Tap
  const prompt = () => {
    if (!isInitialized || Platform.OS !== 'web' || typeof globalThis.window === 'undefined') {
      return;
    }

    if (!globalThis.window.google?.accounts?.id) {
      return;
    }

    try {
      globalThis.window.google.accounts.id.prompt();
    } catch (error) {
      console.error('Google One Tap prompt error:', error);
      config.onError?.(error as Error);
    }
  };

  // Cancel One Tap
  const cancel = () => {
    if (!isInitialized || Platform.OS !== 'web' || typeof globalThis.window === 'undefined') {
      return;
    }

    if (!globalThis.window.google?.accounts?.id) {
      return;
    }

    try {
      globalThis.window.google.accounts.id.cancel();
    } catch (error) {
      console.error('Google One Tap cancel error:', error);
    }
  };

  return {
    isLoaded,
    isInitialized,
    prompt,
    cancel,
  };
}
