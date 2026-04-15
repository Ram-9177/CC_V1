/**
 * User Management Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getNetworkProfile, getNetworkQueryBudget } from '@/lib/networkProfile'

export interface GateLocationOption {
  id: number
  name: string
  code?: string
  description?: string
  is_active: boolean
  display_order?: number
  college?: number
}

export const useColleges = <T = unknown>() => {
  return useQuery<T[]>({
    queryKey: ['colleges'],
    queryFn: async () => {
      const { data } = await api.get('/colleges/colleges/')
      return (data.results || data) as T[]
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  })
}

export const useTenantsList = <T = unknown>(filters?: {
  page?: number
  search?: string
  status?: string
  college?: string
}) => {
  const budget = getNetworkQueryBudget(getNetworkProfile())
  const page = filters?.page || 1
  const search = filters?.search || ''
  const status = filters?.status || 'all'
  const college = filters?.college || 'all'
  return useQuery<T>({
    queryKey: ['tenants', page, search, status, college],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      if (search) params.append('search', search)
      // Fix: Use proper boolean values (lowercase true/false strings for DjangoFilterBackend)
      if (status === 'active') params.append('user__is_active', 'true')
      if (status === 'inactive') params.append('user__is_active', 'false')
      if (college !== 'all') params.append('user__college', college)
      const { data } = await api.get(`/users/tenants/?${params.toString()}`)
      return data as T
    },
    // Avoid rendering stale placeholder payloads during filter/page transitions.
    networkMode: 'online',
    staleTime: budget.staleTime,
    gcTime: budget.gcTime,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

export const useStaffUsersList = <T = unknown>(filters?: {
  status?: string
  college?: string
}) => {
  const budget = getNetworkQueryBudget(getNetworkProfile())
  const status = filters?.status || 'all'
  const college = filters?.college || 'all'
  return useQuery<T>({
    queryKey: ['users', status, college],
    queryFn: async () => {
      const params = new URLSearchParams()
      // Fix: Use lowercase true/false strings for DjangoFilterBackend
      if (status === 'active') params.append('is_active', 'true')
      if (status === 'inactive') params.append('is_active', 'false')
      if (college !== 'all') params.append('college', college)
      const { data } = await api.get(`/auth/users/?${params.toString()}`)
      return data as T
    },
    networkMode: 'online',
    staleTime: budget.staleTime,
    gcTime: budget.gcTime,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

export const useGateLocations = (filters?: {
  college?: string
  is_active?: boolean
}) => {
  const college = filters?.college || ''
  const is_active = filters?.is_active
  return useQuery<GateLocationOption[]>({
    queryKey: ['gate-locations', college, is_active ?? 'all'],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (college) params.append('college', college)
      if (typeof is_active === 'boolean') params.append('is_active', String(is_active))
      const query = params.toString()
      const { data } = await api.get(`/gate-passes/locations/${query ? `?${query}` : ''}`)
      return (data.results || data) as GateLocationOption[]
    },
    staleTime: 60 * 1000,
    retry: 1,
  })
}

export const useBulkUploadTenants = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/users/tenants/bulk_upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}

export const useApproveUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.patch(`/auth/users/${id}/`, { is_approved: true, is_active: true })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}

export const useDeleteUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/auth/users/${id}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}
