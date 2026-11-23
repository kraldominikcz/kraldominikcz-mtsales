export const ROLES = ['sales', 'manager', 'backoffice'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  sales: 'Obchodník',
  manager: 'Manažer',
  backoffice: 'Backoffice',
};
