import axios, { AxiosError, AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from './store'

// Use VITE_API_URL or default to /api. Relative path is preferred for production to avoid CORS.
const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 20000,
  withCredentials: true,
})

let refreshPromise: Promise<void> | null = null
const requestCache = new Map<string, Promise<import('axios').AxiosResponse<unknown>>>();

export const normalizeUrlPath = (url?: string): string => {
  if (!url) return ''
  return url.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '').replace(/\/+/g, '/')
}

export const isAuthPath = (url: string | undefined, path: string): boolean => {
  const normalized = normalizeUrlPath(url)
  const target = path.replace(/^\/+/, '').replace(/\/+/g, '/')
  return normalized === target || normalized.endsWith(`/${target}`)
}

export const refreshAccessToken = async (): Promise<void> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {}, { 
      withCredentials: true 
    })
    // Also store tokens from body if provided (supporting dual storage: Cookie + localStorage)
    if (response.data?.tokens?.access || response.data?.access) {
      const newToken = response.data?.tokens?.access || response.data?.access;
      useAuthStore.getState().setToken(newToken);

    }
  } catch (error) {
    console.error('Refresh token API call failed:', error)
    throw error 
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const isRetryableError = (error: AxiosError): boolean => {
  if (error?.code === 'ECONNABORTED') return true
  if (!error?.response) return true
  const status = error.response.status
  return status >= 500 && status < 600
}

/**
 * Get a fresh access token via cookie refresh
 */
const getFreshAccessToken = async (): Promise<void> => {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken()
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

/**
 * Clear all auth tokens and notify the server
 */
export const clearTokens = (): void => {
  requestCache.clear()
  // Fire-and-forget: Tell server to blacklist and clear cookies
  api.post('/auth/logout/').catch(() => {})

  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  useAuthStore.getState().logout()
}

// Simplified Request Interceptor
export const applyApiRequestInterceptor = (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    // Attach authorization token if it exists in the store
    // SKIP for auth requests (login/register/refresh) to prevent server 401 on OLD tokens
    const isLogin = isAuthPath(config.url, 'auth/login/')
    const isRegister = isAuthPath(config.url, 'auth/register/')
    const isRefresh = isAuthPath(config.url, 'auth/token/refresh/')

    const token = useAuthStore.getState().token;
    if (token && !isLogin && !isRegister && !isRefresh) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    let url = config.url || '';
    
    // 1. If absolute URL, do nothing
    if (url.startsWith('http')) return config;

    // 2. Remove leading slash if using relative paths with baseURL to avoid axios double-slash issues,
    // but ensures we have a clean relative path.
    if (url.startsWith('/')) {
        url = url.substring(1);
    }

    // 3. Prevent double-prefixing if the URL already contains 'api/' or 'auth/' etc.
    // However, since we have baseURL='/api', its better to just pass the raw endpoint.
    // We only touch it if it's missing entirely and we're NOT using a baseURL.
    if (!config.baseURL && !url.startsWith('api/')) {
        url = `api/${url}`;
    }
    
    // 4. Specifically handle the common case where /api is accidentally duplicated in the code vs baseURL
    if (config.baseURL?.endsWith('/api') && url.startsWith('api/')) {
        url = url.substring(4);
    }
    if (config.baseURL?.endsWith('/api/') && url.startsWith('api/')) {
        url = url.substring(4);
    }

    // 5. Automated Institutional Idempotency
    // All mutating requests MUST have a unique Idempotency-Key to prevent 
    // duplicate side-effects. SKIP for auth requests to ensure simple CORS.
    const isMutating = ['post', 'put', 'patch'].includes(config.method?.toLowerCase() || '')
    const isAuth = isLogin || isRegister || isRefresh
    
    if (isMutating && !isAuth && !config.headers['Idempotency-Key']) {
      config.headers['Idempotency-Key'] = typeof crypto.randomUUID === 'function' 
        ? crypto.randomUUID() 
        : `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }

    config.url = url.replace(/\/+/g, '/'); // Clean up slashes
    
    return config
}

api.interceptors.request.use(
  applyApiRequestInterceptor,
  (error) => {
    return Promise.reject(error)
  }
)

/**
 * Enhanced GET method with request deduplication
 * Prevents multiple simultaneous requests for the same endpoint
 */
const originalGet = api.get.bind(api);
api.get = <T = unknown, R = import('axios').AxiosResponse<T>, D = unknown>(url: string, config?: import('axios').AxiosRequestConfig<D>): Promise<R> => {
  // Dedupe in-flight GETs only when URL + params + auth snapshot match. Omitting auth caused
  // a 401 (no Bearer yet) to be shared after refresh/hydration set a valid token — same console 401 on /metrics/activities/.
  const authTag = useAuthStore.getState().token ?? ''
  const cacheKey = `GET:${authTag}:${url}${config?.params ? JSON.stringify(config.params) : ''}`

  const cached = requestCache.get(cacheKey)
  if (cached) {
    return cached as Promise<R>
  }

  const request = originalGet(url, config) as Promise<R>
  requestCache.set(cacheKey, request as Promise<import('axios').AxiosResponse<unknown>>)

  return request.finally(() => {
    requestCache.delete(cacheKey)
  })
}


// Response interceptor to handle token refresh and errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean; _retryCount?: number }

    if (!originalRequest) {
      return Promise.reject(error)
    }

    const isLoginRequest = isAuthPath(originalRequest.url, 'auth/login/')
    const isRegisterRequest = isAuthPath(originalRequest.url, 'auth/register/')
    const isRefreshRequest = isAuthPath(originalRequest.url, 'auth/token/refresh/')
    const maxRetries = 1
    const retryCount = originalRequest._retryCount || 0

    // Retry on network errors or 5xx server errors
    if (!isRefreshRequest && !isLoginRequest && isRetryableError(error) && retryCount < maxRetries) {
      originalRequest._retryCount = retryCount + 1
      const delay = Math.min(1000 * 2 ** retryCount, 8000)
      console.log(`[API] Retrying request (${retryCount + 1}/${maxRetries}) after ${delay}ms...`)
      await sleep(delay)
      return api(originalRequest)
    }

    // Handle 401 Unauthorized - try to refresh token via cookie
    const isPasswordResetRequest = isAuthPath(originalRequest.url, 'auth/password-reset/')
      || isAuthPath(originalRequest.url, 'auth/password-reset-confirm/')
      || isAuthPath(originalRequest.url, 'auth/otp-request/')
      || isAuthPath(originalRequest.url, 'auth/otp-verify/')

    if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest && !isRegisterRequest && !isPasswordResetRequest) {
      originalRequest._retry = true

      try {
        await getFreshAccessToken()
        // Retry original request - cookies will be sent automatically
        return api(originalRequest)
      } catch (refreshError: unknown) {
        // Only logout if the refresh token itself is invalid (401 or 400)
        const status = axios.isAxiosError(refreshError) ? refreshError.response?.status : null
        if (status === 401 || status === 400) {
          console.warn('Refresh cookie invalid or expired. Force redirecting to login.');
          clearTokens();
          // Hard redirect to ensure the user is kicked out of a dead session
          window.location.href = '/login?session_expired=1';
        } else {
          console.error('Auth refresh error. Not logging out yet.', refreshError)
        }
        return Promise.reject(refreshError)
      }
    }

    // Handle 403 Forbidden - permission denied
    // Suppress toast for /profile/ (bootstrap auth check) to avoid false "Permission denied" on refresh
    if (error.response?.status === 403) {
      const responseData = error.response.data as Record<string, unknown>;
      const isBootstrap = isAuthPath(originalRequest.url, 'auth/profile/')

      // College disabled — force logout and redirect to login with message
      if (responseData?.code === 'COLLEGE_DISABLED') {
        const { useAuthStore } = await import('@/lib/store')
        useAuthStore.getState().logout()
        const collegeName = encodeURIComponent(String(responseData.college_name || ''))
        const msg = encodeURIComponent(String(responseData.detail || ''))
        window.location.href = `/login?college_disabled=1&college=${collegeName}&message=${msg}`
        return Promise.reject(error)
      }

      // Hostel disabled — force logout and redirect to login with message
      if (responseData?.code === 'HOSTEL_DISABLED') {
        const { useAuthStore } = await import('@/lib/store')
        useAuthStore.getState().logout()
        const hostelName = encodeURIComponent(String(responseData.hostel_name || ''))
        const msg = encodeURIComponent(String(responseData.detail || ''))
        window.location.href = `/login?hostel_disabled=1&hostel=${hostelName}&message=${msg}`
        return Promise.reject(error)
      }

      // Block disabled — force logout and redirect to login with message
      if (responseData?.code === 'BLOCK_DISABLED') {
        const { useAuthStore } = await import('@/lib/store')
        useAuthStore.getState().logout()
        const blockName = encodeURIComponent(String(responseData.block_name || ''))
        const msg = encodeURIComponent(String(responseData.detail || ''))
        window.location.href = `/login?block_disabled=1&block=${blockName}&message=${msg}`
        return Promise.reject(error)
      }

      // Floor disabled — force logout and redirect to login with message
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
        const detail = responseData?.detail || responseData?.message || 'Permission denied. You don\'t have access to this resource.';
        toast.error(String(detail), {
          id: '403-forbidden',
          action: {
            label: 'Clear All',
            onClick: () => toast.dismiss()
          }
        })
      }
    }

    // Handle 429 Too Many Requests - rate limited
    if (error.response?.status === 429) {
      const { toast } = await import('sonner')
      const retryAfter = error.response.headers?.['retry-after']
      const waitMsg = retryAfter ? ` Please wait ${retryAfter} seconds.` : ' Please slow down and try again.'
      toast.warning('Too many requests.' + waitMsg, {
        id: '429-rate-limit',
        action: {
          label: 'Clear All',
          onClick: () => toast.dismiss()
        }
      })
    }

    // Handle 404 Not Found
    if (error.response?.status === 404) {
      console.warn('Resource not found')
    }

    return Promise.reject(error)
  }
)

export const downloadFile = async (url: string, filename: string) => {
  try {
    const response = await api.get(url, { responseType: 'blob' });
    const href = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = href;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  } catch (error) {
    console.error('Download failed:', error);
    throw error;
  }
};

export default api;
