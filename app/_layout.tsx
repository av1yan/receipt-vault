import { Caprasimo_400Regular } from '@expo-google-fonts/caprasimo';
import {
  Figtree_400Regular,
  Figtree_600SemiBold,
  Figtree_700Bold,
  useFonts,
} from '@expo-google-fonts/figtree';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LockGate } from '../components/LockGate';
import { AppearanceProvider } from '../lib/appearance';
import { configureNotifications, initReminderSettings } from '../lib/notifications';
import { colors } from '../lib/theme';
import { VaultProvider } from '../lib/store';

export default function RootLayout() {
  const [loaded] = useFonts({
    Caprasimo_400Regular,
    Figtree_400Regular,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });

  useEffect(() => {
    configureNotifications();
    initReminderSettings();
  }, []);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider>
      <AppearanceProvider>
      <VaultProvider>
        <LockGate>
        {/* Phone-width column: on wide screens (web) the app renders centered at
            phone width so the layout matches the design's device frame. No effect
            on a real phone, where the screen is already narrower than the cap. */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.neutral[300], alignItems: 'center' }}>
          <View style={{ flex: 1, width: '100%', maxWidth: 440, backgroundColor: colors.bg, overflow: 'hidden' }}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="claim/[id]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="edit/[id]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="sync" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="settings" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="insights" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="receipt/[id]" options={{ presentation: 'transparentModal', animation: 'fade' }} />
            </Stack>
          </View>
        </View>
        </LockGate>
      </VaultProvider>
      </AppearanceProvider>
    </SafeAreaProvider>
  );
}
