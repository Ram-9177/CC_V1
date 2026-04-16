import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { useQueryClient } from '@tanstack/react-query'
import { api, refreshAccessToken } from '@/lib/api'
import { queryKeys } from '@/core/query/keys'
import { useAuthStore } from '@/lib/store'
import type { User } from '@/types'

export function useSessionBootstrap() {
  const hasHydrated = useAuthStore((state) => state.hasHydrated)
  const setUser = useAuthStore((state) => state.setUser)
  const logout = useAuthStore((state) => state.logout)
  const queryClient = useQueryClient()

  const bootstrappedSessionRef = useRef(false)
  const [isSessionVerified, setIsSessionVerified] = useState(false)

  useEffect(() => {
    if (!hasHydrated) return

    if (bootstrappedSessionRef.current) {
      if (!isSessionVerified) setIsSessionVerified(true)
      return
    }

    bootstrappedSessionRef.current = true
    let isMounted = true

    const bootstrap = async () => {
      try {
        // Keep access token in memory only; refresh from HttpOnly cookie at startup.
        // If no refresh cookie exists, this can return 401 and we continue silently.
        const hasRefreshCookie = document.cookie
          .split(';')
          .some((cookie) => cookie.trim().startsWith('refresh_token='))

        if (hasRefreshCookie) {
          await refreshAccessToken().catch(() => undefined)
        }

        const profileRes = await api.get('/auth/profile/', {
          params: { _silent: true },
        })

        if (isMounted) {
          setUser(profileRes.data as User)

          // Prime permissions eagerly without blocking route rendering.
          queryClient.prefetchQuery({
            queryKey: queryKeys.myPermissions.byUser((profileRes.data as User)?.id),
            queryFn: async () => (await api.get('/auth/my-permissions/')).data,
          }).catch(() => undefined)
        }
      } catch (error: unknown) {
        if (isMounted && axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
          logout()
        }
      } finally {
        if (isMounted) {
          setIsSessionVerified(true)
        }
      }
    }

    bootstrap()
    return () => {
      isMounted = false
    }
  }, [hasHydrated, isSessionVerified, logout, queryClient, setUser])

  return isSessionVerified
}
