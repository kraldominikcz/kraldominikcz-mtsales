import type { AppDeps } from './deps';
import { AuditService } from './modules/audit/audit.service';
import { AuthService } from './modules/auth/auth.service';
import { UsersService } from './modules/users/users.service';
import type { Services } from './trpc/context';

export function createServices(deps: AppDeps): Services {
  const audit = new AuditService(deps);
  const auth = new AuthService(deps, audit);
  const users = new UsersService(deps, audit, auth);
  return { audit, auth, users };
}
