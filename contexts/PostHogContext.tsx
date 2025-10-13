import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { POSTHOG_CONFIG } from '../constants/Config';

// Platform-specific PostHog types
type PostHogClient = any;
type QueuedEvent =
  | ['capture', string, Record<string, any> | undefined]
  | ['identify', string, Record<string, any> | undefined]
  | ['reset'];

interface PostHogContextType {
  posthog: PostHogClient | null;
  isInitialized: boolean;
  captureEvent: (eventName: string, properties?: Record<string, any>) => void;
  identifyUser: (userId: string, properties?: Record<string, any>) => void;
  captureScreen: (screenName: string, properties?: Record<string, any>) => void;
  resetUser: () => void;
}

const PostHogContext = createContext<PostHogContextType>({
  posthog: null,
  isInitialized: false,
  captureEvent: () => {},
  identifyUser: () => {},
  captureScreen: () => {},
  resetUser: () => {},
});

export const usePostHog = () => useContext(PostHogContext);

export const PostHogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const posthogClientRef = useRef<PostHogClient | null>(null);
  const eventQueueRef = useRef<QueuedEvent[]>([]);

  const processQueue = useCallback((client: PostHogClient) => {
    if (!client) return;
    while (eventQueueRef.current.length > 0) {
      const event = eventQueueRef.current.shift();
      if (event) {
        const [type, ...args] = event;
        if (type === 'capture' && typeof client.capture === 'function') {
          client.capture(args[0], args[1]);
        } else if (type === 'identify' && typeof client.identify === 'function') {
          client.identify(args[0], args[1]);
        } else if (type === 'reset' && typeof client.reset === 'function') {
          client.reset();
        }
      }
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    const initPostHog = async () => {
      try {
        if (POSTHOG_CONFIG.API_KEY && Platform.OS === 'web') {
          // Use posthog-js for web
          const posthog = await import(/* webpackChunkName: "posthog" */ 'posthog-js');
          posthog.default.init(POSTHOG_CONFIG.API_KEY, {
            api_host: POSTHOG_CONFIG.HOST,
            capture_pageview: false,
            autocapture: false,
            loaded: (ph) => {
              posthogClientRef.current = ph;
              processQueue(ph);
            },
          });
        } else if (POSTHOG_CONFIG.API_KEY) {
          // Use posthog-react-native for mobile
          const PostHog = (
            await import(/* webpackChunkName: "posthog-native" */ 'posthog-react-native')
          ).default;
          posthogClientRef.current = new PostHog(POSTHOG_CONFIG.API_KEY, {
            host: POSTHOG_CONFIG.HOST,
            captureAppLifecycleEvents: true,
          });
          processQueue(posthogClientRef.current);
        }
      } catch (error) {
        console.warn('PostHog initialization failed:', error);
      }
    };

    // Defer PostHog to window.onload to completely avoid blocking page load
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('load', initPostHog, { once: true });
      return () => window.removeEventListener('load', initPostHog);
    } else {
      // Mobile: defer by 1 second
      const timer = setTimeout(initPostHog, 1000);
      return () => clearTimeout(timer);
    }
  }, [processQueue]);

  // Performance-optimized event capture
  const captureEvent = useCallback(
    (eventName: string, properties?: Record<string, any>) => {
      if (posthogClientRef.current && isInitialized) {
        posthogClientRef.current.capture(eventName, properties);
      } else {
        eventQueueRef.current.push(['capture', eventName, properties]);
      }
    },
    [isInitialized]
  );

  const captureScreen = useCallback(
    (screenName: string, properties?: Record<string, any>) => {
      if (posthogClientRef.current && isInitialized) {
        posthogClientRef.current.capture('$screen', {
          $screen_name: screenName,
          ...properties,
        });
      } else {
        eventQueueRef.current.push([
          'capture',
          '$screen',
          { $screen_name: screenName, ...properties },
        ]);
      }
    },
    [isInitialized]
  );

  // User identification
  const identifyUser = useCallback(
    (userId: string, properties?: Record<string, any>) => {
      if (posthogClientRef.current && isInitialized) {
        posthogClientRef.current.identify(userId, properties);
      } else {
        eventQueueRef.current.push(['identify', userId, properties]);
      }
    },
    [isInitialized]
  );

  // Reset user on logout
  const resetUser = useCallback(() => {
    if (posthogClientRef.current && isInitialized) {
      posthogClientRef.current.reset();
    } else {
      eventQueueRef.current.push(['reset']);
    }
  }, [isInitialized]);

  const contextValue = useMemo(
    () => ({
      posthog: posthogClientRef.current,
      isInitialized,
      captureEvent,
      identifyUser,
      captureScreen,
      resetUser,
    }),
    [isInitialized, captureEvent, identifyUser, captureScreen, resetUser]
  );

  return <PostHogContext.Provider value={contextValue}>{children}</PostHogContext.Provider>;
};
