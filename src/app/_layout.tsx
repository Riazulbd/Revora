import React, { useCallback, useEffect, useState } from 'react';
import { View, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationBar } from 'expo-navigation-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import {
  GoogleSansFlex_400Regular,
  GoogleSansFlex_500Medium,
  GoogleSansFlex_600SemiBold,
  GoogleSansFlex_700Bold,
  GoogleSansFlex_800ExtraBold,
} from '@expo-google-fonts/google-sans-flex';

import { ToastProvider, TransitioningProvider, useTransitionListeners } from '@/components';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { GarageProvider } from '@/features/bikes/GarageProvider';
import { BillingProvider } from '@/features/billing/BillingProvider';
import { createQueryClient } from '@/services/queryClient';
import { ThemeProvider, useTheme } from '@/theme';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Keep the Revora splash up until the fonts are ready, so the first frame is
// never unstyled text.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [queryClient] = useState(() => createQueryClient());
  const [fontsLoaded, fontError] = useFonts({
    GoogleSansFlex_400Regular,
    GoogleSansFlex_500Medium,
    GoogleSansFlex_600SemiBold,
    GoogleSansFlex_700Bold,
    GoogleSansFlex_800ExtraBold,
  });

  const onReady = useCallback(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  // A font that fails to download must not leave the rider on a blank splash.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ErrorBoundary>
              <AuthProvider>
                <GarageProvider>
                  <BillingProvider>
                    <ToastProvider>
                      <AppChrome />
                    </ToastProvider>
                  </BillingProvider>
                </GarageProvider>
              </AuthProvider>
            </ErrorBoundary>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * System chrome that has to follow the theme: the status bar icons and, on
 * Android, the navigation bar. Getting these wrong is the most visible dark-mode
 * bug there is (requirement 54).
 */
function AppChrome() {
  const { c, dark } = useTheme();
  const transition = useTransitionListeners();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {Platform.OS === 'android' ? <NavigationBar style={dark ? 'light' : 'dark'} /> : null}
      <TransitioningProvider active={transition.active}>
        <Stack
          screenListeners={transition.listeners}
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            // A screen under another one stops rendering while it is covered, so
            // the push animation is not sharing frames with a list it cannot see.
            freezeOnBlur: true,
            contentStyle: { backgroundColor: c.bg },
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
          <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        </Stack>
      </TransitioningProvider>
    </View>
  );
}
