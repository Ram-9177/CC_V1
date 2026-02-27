import axios, { AxiosError, AxiosRequestConfig } from 'axios'
import { useAuthStore } from './store'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

type TokenRefreshResponse = { access: string; refresh?: string }

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30s to accommodate Render free-tier cold starts
  withCredentials: true, // Enable CORS with credentials
})

// Prevent refresh token rotation races when multiple requests 401 at the same time.
let refreshPromise: Promise<TokenRefreshResponse> | null = null

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = async (refreshToken: string): Promise<TokenRefreshResponse> => {
  if (!refreshToken) {
    throw new Error('No refresh token available')
  }
  
  try {
    const response = await axios.post(`${API_BASE_URL}/token/refresh/`, {
      refresh: refreshToken,
    })
    return response.data as TokenRefreshResponse
  } catch (error) {
    console.error('Refresh token API call failed:', error)
    throw error // Throw the actual error so we can check the status
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Determine if an error is retryable
 */
const isRetryableError = (error: AxiosError): boolean => {
  if (error?.code === 'ECONNABORTED') return true
  if (!error?.response) return true
  const status = error.response.status
  return status >= 500 && status < 600
}

/**
 * Persist access token securely
 */
const persistAccessToken = (accessToken: string): void => {
  // Store in localStorage (note: in production, consider httpOnly cookies)
  localStorage.setItem('access_token', accessToken)
  useAuthStore.getState().setToken(accessToken)
}

/**
 * Persist refresh token securely
 */
const persistRefreshToken = (refreshToken: string | undefined): void => {
  if (!refreshToken) return
  // Store in localStorage
  localStorage.setItem('refresh_token', refreshToken)
}

/**
 * Get a fresh access token (shared promise to avoid concurrent refresh storms).
 */
const getFreshAccessToken = async (): Promise<TokenRefreshResponse> => {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) {
    throw new Error('No refresh token available')
  }

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(refreshToken)
      .then((data) => {
        persistAccessToken(data.access)
        persistRefreshToken(data.refresh)
        return data
      })
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
  const refreshToken = localStorage.getItem('refresh_token')
  
  // Fire-and-forget: Tell server to blacklist the refresh token
  if (refreshToken) {
    api.post('/auth/logout/', { refresh: refreshToken }).catch(() => {})
  }
  
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  useAuthStore.getState().logout()
}

// Request interceptor to add auth token and optimize caching
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    

    
    return config
  },
  (error) => {
    console.error('Request interceptor error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor to handle token refresh and errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean; _retryCount?: number }

    if (!originalRequest) {
      return Promise.reject(error)
    }

    const isRefreshRequest = originalRequest.url?.includes('/token/refresh/')
    const maxRetries = 3
    const retryCount = originalRequest._retryCount || 0

    // Retry on network errors
    if (!isRefreshRequest && isRetryableError(error) && retryCount < maxRetries) {
      originalRequest._retryCount = retryCount + 1
      const delay = Math.min(1000 * 2 ** retryCount, 8000)
      await sleep(delay)
      return api(originalRequest)
    }

    // Handle 401 Unauthorized - try to refresh token
    const isLoginRequest = originalRequest.url?.includes('/auth/login/')
    if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest) {
      originalRequest._retry = true

      try {
        const data = await getFreshAccessToken()

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${data.access}`
        return api(originalRequest)
      } catch (refreshError: unknown) {
        // Only logout if the refresh token itself is invalid (401 or 400)
        // If it's a network error (5xx or timeout), don't logout - just let the request fail
        const status = axios.isAxiosError(refreshError) ? refreshError.response?.status : null
        if (status === 401 || status === 400) {
          console.warn('Refresh token invalid or expired. Logging out.')
          clearTokens()
          window.location.href = '/login'
        } else {
          console.error('Network or server error during token refresh. Not logging out.', refreshError)
        }
        return Promise.reject(refreshError)
      }
    }

    // Handle 403 Forbidden - permission denied
    if (error.response?.status === 403) {
      const { toast } = await import('sonner')
      const responseData = error.response.data as Record<string, unknown>;
      const detail = responseData?.detail || responseData?.message || 'Permission denied. You don\'t have access to this resource.';
      toast.error(detail)
    }

    // Handle 429 Too Many Requests - rate limited
    if (error.response?.status === 429) {
      const { toast } = await import('sonner')
      const retryAfter = error.response.headers?.['retry-after']
      const waitMsg = retryAfter ? ` Please wait ${retryAfter} seconds.` : ' Please slow down and try again.'
      toast.warning('Too many requests.' + waitMsg)
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
