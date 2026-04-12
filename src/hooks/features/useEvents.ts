/**
 * Events Feature Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { getNetworkProfile, getNetworkQueryBudget } from '@/lib/networkProfile'

export const useEventsByFilter = <T = unknown>(filter: 'all' | 'upcoming' | 'past') => {
  return useQuery<T[]>({
    queryKey: ['events', filter],
    queryFn: async () => {
      const url =
        filter === 'upcoming'
          ? '/events/events/upcoming/'
          : filter === 'past'
            ? '/events/events/past/'
            : '/events/events/'
      const { data } = await api.get(url)
      return (data.results || data) as T[]
    },
    staleTime: 60 * 1000,
  })
}

export const useEventsList = <T = unknown>(limit = 50) => {
  return useQuery<T[]>({
    queryKey: ['events', 'list'],
    queryFn: async () => {
      const { data } = await api.get(`/events/events/?limit=${limit}`)
      return (data.results || data) as T[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export const useUpcomingEvents = <T = unknown>() => {
  return useQuery<T[]>({
    queryKey: ['events', 'upcoming'],
    queryFn: async () => {
      const { data } = await api.get('/events/events/upcoming/')
      return (data.results || data) as T[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export const usePastEvents = <T = unknown>() => {
  return useQuery<T[]>({
    queryKey: ['events', 'past'],
    queryFn: async () => {
      const { data } = await api.get('/events/events/past/')
      return (data.results || data) as T[]
    },
    staleTime: 30 * 60 * 1000,
  })
}

export const useEventRegistrations = <T = unknown>() => {
  const budget = getNetworkQueryBudget(getNetworkProfile())
  return useQuery<T[]>({
    queryKey: ['event-registrations'],
    queryFn: async () => {
      const { data } = await api.get('/events/registrations/')
      return (data.results || data) as T[]
    },
    staleTime: Math.min(budget.staleTime, 60 * 1000),
    networkMode: 'online',
    refetchOnWindowFocus: false,
  })
}

export const useSportsCourts = () => {
  return useQuery({
    queryKey: ['sports-courts'],
    queryFn: async () => {
      const { data } = await api.get('/events/events/sports-courts/')
      return (data.results || data) as Array<{ id: number; name: string; sport_name: string }>
    },
    staleTime: 5 * 60 * 1000,
  })
}

export const useRegisterEvent = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (eventId: number) => {
      const { data } = await api.post('/events/registrations/register/', { event_id: eventId })
      return data
    },
    onMutate: async (eventId: number) => {
      // Immediate UX feedback: flip button to "Registered" before network round-trip.
      const currentUserId = useAuthStore.getState().user?.id
      if (!currentUserId) return
      queryClient.setQueryData(['event-registrations'], (old: unknown) => {
        if (!Array.isArray(old)) return old
        const already = old.some((item: unknown) => {
          const row = item as { event?: number; student?: number; student_details?: { id?: number } }
          return row.event === eventId && (row.student === currentUserId || row.student_details?.id === currentUserId)
        })
        if (already) return old
        return [
          ...old,
          {
            id: -Date.now(),
            event: eventId,
            student: currentUserId,
            status: 'registered',
            created_at: new Date().toISOString(),
          },
        ]
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-registrations'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

export const useCreateEvent = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: FormData) => {
      const { data } = await api.post('/events/events/', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

export const useMarkEventAttendance = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (registrationId: number) => {
      const { data } = await api.post(`/events/registrations/${registrationId}/mark_attended/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}
