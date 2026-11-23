import * as SecureStore from 'expo-secure-store';

/**
 * iOS Keychain – obnovovací token a nastavení Face ID.
 * Na webu se nepoužívá (token je v httpOnly cookie), viz secureStorage.web.ts.
 */
const REFRESH_KEY = 'mtsales.refreshToken';
const BIOMETRIC_KEY = 'mtsales.biometricLock';
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const secureStorage = {
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_KEY, options),
  setRefreshToken: (token: string) => SecureStore.setItemAsync(REFRESH_KEY, token, options),
  clearRefreshToken: () => SecureStore.deleteItemAsync(REFRESH_KEY, options),
  async getBiometricLock(): Promise<boolean | null> {
    const v = await SecureStore.getItemAsync(BIOMETRIC_KEY, options);
    return v === null ? null : v === 'on';
  },
  setBiometricLock: (on: boolean) => SecureStore.setItemAsync(BIOMETRIC_KEY, on ? 'on' : 'off', options),
};
