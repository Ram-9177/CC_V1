import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import type { RBACPermissions } from '@/types'

/**
 * Fetches the DB-driven RBAC permission payload for the current user.
 * Returns the same data shape as GET /api/auth/my-permissions/.
 * Results are cached for 5 minutes; the query is only enabled when
 * the user is authenticated.
 */
export function useMyPermissions() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const userId = useAuthStore((s) => s.user?.id)

  return useQuery<RBACPermissions>({
    queryKey: ['my-permissions', userId],
    queryFn: async () => {
      const res = await api.get<RBACPermissions>('/auth/my-permissions/')
      return res.data
    },
    enabled: Boolean(isAuthenticated && userId),
    staleTime: 5 * 60 * 1000,    // data is fresh for 5 min
    gcTime: 10 * 60 * 1000,      // keep in cache for 10 min after unmount
    retry: 1,
  })
}
