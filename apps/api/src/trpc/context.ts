import type { Permission } from '@mtsales/domain';
import type { Role } from '@mtsales/shared';
import type { AppDeps } from '../deps';
import type { AuditService } from '../modules/audit/audit.service';
import type { AuthService } from '../modules/auth/auth.service';
import type { UsersService } from '../modules/users/users.service';

export type ClientKind = 'web' | 'native';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  permissions: Set<Permission>;
  sessionId: string;
}

export interface Services {
  audit: AuditService;
  auth: AuthService;
  users: UsersService;
}

/** Abstrakce nad cookie s obnovovacím tokenem (web). V testech se nahrazuje. */
export interface RefreshCookie {
  get(): string | undefined;
  set(token: string, expiresAt: Date): void;
  clear(): void;
}

export interface RequestContext {
  deps: AppDeps;
  services: Services;
  client: ClientKind;
  user: AuthUser | null;
  refreshCookie: RefreshCookie;
}
