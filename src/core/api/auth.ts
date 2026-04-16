import axios from 'axios'
import type { AxiosInstance } from 'axios'
import { useAuthStore } from '@/lib/store'

export const createRefreshAccessToken = (apiBaseUrl: string) => {
  return async (): Promise<void> => {
    try {
      const response = await axios.post(`${apiBaseUrl}/auth/token/refresh/`, {}, {
        withCredentials: true,
      })

      if (response.data?.tokens?.access || response.data?.access) {
        const newToken = response.data?.tokens?.access || response.data?.access
        useAuthStore.getState().setToken(newToken)
      }
    } catch (error) {
      if (axios.isAxiosError(error) && [400, 401, 403].includes(error.response?.status ?? 0)) {
        throw error
      }
      console.error('Refresh token API call failed:', error)
      throw error
    }
  }
}

export const createFreshAccessTokenGetter = (refreshAccessToken: () => Promise<void>) => {
  let refreshPromise: Promise<void> | null = null

  return async (): Promise<void> => {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null
      })
    }

    return refreshPromise
  }
}

export const createClearTokens = (api: AxiosInstance) => {
  return (): void => {
    api.post('/auth/logout/').catch(() => {})

    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    useAuthStore.getState().logout()
  }
}
