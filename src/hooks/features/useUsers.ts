/**
 * User Management Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { User } from '@/types'

export const useUsersList = (role?: string) => {
  return useQuery({
    queryKey: ['users', 'list', role],
    queryFn: async () => {
      const params = role ? `?role=${role}` : ''
      const { data } = await api.get(`/auth/users/${params}`)
      return (data.results || data) as User[]
    },
    staleTime: 30 * 60 * 1000,
  })
}

export const useStudentsList = () => {
  return useUsersList('student')
}

export const useStaffList = () => {
  return useQuery({
    queryKey: ['users', 'staff'],
    queryFn: async () => {
      const { data } = await api.get('/auth/users/?role=staff')
      return (data.results || data) as User[]
    },
    staleTime: 30 * 60 * 1000,
  })
}

export const useCreateUser = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: Partial<User>) => {
      const { data } = await api.post('/auth/users/', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export const useUpdateUser = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<User> & { id: number }) => {
      const { data } = await api.patch(`/auth/users/${id}/`, payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export const useDeleteUser = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (userId: number) => {
      await api.delete(`/auth/users/${userId}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
