import '@/global.css';

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colorScheme } from 'nativewind';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { usePrefs } from '@/lib/store';
import { useColors } from '@/lib/useColors';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

export default function RootLayout() {
  const theme = usePrefs((s) => s.theme);
  const c = useColors();

  // Keep NativeWind's dark/light scheme in sync with the user's preference.
  useEffect(() => {
    colorScheme.set(theme);
  }, [theme]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="add" options={{ presentation: 'modal' }} />
            <Stack.Screen name="menu" options={{ presentation: 'modal' }} />
            <Stack.Screen name="tx/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="day/[day]" options={{ presentation: 'modal' }} />
          </Stack>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
