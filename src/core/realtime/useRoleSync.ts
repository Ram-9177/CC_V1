import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/core/query/keys'
import { updatesWS } from '@/lib/websocket'
import { useAuthStore } from '@/lib/store'
import type { Role } from '@/types'

export function useRealtimeRoleSync() {
  const { user, setUser } = useAuthStore()
  const queryClient = useQueryClient()
  const userRef = useRef(user)
  const setUserRef = useRef(setUser)

  useEffect(() => {
    userRef.current = user
    setUserRef.current = setUser
  })

  useEffect(() => {
    if (!user?.id) return

    const handler = (data: { new_role?: Role; is_active?: boolean }) => {
      const { new_role, is_active } = data
      const currentUser = userRef.current
      if (!currentUser) return

      if (new_role !== undefined || is_active !== undefined) {
        setUserRef.current({
          ...currentUser,
          role: new_role ?? currentUser.role,
          is_active: is_active ?? currentUser.is_active,
        })

        if (new_role && new_role !== currentUser.role) {
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() })
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.statsRoot() })
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.recentActivitiesRoot() })
          queryClient.invalidateQueries({ queryKey: queryKeys.profile.all() })
          queryClient.invalidateQueries({ queryKey: queryKeys.gatePasses.all() })
        }
      }
    }

    updatesWS.on('self_role_changed', handler)

    const typeChangeHandler = (data: { new_type?: string }) => {
      const { new_type } = data
      const currentUser = userRef.current
      if (!currentUser || !new_type) return

      setUserRef.current({
        ...currentUser,
        student_type: new_type as 'hosteller' | 'day_scholar',
      })

      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all() })
      queryClient.invalidateQueries({ queryKey: ['meals'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.gatePasses.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.all() })
    }

    updatesWS.on('student_type_changed', typeChangeHandler)
    updatesWS.on('student.type_changed', typeChangeHandler)

    return () => {
      updatesWS.off('self_role_changed', handler)
      updatesWS.off('student_type_changed', typeChangeHandler)
      updatesWS.off('student.type_changed', typeChangeHandler)
    }
  }, [user?.id, queryClient])
}
