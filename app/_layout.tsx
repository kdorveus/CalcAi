import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, lazy, Suspense } from 'react';
import 'react-native-reanimated';
import * as Linking from 'expo-linking';
import { AuthProvider, useProtectedRoute } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { PostHogProvider } from '../contexts/PostHogContext';
import { Platform, View } from 'react-native';

const PremiumProvider = lazy(() => import('../contexts/PremiumContext').then(m => ({ default: m.PremiumProvider })));
const CalculationHistoryProvider = lazy(() => import('../contexts/CalculationHistoryContext').then(m => ({ default: m.CalculationHistoryProvider })));
// import { router } from 'expo-router'; // No longer directly needed here

import { useColorScheme } from 'react-native';

// Ultra-fast icon loading for web - preload critical icons as base64
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  // Immediate execution to ensure fastest possible loading
  (function() {
    // Add Google Search Console verification meta tag
    const googleVerification = document.createElement('meta');
    googleVerification.setAttribute('name', 'google-site-verification');
    googleVerification.setAttribute('content', 'wOCaX0XbPQ8ml7YSi8hkyjnZ2h_y_P0VWSUpBSt0Pic');
    document.head.appendChild(googleVerification);
    
    // Force Material Icons to load first - highest priority
    const materialIconsStyle = document.createElement('style');
    materialIconsStyle.id = 'critical-material-icons';
    materialIconsStyle.textContent = `
      /* Material Icons Font Face - Inline for instant loading */
      @font-face {
        font-family: 'Material Icons';
        font-style: normal;
        font-weight: 400;
        font-display: block; /* Critical font - block render until loaded */
        src: url(data:application/font-woff2;charset=utf-8;base64,d09GMgABAAAAAAVIAAsAAAAAC3wAAAT6AAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHFQGVgCDTAqJMIcsATYCJAMcCxAABCAFhGcHgSUbnQkjETaLkrIg+4uE2RPWhyehtJRdUk5JOTmUQ6mUb/e9vU8AwfH9fu3c9/FPLCFJNOrdzXQSzSSCJbFIiEQjFEKFUJmGl/+hL/1Rm2GBZBlYLh9QAQiwXP7/uXa6QdnB8gPNJW+KrAMcJdBAFEULCuiNeMIN42l6EQqoD08TaLeoErm+e2AEshLQL7BWuZXBXJkpNXSEVlNdsrKId1DTpqfkGnhrf18+jbHIoGo0AXs1NV2awm+eP3t2Hs7xCOV0HsA5nQksR8QSSBD9pTov5kS0LE60vd6sfQg0WqqCN4p6Es9mnp1nEHOiudnUBi0SRUNjQqrY/+M1qCb4zgPqN4T45vlMVEHAM+QjUOCZj0g51WJ10JBpAyUcgRXYB8QrEI9CHlI6PNrR2sYGCIDRxYEqLj4+JqbfIyUtNSWxz+2emJGY6JGelJDQpjGmFbPGmVsxW/5OlU4dJyIx/cYNZG5GTr9x7Rp97RrLXXv7NbK3c8pMa2LXppgXmUmZTbdBb+aM62sDFrGVSe17h9aWZYZcrYbcJg4zeTkwaErxhLbxjQMF/frFgP4R2o2CkZH74n5qBNGE+mfpRw9VrlkpZ6GgCFqFJGYgKtCvXfvRhP2bVwn2pAbHfG2e8bm1QO/pqU29j6WCPxL05t/3sCevOCl4JE3KNXr6/lNjl2EJ6+IW7j29Zg1XMr5y9WL9rlDliQnNTNw1M25YDGbRl1tJbvW4Np5xS8qVbp0+v0AwWD9l3sOVjlCQw2YeXfSofOGcuAXLFi+IW7Bk2fEFK5SztFrF4UMh4eDQEUNsylJL15NNQYdEQdCh4vBQoTh4ShwYOiweHDoiiNNQ2lXLVUlO7N7WlXQkp30l3L3zyTcdP6uMGm/KfnAny4GbHtwpZbTwpgDJgRKJsiJ3LI+K8MjuXRU7JXWkLN+4MZcxF27YmMNYuOF+Tkx04/0cYeGG3H4kEZaVu34Ll5XFOSU53ilskVmweNHq1X9+RebOWxdvnT9vLpnXf6N6OY2KR2tWvDMqfnv0mGjdOFXsCOlZ56lkmPSX8uy9K+Wvgw93JB8/dujnbPLf5FRlRvBQ26/rVzUdPHRrv+/0Pu5Kbb+pU1m5V50W1iSgXnGS/n4ZfeUP+t+kKJCnFJ5yxOqsqpUKqWRVVSm1jPBm36YzJkzMejDCd+RjKS0U9EgInBdKOilQmyJiYa42TKPF5c1JU2bF5S5ZnMctPZE7a5bLrLi8xUvyGPIFbwdLsI+I6dGXfUnMeq52j0fY4xhP6zHs+6Xwv9+PuRqEMH/L1g1fZ/j+mBGnMFYAwF+YAKBxYb4bOJCv58LvR/wffh3W0HHNQ2vVdCxq4r/xZ39Nqo7rXz22jdSz1rN/KFz9/P39JXz2vwqDPxV8KoAlYexPSxOr4o+YmfenD8vAgTkdYC3tDrQ2fQzSz/U3AARt5Wz+n3y9E0kUGtOToNJYBFFrGiQJWwS1DqugodURtDsxeX6HURhJSg2WvA0Qer0KlW5fQdTrOkjC3gdNv4+hMRggaLcZ6jt2mAjWKcPIFDofUzSIpZwjqBbmMCmJozQyQ74ZJ4mZcZYozQgXvBiPE3XDHCbxMUm5HKFDERPlmMyRocUYJYoaWD8S8Xi8Hu35DEFSFjQwRoqOHkZhoMw4HEJVgzmY7Nf3f2YwJjGO2KwIZf8GZwSOIa/Qpu2RrFdZxd12VWo4DAsfyEicGEGHVMjrQmMUY+DQKNRi5oORiAvnReg5m+6fpB+xPWmXV7nfpUKDFjqNdl5TnSJDpcw5Z7hfvGDalDATGb0GAAAA) format('woff2');
      }

      /* Critical class styles */
      .material-icons {
        font-family: 'Material Icons';
        font-weight: normal;
        font-style: normal;
        font-size: 24px;
        line-height: 1;
        letter-spacing: normal;
        text-transform: none;
        display: inline-block;
        white-space: nowrap;
        word-wrap: normal;
        direction: ltr;
        -webkit-font-feature-settings: 'liga';
        -webkit-font-smoothing: antialiased;
      }
    `;
    
    // Insert at the beginning of head for highest priority
    if (document.head.firstChild) {
      document.head.insertBefore(materialIconsStyle, document.head.firstChild);
    } else {
      document.head.appendChild(materialIconsStyle);
    }
    
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
    
    // Create inline icons for instant rendering
    const iconSamples = document.createElement('div');
    iconSamples.style.position = 'absolute';
    iconSamples.style.visibility = 'hidden';
    iconSamples.style.pointerEvents = 'none';
    
    // Pre-render key icons to cache them
    iconSamples.innerHTML = `
      <i class="material-icons">calculate</i>
      <i class="material-icons">mic</i>
      <i class="material-icons">settings</i>
      <i class="material-icons">send</i>
      <i class="material-icons">space_bar</i>
    `;
    
    // Add to body to ensure they're rendered
    document.body.appendChild(iconSamples);
    
    // Pre-render the bottom bar structure for immediate display
    const preBottomBar = document.createElement('div');
    preBottomBar.className = 'bottom-bar force-instant-display';
    preBottomBar.innerHTML = `
      <div class="bottom-icon">
        <i class="material-icons" style="color:#ccc;font-size:28px;">calculate</i>
      </div>
      <div class="center-button">
        <i class="material-icons" style="color:#eee;font-size:60px;">mic</i>
      </div>
      <div class="bottom-icon">
        <i class="material-icons" style="color:#ccc;font-size:28px;">settings</i>
      </div>
    `;
    
    // Remove after a short delay to avoid conflicts with React
    setTimeout(() => {
      if (document.body.contains(iconSamples)) {
        document.body.removeChild(iconSamples);
      }
      if (document.body.contains(preBottomBar)) {
        document.body.removeChild(preBottomBar);
      }
    }, 500);
    
    // Mark document as ready for render before JS is loaded
    document.documentElement.dataset.ready = "true";
    document.documentElement.classList.add('force-instant-display');

    // Define type for preload assets
    interface PreloadAsset {
      href: string;
      as: 'image' | 'script' | 'style' | 'font'; // Add other valid 'as' values if needed
      type?: string; // type is optional
    }

    // Preload critical assets
    const assetsToPreload: PreloadAsset[] = [
      { href: require('../assets/images/LOGO.webp').uri, as: 'image' },
      // Example for SVG if needed:
      // { href: require('../assets/icons/microphone.svg').uri, as: 'image', type: 'image/svg+xml' }, 
    ];

    assetsToPreload.forEach(asset => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = asset.href;
      link.as = asset.as;
      if (asset.type) {
        link.type = asset.type;
      }
      // Set fetchpriority to high for critical assets
      link.setAttribute('fetchpriority', 'high');
      document.head.appendChild(link);
    });

    // Preload main JS bundle (heuristic)
    // This path might need adjustment based on actual build output
    const mainBundleLink = document.createElement('link');
    mainBundleLink.rel = 'modulepreload';
    // Adjust href if you know the exact main bundle name/path from your build output
    // For Expo Web, it often includes content hashing, making this tricky without build info.
    // A common pattern might be '/_expo/static/js/web/entry-<hash>.js'
    // As a generic placeholder, we can try a common entry point name if known or defer this step.
    // For now, let's assume a common pattern or skip if too uncertain.
    // Example: mainBundleLink.href = '/path/to/main-bundle.js'; 
    // document.head.appendChild(mainBundleLink); 
    // --> Given the uncertainty of the bundle name, I will comment this out for now.
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
    'MaterialIcons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf'),
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
    const subscription = Linking.addEventListener('url', ({ url }) => {
      // AuthContext might handle session from deep link via onAuthStateChange or specific logic
    });
    const getInitialLink = async () => {
      const initialUrl = await Linking.getInitialURL();
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
                  <RootLayoutNav />
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
