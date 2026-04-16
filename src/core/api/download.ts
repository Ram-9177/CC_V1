import type { AxiosInstance } from 'axios'

export const createDownloadFile = (api: AxiosInstance) => {
  return async (url: string, filename: string) => {
    try {
      const response = await api.get(url, { responseType: 'blob' })
      const href = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = href
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(href)
    } catch (error) {
      console.error('Download failed:', error)
      throw error
    }
  }
}
