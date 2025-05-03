import { Slot, usePathname } from 'expo-router';
import { Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Redirect } from 'expo-router';

export default function RootLayout() {
  const { user } = useAuth();
  const pathname = usePathname();

  // Only check auth for web platform and webhook paths
  if (Platform.OS === 'web') {
    const isWebhookPath = pathname.includes('/webhook');
    if (isWebhookPath && !user) {
      return <Redirect href="/auth/login" />;
    }
  }

  // For mobile, let the useProtectedRoute hook handle navigation
  return <Slot />;
}
