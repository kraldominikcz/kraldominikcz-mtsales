import { z } from 'zod';

/** Minimální požadavky na heslo: 12 znaků. Delší fráze jsou lepší než složitá krátká hesla. */
export const PASSWORD_MIN_LENGTH = 12;

export const emailSchema = z.email().trim().toLowerCase().max(254);
export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(200);
export const totpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Kód má 6 číslic');
/** Záložní kód: 10 znaků, volitelně s pomlčkou uprostřed (xxxxx-xxxxx). */
export const recoveryCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]{5}-?[a-z0-9]{5}$/, 'Neplatný záložní kód');

export const loginInput = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
  deviceName: z.string().trim().max(100).optional(),
});

export const changeInitialPasswordInput = z.object({
  onboardingToken: z.string().min(1),
  newPassword: passwordSchema,
});

export const totpSetupStartInput = z.object({ onboardingToken: z.string().min(1) });

export const totpSetupConfirmInput = z.object({
  onboardingToken: z.string().min(1),
  code: totpCodeSchema,
  deviceName: z.string().trim().max(100).optional(),
});

export const totpVerifyInput = z
  .object({
    challengeToken: z.string().min(1),
    code: totpCodeSchema.optional(),
    recoveryCode: recoveryCodeSchema.optional(),
    deviceName: z.string().trim().max(100).optional(),
  })
  .refine((v) => Boolean(v.code) !== Boolean(v.recoveryCode), {
    message: 'Zadejte buď kód z aplikace, nebo záložní kód',
  });

export const refreshInput = z.object({ refreshToken: z.string().min(1).optional() }).nullish();

/** Výsledek prvního kroku přihlášení. */
export type LoginResult =
  | { status: 'password_change_required'; onboardingToken: string }
  | { status: 'totp_setup_required'; onboardingToken: string }
  | { status: 'totp_required'; challengeToken: string };

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  /** Vrací se jen nativní aplikaci (iOS). Web dostává refresh token v httpOnly cookie. */
  refreshToken?: string;
}
