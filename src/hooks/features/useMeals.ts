/**
 * Meals Feature Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const useMealsList = <T = unknown>(date?: string) => {
  return useQuery<T[]>({
    queryKey: ['meals', date],
    queryFn: async () => {
      const { data } = await api.get('/meals/', { params: date ? { date } : {} })
      return (data.results || data) as T[]
    },
    staleTime: 10 * 60 * 1000,
  })
}

export const useMealsByDate = <T = unknown>(date: string) => {
  return useQuery<T[]>({
    queryKey: ['meals', 'by-date', date],
    queryFn: async () => {
      const { data } = await api.get(`/meals/by_date/?date=${date}`)
      return (data.results || data) as T[]
    },
    enabled: !!date,
    staleTime: 10 * 60 * 1000,
  })
}

export const useMealForecast = <T = unknown>(date: string, mealType?: string, enabled = true) => {
  return useQuery<T>({
    queryKey: ['meal-forecast', date, mealType || 'all'],
    enabled,
    queryFn: async () => {
      const params: Record<string, string> = { date }
      if (mealType && mealType !== 'all') params.meal_type = mealType
      const { data } = await api.get('/meals/forecast/', { params })
      return data as T
    },
  })
}

export const useMealAttendance = <T = unknown>(date: string, mealType?: string, enabled = true) => {
  return useQuery<T[]>({
    queryKey: ['meal-attendance', date, mealType || 'all'],
    enabled,
    queryFn: async () => {
      const params: Record<string, string> = { date }
      if (mealType && mealType !== 'all') params.meal_type = mealType
      const { data } = await api.get('/meals/attendance/', { params })
      return (data.results || data) as T[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export const useMealPreferences = <T = unknown>(userId?: number) => {
  return useQuery<T[]>({
    queryKey: ['meal-preferences', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await api.get('/meals/preferences/')
      return (data.results || data) as T[]
    },
    staleTime: 30 * 60 * 1000,
  })
}

export const useMealSpecialRequests = <T = unknown>() => {
  return useQuery<T[]>({
    queryKey: ['meal-special-requests'],
    queryFn: async () => {
      const { data } = await api.get('/meals/special-requests/')
      return (data.results || data || []) as T[]
    },
  })
}

export const useMealFeedback = <T = unknown>(date: string, enabled = true) => {
  return useQuery<T[]>({
    queryKey: ['meal-feedback', date],
    enabled,
    queryFn: async () => {
      const { data } = await api.get('/meals/feedback/', { params: { date } })
      return (data.results || data || []) as T[]
    },
  })
}

export const useMealFeedbackStats = <T = unknown>(date: string, mealType?: string, enabled = true) => {
  return useQuery<T>({
    queryKey: ['meal-feedback-stats', date, mealType || 'all'],
    enabled,
    queryFn: async () => {
      const params: Record<string, unknown> = { date }
      if (mealType && mealType !== 'all') params.meal_type = mealType
      const { data } = await api.get('/meals/feedback-stats/', { params })
      return data as T
    },
  })
}

export const useMarkMealAttendance = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { meal_id: number; status: string }) => {
      const { data } = await api.post('/meals/mark/', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-attendance'] })
    },
  })
}

export const useUpdateMealPreferences = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/meals/preferences/', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-preferences'] })
    },
  })
}

export const useAddMealFeedback = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { meal_id: number; rating: number; comment?: string }) => {
      const { data } = await api.post('/meals/feedback/', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-feedback'] })
    },
  })
}

export const useDeleteSpecialRequest = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: number) => {
      const { data } = await api.delete(`/meals/special-requests/${requestId}/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-special-requests'] })
    },
  })
}

export const useApproveSpecialRequest = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/meals/special-requests/${id}/approve/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-special-requests'] })
    },
  })
}

export const useRejectSpecialRequest = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/meals/special-requests/${id}/reject/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-special-requests'] })
    },
  })
}

export const useDeliverSpecialRequest = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/meals/special-requests/${id}/deliver/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-special-requests'] })
    },
  })
}

export const useResolveMealFeedback = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (feedbackId: number) => {
      const { data } = await api.patch(`/meals/feedback/${feedbackId}/`, { resolved: true })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-feedback'] })
    },
  })
}
