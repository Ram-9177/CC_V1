import type { AxiosError } from 'axios'

export const normalizeUrlPath = (url?: string): string => {
  if (!url) return ''
  return url.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '').replace(/\/+/g, '/')
}

export const isAuthPath = (url: string | undefined, path: string): boolean => {
  const normalized = normalizeUrlPath(url)
  const target = path.replace(/^\/+/, '').replace(/\/+/g, '/')
  return normalized === target || normalized.endsWith(`/${target}`)
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const isRetryableError = (error: AxiosError): boolean => {
  if (error?.code === 'ECONNABORTED') return true
  if (!error?.response) return true
  const status = error.response.status
  return status >= 500 && status < 600
}
