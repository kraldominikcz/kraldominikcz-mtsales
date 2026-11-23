import { z } from 'zod';
import { ROLES } from './roles';
import { emailSchema } from './auth';

export const roleSchema = z.enum(ROLES);

export const createUserInput = z.object({
  email: emailSchema,
  name: z.string().trim().min(2).max(120),
  roles: z.array(roleSchema).min(1),
  supervisorId: z.uuid().nullable().optional(),
});

export const updateUserInput = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(120).optional(),
  roles: z.array(roleSchema).min(1).optional(),
  supervisorId: z.uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const userIdInput = z.object({ id: z.uuid() });

export interface UserDto {
  id: string;
  email: string;
  name: string;
  roles: (typeof ROLES)[number][];
  supervisorId: string | null;
  isActive: boolean;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}
