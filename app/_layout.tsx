import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import * as Linking from 'expo-linking';
import { AuthProvider, useProtectedRoute } from '../contexts/AuthContext';
// import { router } from 'expo-router'; // No longer directly needed here

import { useColorScheme } from 'react-native';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
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
      console.log('Incoming link:', url);
      // AuthContext might handle session from deep link via onAuthStateChange or specific logic
    });
    const getInitialLink = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        console.log('App opened with link:', initialUrl);
      }
    };
    getInitialLink();
    return () => {
      subscription.remove();
    };
  }, []);

  if (!loaded) {
    return null;
  }

  // Wrap the navigation stack with AuthProvider
  return (
      <AuthProvider>
          <RootLayoutNav />
      </AuthProvider>
  );

}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  
  // Use the protection hook inside the AuthProvider context
  useProtectedRoute(); 

  return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Define screens accessible within the protected layout */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          {/* Auth screens are typically handled by redirection logic, but define the group */}
          <Stack.Screen name="auth" options={{ headerShown: false }}/> 
        </Stack>
      </ThemeProvider>
  );
}
