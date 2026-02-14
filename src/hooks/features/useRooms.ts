/**
 * Rooms & Allocation Feature Hooks
 * Consolidated API and data management for room management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Room, Bed, RoomAllocation, Building } from '@/types'

export const useBuildings = () => {
  return useQuery({
    queryKey: ['rooms', 'buildings'],
    queryFn: async () => {
      const { data } = await api.get('/rooms/buildings/')
      return data as Building[]
    },
    staleTime: 30 * 60 * 1000,
  })
}

export const useRooms = (buildingId?: number) => {
  return useQuery({
    queryKey: ['rooms', 'list', buildingId],
    queryFn: async () => {
      const params = buildingId ? `?building=${buildingId}` : ''
      const { data } = await api.get(`/rooms/${params}`)
      return data as Room[]
    },
    staleTime: 15 * 60 * 1000,
  })
}

export const useRoom = (roomId: number) => {
  return useQuery({
    queryKey: ['rooms', 'detail', roomId],
    queryFn: async () => {
      const { data } = await api.get(`/rooms/${roomId}/`)
      return data as Room
    },
    enabled: !!roomId,
    staleTime: 10 * 60 * 1000,
  })
}

export const useRoomBeds = (roomId: number) => {
  return useQuery({
    queryKey: ['rooms', 'beds', roomId],
    queryFn: async () => {
      const { data } = await api.get(`/rooms/${roomId}/beds/`)
      return data as Bed[]
    },
    enabled: !!roomId,
    staleTime: 10 * 60 * 1000,
  })
}

export const useMyActiveAllocation = () => {
  return useQuery({
    queryKey: ['rooms', 'my-allocation'],
    queryFn: async () => {
      const { data } = await api.get('/room-allocations/my_active/')
      return data as RoomAllocation
    },
    staleTime: 60 * 60 * 1000,
  })
}

export const useStudentAllocations = (studentId?: number) => {
  return useQuery({
    queryKey: ['rooms', 'allocations', studentId],
    queryFn: async () => {
      const { data } = await api.get(`/room-allocations/?student_id=${studentId}`)
      return data as RoomAllocation[]
    },
    enabled: !!studentId,
    staleTime: 30 * 60 * 1000,
  })
}

export const useAllocateRoom = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: { student_id: number; room_id: number; bed_id: number }) => {
      const { data } = await api.post('/room-allocations/', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      queryClient.invalidateQueries({ queryKey: ['room-allocations'] })
    },
  })
}

export const useDeallocateRoom = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (allocationId: number) => {
      const { data } = await api.post(`/room-allocations/${allocationId}/deallocate/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      queryClient.invalidateQueries({ queryKey: ['room-allocations'] })
    },
  })
}

export const useMoveStudent = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: { student_id: number; new_room_id: number; new_bed_id: number }) => {
      const { data } = await api.post('/room-allocations/move/', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      queryClient.invalidateQueries({ queryKey: ['room-allocations'] })
    },
  })
}

export const useBulkAssignRooms = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: Array<{ student_id: number; room_id: number; bed_id: number }>) => {
      const { data } = await api.post('/rooms/bulk_assign/', { assignments: payload })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      queryClient.invalidateQueries({ queryKey: ['room-allocations'] })
    },
  })
}
