import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

export const refreshAccessToken = async (refreshToken: string) => {
  const response = await axios.post(`${API_BASE_URL}/token/refresh/`, {
    refresh: refreshToken,
  })
  return response.data as { access: string }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isRetryableError = (error: any) => {
  if (error?.code === 'ECONNABORTED') return true
  if (!error?.response) return true
  const status = error.response.status
  return status >= 500 && status < 600
}

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (!originalRequest) {
      return Promise.reject(error)
    }

    const isRefreshRequest = originalRequest.url?.includes('/token/refresh/')
    const maxRetries = 3
    const retryCount = originalRequest._retryCount || 0

    if (!isRefreshRequest && isRetryableError(error) && retryCount < maxRetries) {
      originalRequest._retryCount = retryCount + 1
      const delay = Math.min(1000 * 2 ** retryCount, 8000)
      await sleep(delay)
      return api(originalRequest)
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refresh_token')
        const response = await axios.post(`${API_BASE_URL}/token/refresh/`, {
          refresh: refreshToken,
        })

        const { access } = response.data
        localStorage.setItem('access_token', access)

        originalRequest.headers.Authorization = `Bearer ${access}`
        return api(originalRequest)
      } catch (refreshError) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api
