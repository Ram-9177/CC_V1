import axios, { type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { applyApiRequestInterceptor } from '@/core/api/interceptors/request'
import { handleApiResponseSuccess, createApiResponseErrorHandler } from '@/core/api/interceptors/response'
import { createRefreshAccessToken, createFreshAccessTokenGetter, createClearTokens } from '@/core/api/auth'
import { createDownloadFile } from '@/core/api/download'

export const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 20000,
  withCredentials: true,
})

export const refreshAccessToken = createRefreshAccessToken(API_BASE_URL)
export const getFreshAccessToken = createFreshAccessTokenGetter(refreshAccessToken)
export const clearTokens = createClearTokens(api)

const requestCache = new Map<string, Promise<AxiosResponse<unknown>>>()

api.interceptors.request.use((config) => {
  ;(config as AxiosRequestConfig & { _startTime?: number })._startTime = performance.now()
  return config
}, (error) => Promise.reject(error))

api.interceptors.request.use(
  applyApiRequestInterceptor,
  (error) => Promise.reject(error)
)

const originalGet = api.get.bind(api)
api.get = <T = unknown, R = AxiosResponse<T>, D = unknown>(
  url: string,
  config?: AxiosRequestConfig<D>
): Promise<R> => {
  const cacheKey = `GET:${url}${config?.params ? JSON.stringify(config.params) : ''}`

  const cached = requestCache.get(cacheKey)
  if (cached) {
    return cached as Promise<R>
  }

  const request = originalGet(url, config) as Promise<R>
  requestCache.set(cacheKey, request as Promise<AxiosResponse<unknown>>)

  return request.finally(() => {
    requestCache.delete(cacheKey)
  })
}

api.interceptors.response.use(
  handleApiResponseSuccess,
  createApiResponseErrorHandler({
    api,
    getFreshAccessToken,
    clearTokens,
  })
)

export const downloadFile = createDownloadFile(api)

export type { AxiosRequestConfig, InternalAxiosRequestConfig }

export default api
