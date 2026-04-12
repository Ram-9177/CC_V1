/**
 * Attendance Feature Hooks
 * Consolidated API and data management for attendance feature
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getApiErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'
import type { 
  AttendanceRecord, 
  AttendanceStats, 
  AttendanceMonthly, 
  Defaulter 
} from '@/types'

type AttendanceApiEnvelope = {
  code?: unknown
  detail?: unknown
}

export const getAttendancePolicyMessage = (error: unknown): string | null => {
  const payload = (error as { response?: { data?: AttendanceApiEnvelope } })?.response?.data
  const code = typeof payload?.code === 'string' ? payload.code : null

  if (code === 'STUDENT_DEALLOCATED') {
    return 'Student is deallocated. Attendance is controlled by gate-pass outside status.'
  }
  if (code === 'STUDENT_OUT') {
    return 'Student is currently outside on gate pass and cannot be marked present.'
  }
  if (code === 'HOLIDAY_ATTENDANCE_BLOCKED') {
    return 'Attendance marking is blocked on this configured holiday.'
  }
  return null
}

export const getAttendanceInfoMessage = (payload: unknown): string | null => {
  const envelope = payload as AttendanceApiEnvelope | undefined
  const code = typeof envelope?.code === 'string' ? envelope.code : null

  if (code === 'STUDENT_OUT_DEALLOCATED') {
    const detail = envelope?.detail
    if (typeof detail === 'string' && detail.trim()) {
      return detail
    }
    return 'Student is deallocated and outside on gate pass. Marked as out_gatepass.'
  }
  return null
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch attendance records for a specific date
 */
export const useAttendanceRecords = (date?: string, limit = 50) => {
  return useQuery({
    queryKey: ['attendance', 'records', date],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (date) params.append('date', date)
      params.append('limit', limit.toString())
      
      const { data } = await api.get(`/attendance/?${params.toString()}`)
      return (data.results || data) as AttendanceRecord[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Fetch today's attendance statistics
 */
export const useAttendanceStats = () => {
  return useQuery({
    queryKey: ['attendance', 'stats'],
    queryFn: async () => {
      const { data } = await api.get('/attendance/stats/')
      return data as AttendanceStats
    },
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    staleTime: 10 * 1000,
  })
}

/**
 * Fetch monthly attendance summary
 */
export const useAttendanceMonthlySummary = (year?: number, month?: number) => {
  return useQuery({
    queryKey: ['attendance', 'monthly', year, month],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (year) params.append('year', year.toString())
      if (month) params.append('month', month.toString())
      
      const { data } = await api.get(`/attendance/monthly_summary/?${params.toString()}`)
      return data as AttendanceMonthly[]
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  })
}

/**
 * Fetch students with poor attendance
 */
export const useDefaulters = (daysAbsent = 5) => {
  return useQuery({
    queryKey: ['attendance', 'defaulters', daysAbsent],
    queryFn: async () => {
      const { data } = await api.get(`/attendance/defaulters/?min_absent_days=${daysAbsent}`)
      return data as Defaulter[]
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}

/**
 * Fetch today's attendance summary
 */
export const useTodayAttendance = () => {
  return useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: async () => {
      const { data } = await api.get('/attendance/today/')
      return (data.results || data) as AttendanceRecord[]
    },
    refetchInterval: 1 * 60 * 1000, // Refetch every minute
    staleTime: 5 * 1000,
  })
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Mark attendance for a single student
 */
export const useMarkAttendance = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: { student_id: number; status: 'present' | 'absent'; date?: string }) => {
      const { data } = await api.post('/attendance/mark/', payload)
      return data
    },
    onSuccess: (data) => {
      const infoMessage = getAttendanceInfoMessage(data)
      if (infoMessage) {
        toast.info(infoMessage)
      }

      // Invalidate relevant caches
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      queryClient.invalidateQueries({ queryKey: ['attendance', 'stats'] })
      queryClient.invalidateQueries({ queryKey: ['attendance', 'today'] })
      queryClient.invalidateQueries({ queryKey: ['attendance', 'defaulters'] })
      queryClient.invalidateQueries({ queryKey: ['warden-advanced-stats'] })
    },
    onError: (error, variables) => {
      const policyMessage = getAttendancePolicyMessage(error)
      if (policyMessage) {
        toast.warning(policyMessage)
        return
      }
      toast.error(getApiErrorMessage(error, `Failed to mark attendance for student ${variables.student_id}`))
    },
  })
}

/**
 * Mark attendance for students in a scope (building/floor/room)
 */
export const useMarkAttendanceBulk = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: { status?: string; date?: string; building_id?: number; floor?: number; room_id?: number }) => {
      const { data } = await api.post('/attendance/mark-all/', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      queryClient.invalidateQueries({ queryKey: ['attendance', 'stats'] })
      queryClient.invalidateQueries({ queryKey: ['attendance', 'today'] })
      queryClient.invalidateQueries({ queryKey: ['warden-advanced-stats'] })
    },
    onError: (error) => {
      const policyMessage = getAttendancePolicyMessage(error)
      if (policyMessage) {
        toast.warning(policyMessage)
        return
      }
      toast.error(getApiErrorMessage(error, 'Failed to update group attendance'))
    },
  })
}

/**
 * Generate attendance report
 */
export const useGenerateAttendanceReport = () => {
  return useMutation({
    mutationFn: async (payload: { start_date: string; end_date: string; format?: 'pdf' | 'excel' }) => {
      const { data } = await api.post('/attendance/reports/generate_report/', payload, {
        responseType: 'blob',
      })
      return data
    },
  })
}

/**
 * Export attendance data as CSV
 */
export const useExportAttendanceCSV = () => {
  return useMutation({
    mutationFn: async (filters?: Record<string, unknown>) => {
      const params = new URLSearchParams()
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, String(value))
        })
      }
      
      const { data } = await api.get(`/attendance/export_csv/?${params.toString()}`, {
        responseType: 'blob',
      })
      return data
    },
  })
}

// ============================================================================
// Combined Hooks (for complex operations)
// ============================================================================

/**
 * Fetch all attendance data for a student
 */
export const useStudentAttendanceHistory = (studentId: number) => {
  return useQuery({
    queryKey: ['attendance', 'student', studentId],
    queryFn: async () => {
      const { data } = await api.get(`/attendance/?student_id=${studentId}`)
      return (data.results || data) as AttendanceRecord[]
    },
    enabled: !!studentId,
    staleTime: 60 * 1000, // 1 minute
  })
}

/**
 * Fetch attendance with pagination
 */
export const useAttendancePaginated = (page = 1, pageSize = 20) => {
  return useQuery({
    queryKey: ['attendance', 'paginated', page, pageSize],
    queryFn: async () => {
      const { data } = await api.get(`/attendance/?page=${page}&page_size=${pageSize}`)
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}
