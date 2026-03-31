/**
 * Meals Feature Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Meal, MealAttendance, MealPreferences } from '@/types'

export const useMealsList = (date?: string) => {
  return useQuery({
    queryKey: ['meals', 'list', date],
    queryFn: async () => {
      const params = date ? `?date=${date}` : ''
      const { data } = await api.get(`/meals/${params}`)
      return (data.results || data) as Meal[]
    },
    staleTime: 10 * 60 * 1000,
  })
}

export const useMealsByDate = (date: string) => {
  return useQuery({
    queryKey: ['meals', 'by-date', date],
    queryFn: async () => {
      const { data } = await api.get(`/meals/by_date/?date=${date}`)
      return (data.results || data) as Meal[]
    },
    enabled: !!date,
    staleTime: 10 * 60 * 1000,
  })
}

export const useMealAttendance = (mealId?: number) => {
  return useQuery({
    queryKey: ['meals', 'attendance', mealId],
    queryFn: async () => {
      const { data } = await api.get(`/meals/${mealId}/attendance/`)
      return (data.results || data) as MealAttendance[]
    },
    enabled: !!mealId,
    staleTime: 5 * 60 * 1000,
  })
}

export const useMarkMealAttendance = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: { meal_id: number; attended: boolean }) => {
      const { data } = await api.post('/meals/mark/', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] })
      queryClient.invalidateQueries({ queryKey: ['meals', 'attendance'] })
    },
  })
}

export const useMealPreferences = (studentId?: number) => {
  return useQuery({
    queryKey: ['meals', 'preferences', studentId],
    queryFn: async () => {
      const { data } = await api.get(`/meals/preferences/?student_id=${studentId}`)
      return (data.results || data) as MealPreferences[]
    },
    enabled: !!studentId,
    staleTime: 30 * 60 * 1000,
  })
}

export const useUpdateMealPreferences = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: Partial<MealPreferences>) => {
      const { data } = await api.post('/meals/preferences/', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] })
      queryClient.invalidateQueries({ queryKey: ['meals', 'preferences'] })
    },
  })
}

export const useAddMealFeedback = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: { meal_id: number; rating: number; comment?: string }) => {
      const { data } = await api.post('/meals/add_feedback/', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] })
    },
  })
}

export const useMealForecast = () => {
  return useQuery({
    queryKey: ['meals', 'forecast'],
    queryFn: async () => {
      const { data } = await api.get('/meals/forecast/')
      return data
    },
    staleTime: 60 * 60 * 1000,
  })
}
