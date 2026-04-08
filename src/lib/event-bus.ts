/**
 * CampusCore Typed Event Bus
 * ===========================
 * A centralized, strongly-typed event emitter that sits between the WebSocket
 * layer and UI components. Every real-time event flows through this bus exactly once.
 *
 * Why this instead of calling updatesWS.on() directly in components?
 *   1. Type safety — TypeScript enforces the correct payload shape per event
 *   2. Zero memory leaks — handlers are removed via a returned cleanup fn
 *   3. Decoupling — components don't depend on the WebSocket implementation
 *   4. Testability — mock the bus in tests, not the WS socket
 *   5. Budget server — one fewer WS listener per component mount = less overhead
 *
 * Usage:
 *   import { eventBus } from '@/lib/event-bus'
 *   import { useEventBus } from '@/lib/event-bus'
 *
 *   // Outside React:
 *   const unsub = eventBus.on('gatepass.approved', (e) => console.log(e.gatepass_id))
 *   eventBus.emit('gatepass.approved', { gatepass_id: '...', student_id: '...' })
 *   unsub() // cleanup
 *
 *   // Inside React:
 *   useEventBus('complaint.escalated', (e) => toast.warning(`Complaint ${e.id} escalated`))
 */

import { useEffect, useRef } from 'react'

// ─── Event Payload Registry ────────────────────────────────────────────────────
// Add every WS event type and its expected payload shape here.
// This is the single source of truth for real-time event contracts.

export interface EventMap {
  // Gate Pass lifecycle
  'gatepass.created':    { gatepass_id: string; student_id: string; college_id: string }
  'gatepass.approved':   { gatepass_id: string; student_id: string; approved_by: string }
  'gatepass.rejected':   { gatepass_id: string; student_id: string; reason?: string }
  'gatepass.out':        { gatepass_id: string; student_id: string; scan_time: string }
  'gatepass.in':         { gatepass_id: string; student_id: string; scan_time: string }
  'gatepass.expired':    { gatepass_id: string; student_id: string }
  'gatepass.cancelled':  { gatepass_id: string; cancelled_by: string }

  // Complaint lifecycle
  'complaint.created':    { complaint_id: string; student_id: string; category: string }
  'complaint.assigned':   { complaint_id: string; assigned_to: string }
  'complaint.resolved':   { complaint_id: string; resolved_by: string; resolution: string }
  'complaint.escalated':  { complaint_id: string; escalation_level: number; reason: string }
  'complaint.sla_breach': { complaint_id: string; hours_overdue: number }

  // Notifications
  'notification.new':          { id: string; title: string; body: string; type: string }
  'notification_unread_increment': { delta: number }

  // User management
  'self_role_changed':   { new_role: string; is_active?: boolean }
  'student_type_changed': { new_type: string }
  'user.activated':      { user_id: string }
  'user.deactivated':    { user_id: string }

  // Attendance
  'attendance.marked':   { user_id: string; date: string; status: string }

  // Meals
  'meal.feedback':       { meal_id: string; rating: number }
  'meal.menu_updated':   { date: string; meal_type: string }

  // Visitors
  'visitor.checked_in':  { visitor_id: string; host_id: string }
  'visitor.checked_out': { visitor_id: string }

  // Leave requests
  'leave.created':       { leave_id: string; student_id: string }
  'leave.approved':      { leave_id: string; approved_by: string }
  'leave.rejected':      { leave_id: string; reason?: string }

  // System
  'system.data_updated': { resource: string; id: string; action: string }
  'system.rule_executed': { rule_id: string; action: string }
}

export type EventName = keyof EventMap
export type EventPayload<T extends EventName> = EventMap[T]
type Handler<T extends EventName> = (payload: EventPayload<T>) => void

// ─── EventBus Class ────────────────────────────────────────────────────────────

class EventBus {
  private handlers: Map<string, Set<(payload: unknown) => void>> = new Map()

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on<T extends EventName>(event: T, handler: Handler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    const h = handler as (payload: unknown) => void
    this.handlers.get(event)!.add(h)
    return () => this.off(event, handler)
  }

