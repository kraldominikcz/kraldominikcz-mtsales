/** Web: obnovovací token drží prohlížeč v httpOnly cookie, JavaScript k němu nemá přístup. */
export const secureStorage = {
  getRefreshToken: async (): Promise<string | null> => null,
  setRefreshToken: async (_token: string) => {},
  clearRefreshToken: async () => {},
  getBiometricLock: async (): Promise<boolean | null> => false,
  setBiometricLock: async (_on: boolean) => {},
};
