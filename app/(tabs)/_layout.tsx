import { Stack } from 'expo-router';
import React from 'react';

// Import icons or any other components needed for tabs
// Example using FontAwesome:
// import FontAwesome from '@expo/vector-icons/FontAwesome';

// Example TabIcon component (adjust as needed)
// const TabIcon = ({ name, color }: { name: string; color: string }) => {
//   return <FontAwesome size={28} name={name as any} color={color} style={{ marginBottom: -3 }} />;
// };

export default function TabLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // Keep headers hidden for tabs
        // Add any default Tab styling here if needed
      }}>
      <Stack.Screen
        name="index" // This corresponds to app/(tabs)/index.tsx
        // Add tab-specific options if needed (e.g., title, icon)
        // options={{
        //   title: 'Calculator',
        //   tabBarIcon: ({ color }) => <TabIcon name="calculator" color={color} />,
        // }}
      />
      {/* Add other screens within the (tabs) group here if needed */}
      {/* e.g., <Tabs.Screen name="settings" options={{ title: 'Settings' }} /> */}
    </Stack>
  );
} 