  /**
   * Unsubscribe a specific handler.
   */
  off<T extends EventName>(event: T, handler: Handler<T>): void {
    const h = handler as (payload: unknown) => void
    this.handlers.get(event)?.delete(h)
  }

  /**
   * Emit an event to all subscribers.
   * Uses queueMicrotask so emitting inside a React render cycle doesn't
   * cause synchronous re-entrancy.
   */
  emit<T extends EventName>(event: T, payload: EventPayload<T>): void {
    queueMicrotask(() => {
      this.handlers.get(event)?.forEach(h => {
        try { h(payload) } catch (err) { console.error(`[EventBus] handler error for "${event}":`, err) }
      })
    })
  }

  /**
   * Returns the number of registered handlers for a given event.
   * Useful for diagnostics.
   */
  listenerCount(event: EventName): number {
    return this.handlers.get(event)?.size ?? 0
  }
}

/** Singleton event bus — import this everywhere */
export const eventBus = new EventBus()

// ─── React Hook ────────────────────────────────────────────────────────────────

/**
 * Subscribe to a typed event bus event inside a React component.
 * Automatically cleans up on unmount. The handler is captured in a ref
 * so callers don't need to memoize it.
 *
 * @example
 * useEventBus('gatepass.approved', (e) => {
 *   toast.success(`Gate pass approved by ${e.approved_by}`)
 *   queryClient.invalidateQueries({ queryKey: ['gate-passes'] })
 * })
 */
export function useEventBus<T extends EventName>(
  event: T,
  handler: Handler<T>,
  deps: unknown[] = []
): void {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const wrapped: Handler<T> = (payload) => handlerRef.current(payload)
    return eventBus.on(event, wrapped)
  }, [event, ...deps])
}

// ─── WebSocket Bridge ──────────────────────────────────────────────────────────
// Maps incoming WS message types to typed EventBus emissions.
// Call this once in app bootstrap (DashboardLayout or App.tsx).

const WS_TO_BUS_MAP: Partial<Record<string, EventName>> = {
  'gatepass_created':              'gatepass.created',
  'gatepass_approved':             'gatepass.approved',
  'gatepass_rejected':             'gatepass.rejected',
  'gatepass_out':                  'gatepass.out',
  'gatepass_in':                   'gatepass.in',
  'gatepass_expired':              'gatepass.expired',
  'gatepass_cancelled':            'gatepass.cancelled',
  'complaint_created':             'complaint.created',
  'complaint_assigned':            'complaint.assigned',
  'complaint_resolved':            'complaint.resolved',
  'complaint_escalated':           'complaint.escalated',
  'complaint_sla_breach':          'complaint.sla_breach',
  'notification_new':              'notification.new',
  'notification_unread_increment': 'notification_unread_increment',
  'self_role_changed':             'self_role_changed',
  'student_type_changed':          'student_type_changed',
  'user_activated':                'user.activated',
  'user_deactivated':              'user.deactivated',
  'attendance_marked':             'attendance.marked',
  'meal_feedback':                 'meal.feedback',
  'meal_menu_updated':             'meal.menu_updated',
  'visitor_checked_in':            'visitor.checked_in',
  'visitor_checked_out':           'visitor.checked_out',
  'leave_created':                 'leave.created',
  'leave_approved':                'leave.approved',
  'leave_rejected':                'leave.rejected',
  'data_updated':                  'system.data_updated',
  'rule_executed':                 'system.rule_executed',
}

/**
 * Bridge all WebSocket messages to the typed EventBus.
 * Call once during app startup — it registers a single WS wildcard handler
 * and fans out to the individual typed events.
 */
export function bridgeWebSocketToEventBus(ws: { on: (event: string, handler: (data: unknown) => void) => void }) {
  Object.keys(WS_TO_BUS_MAP).forEach(wsEvent => {
    ws.on(wsEvent, (data: unknown) => {
      const busEvent = WS_TO_BUS_MAP[wsEvent]
      if (busEvent) {
        // Safe cast — the WS payload shapes are validated server-side
        eventBus.emit(busEvent, data as EventPayload<typeof busEvent>)
      }
    })
  })
}
