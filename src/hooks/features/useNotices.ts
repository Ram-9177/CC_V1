/**
 * Notices Feature Hooks
 */

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Notice } from '@/types'

export const useNoticesList = (limit = 50) => {
  return useQuery({
    queryKey: ['notices', 'list'],
    queryFn: async () => {
      const { data } = await api.get(`/notices/?limit=${limit}`)
      return data as Notice[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export const useUrgentNotices = () => {
  return useQuery({
    queryKey: ['notices', 'urgent'],
    queryFn: async () => {
      const { data } = await api.get('/notices/urgent/')
      return data as Notice[]
    },
    staleTime: 2 * 60 * 1000,
  })
}

export const usePinnedNotices = () => {
  return useQuery({
    queryKey: ['notices', 'pinned'],
    queryFn: async () => {
      const { data } = await api.get('/notices/?is_pinned=true')
      return data as Notice[]
    },
    staleTime: 30 * 60 * 1000,
  })
}
