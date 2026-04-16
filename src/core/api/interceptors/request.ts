import type { InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/lib/store'
import { isAuthPath } from '@/core/api/errors'

export const applyApiRequestInterceptor = (
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig => {
  const isLogin = isAuthPath(config.url, 'auth/login/')
  const isRegister = isAuthPath(config.url, 'auth/register/')
  const isRefresh = isAuthPath(config.url, 'auth/token/refresh/')

  const token = useAuthStore.getState().token
  if (token && !isLogin && !isRegister && !isRefresh) {
    config.headers.Authorization = `Bearer ${token}`
  }

  let url = config.url || ''

  if (url.startsWith('http')) return config

  if (url.startsWith('/')) {
    url = url.substring(1)
  }

  if (!config.baseURL && !url.startsWith('api/')) {
    url = `api/${url}`
  }

  if (config.baseURL?.endsWith('/api') && url.startsWith('api/')) {
    url = url.substring(4)
  }
  if (config.baseURL?.endsWith('/api/') && url.startsWith('api/')) {
    url = url.substring(4)
  }

  const isMutating = ['post', 'put', 'patch'].includes(config.method?.toLowerCase() || '')
  const isAuth = isLogin || isRegister || isRefresh

  if (isMutating && !isAuth && !config.headers['Idempotency-Key']) {
    config.headers['Idempotency-Key'] = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }

  config.url = url.replace(/\/+/g, '/')

  return config
}
