import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updatesWS } from '@/lib/websocket'
import { perfMark, perfMeasure } from '@/lib/perf'
import { getNetworkProfile, getNetworkQueryBudget } from '@/lib/networkProfile'
import { expandRealtimeEventTypes } from '@/core/realtime/eventAliases'
import { queryKeys } from '@/core/query/keys'

const queryKeyRootAliases: Record<string, readonly unknown[]> = {
  profile: queryKeys.profile.all(),
  'my-permissions': queryKeys.myPermissions.all(),
  'gate-passes': queryKeys.gatePasses.all(),
  rooms: queryKeys.rooms.all(),
  attendance: queryKeys.attendance.all(),
  complaints: queryKeys.complaints.all(),
  visitors: queryKeys.visitors.all(),
  leaves: queryKeys.leaves.all(),
  notifications: queryKeys.notifications.list(),
  'notifications-unread-count': queryKeys.notifications.unreadCount(),
  dashboard: queryKeys.dashboard.all(),
  'dashboard-stats': queryKeys.dashboard.statsRoot(),
  'recent-activities': queryKeys.dashboard.recentActivitiesRoot(),
}

function normalizeRealtimeQueryKeys(raw: (string | unknown[])[] | string | unknown[]) {
  let keysToInvalidate: unknown[][]

  if (Array.isArray(raw)) {
    const looksLikeMultiRoot = raw.every((key) => typeof key === 'string')
    if (looksLikeMultiRoot) {
      keysToInvalidate = (raw as string[]).map((key) => [key])
    } else if (raw.length > 0 && Array.isArray(raw[0])) {
      keysToInvalidate = raw as unknown[][]
    } else {
      keysToInvalidate = [raw as unknown[]]
    }
  } else {
    keysToInvalidate = [[raw]]
  }

  return keysToInvalidate.map((key) => {
    if (key.length === 1 && typeof key[0] === 'string' && queryKeyRootAliases[key[0]]) {
      return [...queryKeyRootAliases[key[0]]]
    }
    return key
  })
}

export function useRealtimeQuery(
  eventType: string | string[],
  queryKeys: (string | unknown[])[] | string | unknown[],
  callback?: (data: unknown) => void
) {
  const queryClient = useQueryClient()
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const queryKeysRef = useRef(queryKeys)
  useEffect(() => {
    queryKeysRef.current = queryKeys
  })

  useEffect(() => {
    const timeoutIds = new Set<number>()
    let isMounted = true

    const handler = (data: unknown) => {
      perfMark('ws:realtime:event', { eventType })
      const profile = getNetworkProfile()
      const budget = getNetworkQueryBudget(profile)
      const jitterDelay = Math.random() * budget.jitterMs

      const timeoutId = window.setTimeout(() => {
        if (!isMounted) return
        perfMark('ws:invalidate:start')
        const keysToInvalidate = normalizeRealtimeQueryKeys(queryKeysRef.current)
        const seen = new Set<string>()
        keysToInvalidate.forEach((key) => {
          const dedupeKey = JSON.stringify(key)
          if (seen.has(dedupeKey)) return
          seen.add(dedupeKey)
          queryClient.invalidateQueries({ queryKey: key })
        })
        perfMark('ws:invalidate:end')
        perfMeasure('ws:invalidate', 'ws:invalidate:start', 'ws:invalidate:end', {
          invalidatedKeys: seen.size,
        })
      }, jitterDelay)
      timeoutIds.add(timeoutId)

      if (callbackRef.current && isMounted) {
        callbackRef.current(data)
      }
    }

    const events = (Array.isArray(eventType) ? eventType : [eventType]).flatMap(expandRealtimeEventTypes)
    events.forEach((e) => updatesWS.on(e, handler))

    return () => {
      isMounted = false
      timeoutIds.forEach((id) => window.clearTimeout(id))
      timeoutIds.clear()
      events.forEach((e) => updatesWS.off(e, handler))
    }
  }, [Array.isArray(eventType) ? eventType.join(',') : eventType, queryClient])
}

export default useRealtimeQuery
