import axios, { AxiosError, AxiosRequestConfig } from 'axios'
import { useAuthStore } from './store'

// Use VITE_API_URL or default to /api. Relative path is preferred for production to avoid CORS.
const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

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
    // Use the absolute base URL to handle refresh safely
    await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {}, { 
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

// Simplified Request Interceptor
api.interceptors.request.use(
  (config) => {
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

    config.url = url.replace(/\/+/g, '/'); // Clean up slashes
    
    if (import.meta.env.PROD) {
       console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}/${config.url}`);
    }

    return config
  },
  (error) => {
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
    // Suppress toast for /profile/ (bootstrap auth check) to avoid false "Permission denied" on refresh
    if (error.response?.status === 403) {
      const isBootstrap = originalRequest.url?.includes('/profile/')
      if (!isBootstrap) {
        const { toast } = await import('sonner')
        const responseData = error.response.data as Record<string, unknown>;
        const detail = responseData?.detail || responseData?.message || 'Permission denied. You don\'t have access to this resource.';
        toast.error(String(detail))
      }
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
