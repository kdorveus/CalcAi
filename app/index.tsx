import { Redirect } from 'expo-router';

// Root file now simply redirects to the main layout.
// Auth protection is handled in app/_layout.tsx.
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
