import { useQuery } from '@tanstack/react-query';
import { useTRPC } from './trpc';

export function useMe() {
  const trpc = useTRPC();
  const query = useQuery(trpc.auth.me.queryOptions());
  const can = (permission: string) => Boolean(query.data?.permissions.includes(permission as never));
  return { ...query, me: query.data, can };
}
