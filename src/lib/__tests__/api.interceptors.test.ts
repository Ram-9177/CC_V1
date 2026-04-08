import { beforeEach, describe, expect, it } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import {
  applyApiRequestInterceptor,
  isAuthPath,
  normalizeUrlPath,
} from '@/lib/api'
import { useAuthStore } from '@/lib/store'

const makeConfig = (
  overrides: Partial<InternalAxiosRequestConfig> = {}
): InternalAxiosRequestConfig =>
  ({
    url: '/rooms/',
    method: 'get',
    baseURL: '/api',
    headers: {},
    ...overrides,
  }) as InternalAxiosRequestConfig

describe('api request interceptor', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
  })

  it('attaches bearer token for non-auth requests', () => {
    useAuthStore.getState().setToken('test-token')

    const config = applyApiRequestInterceptor(makeConfig({ url: '/rooms/list/' }))

    expect(String(config.headers.Authorization)).toBe('Bearer test-token')
  })

  it('does not attach bearer token for login requests', () => {
    useAuthStore.getState().setToken('test-token')

    const config = applyApiRequestInterceptor(makeConfig({ url: '/auth/login/' }))

    expect(config.headers.Authorization).toBeUndefined()
  })

  it('adds idempotency key for mutating non-auth requests', () => {
    const config = applyApiRequestInterceptor(
      makeConfig({ method: 'post', url: '/gate-passes/' })
    )

    expect(config.headers['Idempotency-Key']).toBeTruthy()
  })

  it('normalizes relative URL path when baseURL already includes /api', () => {
    const config = applyApiRequestInterceptor(
      makeConfig({ baseURL: '/api', url: '/api/notices/notices/' })
    )

    expect(config.url).toBe('notices/notices/')
  })
})

describe('api URL helpers', () => {
  it('normalizes absolute and duplicate-slash URLs', () => {
    expect(normalizeUrlPath('https://example.com//api//auth/login/')).toBe('api/auth/login/')
  })

  it('matches auth paths with and without prefixes', () => {
    expect(isAuthPath('/auth/login/', 'auth/login/')).toBe(true)
    expect(isAuthPath('https://example.com/api/auth/login/', 'auth/login/')).toBe(true)
    expect(isAuthPath('/rooms/', 'auth/login/')).toBe(false)
  })
})
