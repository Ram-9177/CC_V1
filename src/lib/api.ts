import axios, { AxiosError, AxiosRequestConfig } from 'axios'
import { useAuthStore } from './store'

let API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// FIX: For HttpOnly cookies to work securely across our apex and 'www' domains, 
// the browser MUST treat API requests as SAME-ORIGIN. 
// We rely on Render's `render.yaml` rewrite rules to map `/api/*` transparently 
// to the backend. Thus, if we are in production, we force the API base to be 
// exactly `/api` to leverage this proxy perfectly without Cross-Origin blocks.
if (typeof window !== 'undefined') {
  const host = window.location.hostname;
  if (host.includes('samuraitechpark.in') || host.includes('hostelconnect-web')) {
    API_BASE_URL = '/api'
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, 
  withCredentials: true,
})

let refreshPromise: Promise<void> | null = null

export const refreshAccessToken = async (): Promise<void> => {
  try {
    await axios.post(`${API_BASE_URL}/token/refresh/`, {}, { 
      withCredentials: true 
    })
  } catch (error) {
    console.error('Refresh token API call failed:', error)
    throw error 
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isRetryableError = (error: AxiosError): boolean => {
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
  // Fire-and-forget: Tell server to blacklist and clear cookies
  api.post('/auth/logout/').catch(() => {})
  
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  useAuthStore.getState().logout()
}

// Cookie handling is automatic via withCredentials: true (set in axios default config)
api.interceptors.request.use(
  (config) => {
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

    // Handle 401 Unauthorized - try to refresh token via cookie
    const isLoginRequest = originalRequest.url?.includes('/auth/login/')
    if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest) {
      originalRequest._retry = true

      try {
        await getFreshAccessToken()
        // Retry original request - cookies will be sent automatically
        return api(originalRequest)
      } catch (refreshError: unknown) {
        // Only logout if the refresh token itself is invalid (401 or 400)
        const status = axios.isAxiosError(refreshError) ? refreshError.response?.status : null
        if (status === 401 || status === 400) {
          console.warn('Refresh cookie invalid or expired. Logging out.');
          clearTokens();
        } else {
          console.error('Auth refresh error. Not logging out yet.', refreshError)
        }
        return Promise.reject(refreshError)
      }
    }

    // Handle 403 Forbidden - permission denied
    if (error.response?.status === 403) {
      const { toast } = await import('sonner')
      const responseData = error.response.data as Record<string, unknown>;
      const detail = responseData?.detail || responseData?.message || 'Permission denied. You don\'t have access to this resource.';
      toast.error(String(detail))
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
