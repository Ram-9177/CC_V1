/**
 * User Management Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const useColleges = <T = unknown>() => {
  return useQuery<T[]>({
    queryKey: ['colleges'],
    queryFn: async () => {
      const { data } = await api.get('/colleges/colleges/')
      return (data.results || data) as T[]
    },
  })
}

export const useTenantsList = <T = unknown>(filters?: {
  page?: number
  search?: string
  status?: string
  college?: string
}) => {
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
      if (status === 'active') params.append('user__is_active', 'true')
      if (status === 'inactive') params.append('user__is_active', 'false')
      if (college !== 'all') params.append('user__college', college)
      const { data } = await api.get(`/users/tenants/?${params.toString()}`)
      return data as T
    },
    placeholderData: (previousData) => previousData,
  })
}

export const useStaffUsersList = <T = unknown>(filters?: {
  status?: string
  college?: string
}) => {
  const status = filters?.status || 'all'
  const college = filters?.college || 'all'
  return useQuery<T>({
    queryKey: ['users', status, college],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (status === 'active') params.append('is_active', 'true')
      if (status === 'inactive') params.append('is_active', 'false')
      if (college !== 'all') params.append('college', college)
      const { data } = await api.get(`/auth/users/?${params.toString()}`)
      return data as T
    },
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
