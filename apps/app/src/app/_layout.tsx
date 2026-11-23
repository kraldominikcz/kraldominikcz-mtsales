import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { session, useSessionStatus } from '@/lib/session';
import { queryClient, TRPCProvider, trpcClient } from '@/lib/trpc';
import { Loading } from '@/ui/components';

export default function RootLayout() {
  const status = useSessionStatus();

  useEffect(() => {
    void session.bootstrap();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
          <StatusBar style="dark" />
          {status === 'loading' ? (
            <Loading />
          ) : (
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Protected guard={status === 'signedIn'}>
                <Stack.Screen name="(app)" />
              </Stack.Protected>
              <Stack.Protected guard={status === 'signedOut'}>
                <Stack.Screen name="login" />
              </Stack.Protected>
              <Stack.Protected guard={status === 'locked'}>
                <Stack.Screen name="unlock" />
              </Stack.Protected>
            </Stack>
          )}
        </TRPCProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
