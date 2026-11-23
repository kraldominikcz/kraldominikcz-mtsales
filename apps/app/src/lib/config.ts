import { Platform } from 'react-native';

/**
 * Adresa API. Na webu v produkci běží API na stejné doméně (Caddy → /api), proto prázdný řetězec.
 * Pro vývoj se nastaví EXPO_PUBLIC_API_URL (např. http://localhost:3000 nebo IP Macu v síti pro iPhone).
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
export const TRPC_URL = `${API_URL}/api/trpc`;
export const IS_WEB = Platform.OS === 'web';
export const CLIENT_KIND: 'web' | 'native' = IS_WEB ? 'web' : 'native';
/** Po jak dlouhé době v pozadí se aplikace znovu zamkne Face ID. */
export const RELOCK_AFTER_MS = 5 * 60_000;
