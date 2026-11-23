import * as LocalAuthentication from 'expo-local-authentication';
import { cs } from '@mtsales/shared';

export async function biometricsAvailable(): Promise<boolean> {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function authenticateBiometric(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: cs.auth.biometricPrompt,
    cancelLabel: cs.common.cancel,
  });
  return result.success;
}
