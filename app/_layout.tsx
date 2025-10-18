import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { lazy, Suspense, useEffect } from 'react';
import 'react-native-reanimated';
import * as Linking from 'expo-linking';
import { Platform, View } from 'react-native';
import { AuthProvider, useProtectedRoute } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { PostHogProvider } from '../contexts/PostHogContext';

const PremiumProvider = lazy(() =>
  import(/* webpackChunkName: "premium-context" */ '../contexts/PremiumContext').then((m) => ({
    default: m.PremiumProvider,
  }))
);
const CalculationHistoryProvider = lazy(() =>
  import(/* webpackChunkName: "history-context" */ '../contexts/CalculationHistoryContext').then(
    (m) => ({
      default: m.CalculationHistoryProvider,
    })
  )
);
const GoogleOneTapProvider = lazy(() =>
  import(/* webpackChunkName: "google-onetap" */ '../components/GoogleOneTapProvider').then(
    (m) => ({ default: m.GoogleOneTapProvider })
  )
);

// import { router } from 'expo-router'; // No longer directly needed here

import { useColorScheme } from 'react-native';

// Ultra-fast icon loading for web - preload critical icons as base64
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  // Immediate execution to ensure fastest possible loading
  (() => {
    // Add critical CSS after Material Icons (still high priority)
    const criticalCss = document.createElement('style');
    criticalCss.id = 'critical-css';
    criticalCss.textContent = `
      html, body {
        background-color: #121212;
        color: #fff;
        margin: 0;
        padding: 0;
        height: 100%;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      
      #root, #root > div, #root > div > div {
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      
      .force-instant-display {
        opacity: 1 !important;
        visibility: visible !important;
      }

      /* Chat Area Placeholder */
      .chat-area-placeholder {
        flex: 1;
        padding: 10px;
        overflow-y: scroll; /* Allow scrolling if content overflows */
      }

      /* Input Bar Placeholder */
      .input-bar-placeholder {
        display: flex;
        padding: 10px;
        border-top: 1px solid #333;
      }
      .input-placeholder {
        flex: 1;
        background-color: #1e1e1e;
        color: #fff;
        border-radius: 20px;
        padding: 10px 15px;
        margin-right: 10px;
      }
      .send-button-placeholder {
        background-color: #007AFF;
        border-radius: 20px;
        padding: 10px 15px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      /* Bottom bar specific styles for immediate render */
      .bottom-bar {
        position: fixed;
        bottom: 15px;
        left: 15px;
        right: 15px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background-color: #1C1C1E;
        border-radius: 25px;
        height: 60px;
        padding: 0 15px;
        z-index: 1000;
      }
      
      /* Bottom icons styles */
      .bottom-icon {
        width: 50px;
        height: 50px;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      
      /* Center mic button */
      .center-button {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background-color: #121212;
        display: flex;
        justify-content: center;
        align-items: center;
      }
    `;

    // Insert critical CSS after Material Icons
    if (document.getElementById('critical-material-icons')) {
      const materialIconsElement = document.getElementById('critical-material-icons');
      if (materialIconsElement) {
        materialIconsElement.after(criticalCss);
      } else {
        document.head.appendChild(criticalCss);
      }
    } else {
      document.head.appendChild(criticalCss);
    }

    // Pre-render the bottom bar structure for immediate display
    const preBottomBar = document.createElement('div');
    preBottomBar.className = 'bottom-bar force-instant-display';
    preBottomBar.innerHTML = `
      <div class="bottom-icon"></div>
      <div class="center-button"></div>
      <div class="bottom-icon"></div>
    `;

    // Remove placeholders when React hydrates - use passive observer to avoid forced reflows
    const cleanupPlaceholders = () => {
      if (document.body.contains(preBottomBar)) {
        document.body.removeChild(preBottomBar);
      }
    };

    // Use requestIdleCallback for non-blocking cleanup, fallback to setTimeout
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(cleanupPlaceholders, { timeout: 1000 });
    } else {
      setTimeout(cleanupPlaceholders, 500);
    }

    // Mark document as ready for render before JS is loaded
    document.documentElement.dataset.ready = 'true';
    document.documentElement.classList.add('force-instant-display');
  })();
}

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
    MaterialIcons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Initialize deep linking (keep this for potential OAuth returns)
  useEffect(() => {
    const subscription = Linking.addEventListener('url', () => {
      // AuthContext might handle session from deep link via onAuthStateChange or specific logic
    });
    const getInitialLink = async () => {
      await Linking.getInitialURL();
    };
    getInitialLink();
    return () => {
      subscription.remove();
    };
  }, []);

  if (!loaded) {
    return null;
  }

  // Wrap the navigation stack with providers
  return (
    <PostHogProvider>
      <LanguageProvider>
        <AuthProvider>
          <Suspense fallback={<View style={{ flex: 1, backgroundColor: '#121212' }} />}>
            <PremiumProvider>
              <CalculationHistoryProvider>
                <GoogleOneTapProvider>
                  <RootLayoutNav />
                </GoogleOneTapProvider>
              </CalculationHistoryProvider>
            </PremiumProvider>
          </Suspense>
        </AuthProvider>
      </LanguageProvider>
    </PostHogProvider>
  );
}

// RootLayout is already exported as default above

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  // Use the protection hook inside the AuthProvider context
  useProtectedRoute();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="modal"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="auth"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
