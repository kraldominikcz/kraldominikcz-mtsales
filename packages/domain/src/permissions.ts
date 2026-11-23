import type { Role } from '@mtsales/shared';

/** Oprávnění v aplikaci. Kontrolují se vždy na serveru. */
export const PERMISSIONS = [
  'users.read',
  'users.manage',
  'customers.readAll',
  'reports.read',
  'settings.manage',
  'audit.read',
  'backoffice.work',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  sales: ['users.read'],
  manager: ['users.read', 'users.manage', 'customers.readAll', 'reports.read', 'settings.manage', 'audit.read'],
  backoffice: ['users.read', 'backoffice.work'],
};

export function permissionsFor(roles: readonly Role[]): Set<Permission> {
  const result = new Set<Permission>();
  for (const role of roles) for (const p of ROLE_PERMISSIONS[role] ?? []) result.add(p);
  return result;
}

export function can(roles: readonly Role[], permission: Permission): boolean {
  return permissionsFor(roles).has(permission);
}
