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

interface GoogleAccounts {
  id: {
    initialize: (config: any) => void;
    prompt: (callback?: (notification: any) => void) => void;
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
  const scriptLoadedRef = useRef(false);
  const initAttemptedRef = useRef(false);

  // Load Google Identity Services script
  useEffect(() => {
    // Only run on web platform
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    // Check if already loaded
    if (window.google?.accounts?.id) {
      setIsLoaded(true);
      return;
    }

    // Prevent multiple script loads
    if (scriptLoadedRef.current) {
      return;
    }

    scriptLoadedRef.current = true;

    // Lazy load the Google Identity Services script
    const loadScript = () => {
      return new Promise<void>((resolve, reject) => {
        // Check if script already exists
        const existingScript = document.querySelector(
          'script[src*="accounts.google.com/gsi/client"]'
        );
        if (existingScript) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;

        script.onload = () => {
          setIsLoaded(true);
          resolve();
        };

        script.onerror = () => {
          scriptLoadedRef.current = false;
          reject(new Error('Failed to load Google Identity Services'));
        };

        document.head.appendChild(script);
      });
    };

    // Load script after a short delay to not block initial render
    const timeoutId = setTimeout(() => {
      loadScript().catch((error) => {
        console.error('Google One Tap script load error:', error);
        config.onError?.(error);
      });
    }, 1000); // 1 second delay to ensure app loads first

    return () => {
      clearTimeout(timeoutId);
    };
  }, [config.onError]);

  // Initialize Google One Tap
  useEffect(() => {
    if (!isLoaded || Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    if (!window.google?.accounts?.id) {
      return;
    }

    // Prevent multiple initializations
    if (initAttemptedRef.current) {
      return;
    }

    initAttemptedRef.current = true;

    try {
      window.google.accounts.id.initialize({
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
    if (!isInitialized || Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    if (!window.google?.accounts?.id) {
      return;
    }

    try {
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // One Tap was not displayed or was skipped
          // This is normal behavior - user may have dismissed it before
        }
      });
    } catch (error) {
      console.error('Google One Tap prompt error:', error);
      config.onError?.(error as Error);
    }
  };

  // Cancel One Tap
  const cancel = () => {
    if (!isInitialized || Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    if (!window.google?.accounts?.id) {
      return;
    }

    try {
      window.google.accounts.id.cancel();
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
