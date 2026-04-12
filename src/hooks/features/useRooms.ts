/**
 * Rooms & Allocation Feature Hooks
 * Consolidated API and data management for room management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Building } from '@/types'
import { toast } from 'sonner'

export const useBuildings = <T = Building>(enabled = true) => {
  return useQuery<T[]>({
    queryKey: ['buildings'],
    queryFn: async () => {
      const { data } = await api.get('/rooms/buildings/')
      return (data.results || data) as T[]
    },
    enabled,
    staleTime: 30 * 60 * 1000,
  })
}

export const useRoomsList = <T = unknown>(filters?: { floor?: string; type?: string; status?: string }, enabled = true) => {
  const floor = filters?.floor || 'all'
  const type = filters?.type || 'all'
  const status = filters?.status || 'all'
  return useQuery<T[]>({
    queryKey: ['rooms', floor, type, status],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (floor !== 'all') params.append('floor', floor)
      if (type !== 'all') params.append('room_type', type)
      if (status !== 'all') params.append('status', status)
      const { data } = await api.get(`/rooms/?${params.toString()}`)
      return (data.results || data) as T[]
    },
    enabled,
    staleTime: 15 * 60 * 1000,
  })
}

export const useMyActiveAllocation = <T = unknown>(enabled = true) => {
  return useQuery<T | null>({
    queryKey: ['rooms', 'my-active-allocation'],
    queryFn: async () => {
      const { data } = await api.get('/rooms/allocations/my_active/')
      return data as T
    },
    enabled,
    staleTime: 60 * 60 * 1000,
  })
}

export const useAllocateRoom = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ roomId, userId }: { roomId: number; userId: string }) => {
      try {
        await api.post(`/rooms/${roomId}/allocate/`, { user_id: userId })
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status?: number } }
        if (axiosErr?.response?.status === 409) {
          toast.info('Room is busy, retrying…')
          await new Promise(r => setTimeout(r, 500))
          await api.post(`/rooms/${roomId}/allocate/`, { user_id: userId })
          return
        }
        throw err
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export const useDeallocateRoom = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ roomId, userId }: { roomId: number; userId: number }) => {
      await api.post(`/rooms/${roomId}/deallocate/`, { user_id: userId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export const useDeleteRoom = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (roomId: number) => {
      await api.delete(`/rooms/${roomId}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export const useUpdateRoom = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ roomId, data }: { roomId: number; data: Record<string, unknown> }) => {
      await api.patch(`/rooms/${roomId}/`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export const useAutoAllocate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/rooms/auto_allocate/')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export const useCreateRoom = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (roomData: Record<string, unknown>) => {
      const { data } = await api.post('/rooms/', roomData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export const useEditBed = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ bedId, bedNumber }: { bedId: number; bedNumber: string }) => {
      await api.patch(`/rooms/beds/${bedId}/`, { bed_number: bedNumber })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export const useSyncBeds = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (roomId: number) => {
      await api.post(`/rooms/${roomId}/generate_beds/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}
