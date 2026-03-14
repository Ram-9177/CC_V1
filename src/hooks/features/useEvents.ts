/**
 * Events Feature Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Event } from '@/types'

export const useEventsList = (limit = 50) => {
  return useQuery({
    queryKey: ['events', 'list'],
    queryFn: async () => {
      const { data } = await api.get(`/events/events/?limit=${limit}`)
      return data as Event[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export const useUpcomingEvents = () => {
  return useQuery({
    queryKey: ['events', 'upcoming'],
    queryFn: async () => {
      const { data } = await api.get('/events/events/upcoming/')
      return data as Event[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export const usePastEvents = () => {
  return useQuery({
    queryKey: ['events', 'past'],
    queryFn: async () => {
      const { data } = await api.get('/events/events/past/')
      return data as Event[]
    },
    staleTime: 30 * 60 * 1000,
  })
}

export const useRegisterEvent = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (eventId: number) => {
      const { data } = await api.post('/events/registrations/register/', { event_id: eventId })
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
