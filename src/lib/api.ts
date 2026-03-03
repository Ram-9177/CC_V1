import axios, { AxiosError, AxiosRequestConfig } from 'axios'
import { useAuthStore } from './store'

// Force using the local proxy /api in production to eliminate CORS issues
const API_BASE_URL = (import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL || '/api')).replace(/\/+$/, '');

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

// Request interceptor to handle endpoint prefixing and URL sanitation
api.interceptors.request.use(
  (config) => {
    let url = config.url || '';
    
    // 1. Force absolute URLs to stay absolute
    if (url.startsWith('http')) return config;

    // 2. Add /api if missing (only if not already in URL or Base)
    const hasApiInBase = config.baseURL?.includes('/api');
    const hasApiInUrl = url.startsWith('/api') || url.startsWith('api/');
    
    if (!hasApiInBase && !hasApiInUrl) {
      const separator = url.startsWith('/') ? '' : '/';
      url = `/api${separator}${url}`;
    }

    // 3. Final sanitation: Remove double slashes and double /api/api
    url = url.replace(/\/+/g, '/'); // Fix double slashes
    url = url.replace(/\/api\/api\//g, '/api/'); // Fix double /api/api
    
    config.url = url;
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
