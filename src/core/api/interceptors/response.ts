import axios, { AxiosError, AxiosRequestConfig, type AxiosInstance, type AxiosResponse } from 'axios'
import { perfMonitor } from '@/lib/perfMonitor'
import { isAuthPath, isRetryableError, sleep } from '@/core/api/errors'

type ApiErrorDeps = {
  api: AxiosInstance
  getFreshAccessToken: () => Promise<void>
  clearTokens: () => void
}

export const handleApiResponseSuccess = (response: AxiosResponse) => {
  const startTime = (response.config as AxiosRequestConfig & { _startTime?: number })._startTime
  if (startTime && typeof startTime === 'number') {
    const duration = performance.now() - startTime
    const url = response.config.url || ''
    const method = response.config.method || 'GET'
    perfMonitor.recordMetric(url, method, duration, response.status)
  }
  return response
}

export const createApiResponseErrorHandler = ({
  api,
  getFreshAccessToken,
  clearTokens,
}: ApiErrorDeps) => {
  return async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean; _retryCount?: number }

    if (!originalRequest) {
      return Promise.reject(error)
    }

    const isSilent = originalRequest.params?._silent === true
    if (isSilent && error.response?.status === 401) {
      return Promise.reject(error)
    }

    const isLoginRequest = isAuthPath(originalRequest.url, 'auth/login/')
    const isRegisterRequest = isAuthPath(originalRequest.url, 'auth/register/')
    const isRefreshRequest = isAuthPath(originalRequest.url, 'auth/token/refresh/')
    const maxRetries = 1
    const retryCount = originalRequest._retryCount || 0

    if (!isRefreshRequest && !isLoginRequest && isRetryableError(error) && retryCount < maxRetries) {
      originalRequest._retryCount = retryCount + 1
      const delay = Math.min(1000 * 2 ** retryCount, 8000)
      console.log(`[API] Retrying request (${retryCount + 1}/${maxRetries}) after ${delay}ms...`)
      await sleep(delay)
      return api(originalRequest)
    }

    const isPasswordResetRequest = isAuthPath(originalRequest.url, 'auth/password-reset/')
      || isAuthPath(originalRequest.url, 'auth/password-reset-confirm/')
      || isAuthPath(originalRequest.url, 'auth/otp-request/')
      || isAuthPath(originalRequest.url, 'auth/otp-verify/')

    if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest && !isRegisterRequest && !isPasswordResetRequest) {
      originalRequest._retry = true

      try {
        await getFreshAccessToken()
        return api(originalRequest)
      } catch (refreshError: unknown) {
        const status = axios.isAxiosError(refreshError) ? refreshError.response?.status : null
        if (status === 401 || status === 400) {
          console.warn('Refresh cookie invalid or expired. Force redirecting to login.')
          clearTokens()
          window.location.href = '/login?session_expired=1'
        } else {
          console.error('Auth refresh error. Not logging out yet.', refreshError)
        }
        return Promise.reject(refreshError)
      }
    }

    if (error.response?.status === 403) {
      const responseData = error.response.data as Record<string, unknown>
      const isBootstrap = isAuthPath(originalRequest.url, 'auth/profile/')

      if (responseData?.code === 'COLLEGE_DISABLED') {
        const { useAuthStore } = await import('@/lib/store')
        useAuthStore.getState().logout()
        const collegeName = encodeURIComponent(String(responseData.college_name || ''))
        const msg = encodeURIComponent(String(responseData.detail || ''))
        window.location.href = `/login?college_disabled=1&college=${collegeName}&message=${msg}`
        return Promise.reject(error)
      }

      if (responseData?.code === 'HOSTEL_DISABLED') {
        const { useAuthStore } = await import('@/lib/store')
        useAuthStore.getState().logout()
        const hostelName = encodeURIComponent(String(responseData.hostel_name || ''))
        const msg = encodeURIComponent(String(responseData.detail || ''))
        window.location.href = `/login?hostel_disabled=1&hostel=${hostelName}&message=${msg}`
        return Promise.reject(error)
      }

      if (responseData?.code === 'BLOCK_DISABLED') {
        const { useAuthStore } = await import('@/lib/store')
        useAuthStore.getState().logout()
        const blockName = encodeURIComponent(String(responseData.block_name || ''))
        const msg = encodeURIComponent(String(responseData.detail || ''))
        window.location.href = `/login?block_disabled=1&block=${blockName}&message=${msg}`
        return Promise.reject(error)
      }

      if (responseData?.code === 'FLOOR_DISABLED') {
        const { useAuthStore } = await import('@/lib/store')
        useAuthStore.getState().logout()
        const floorNum = encodeURIComponent(String(responseData.floor_num || ''))
        const msg = encodeURIComponent(String(responseData.detail || ''))
        window.location.href = `/login?floor_disabled=1&floor=${floorNum}&message=${msg}`
        return Promise.reject(error)
      }

      if (!isBootstrap) {
        const { toast } = await import('sonner')
        const detail = responseData?.detail || responseData?.message || 'Permission denied. You don\'t have access to this resource.'
        toast.error(String(detail), {
          id: '403-forbidden',
          action: {
            label: 'Clear All',
            onClick: () => toast.dismiss(),
          },
        })
      }
    }

    if (error.response?.status === 429) {
      const { toast } = await import('sonner')
      const retryAfter = error.response.headers?.['retry-after']
      const waitMsg = retryAfter ? ` Please wait ${retryAfter} seconds.` : ' Please slow down and try again.'
      toast.warning('Too many requests.' + waitMsg, {
        id: '429-rate-limit',
        action: {
          label: 'Clear All',
          onClick: () => toast.dismiss(),
        },
      })
    }

    if (error.response?.status === 404) {
      console.warn('Resource not found')
    }

    return Promise.reject(error)
  }
}
