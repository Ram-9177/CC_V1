/**
 * Event naming strategy:
 * - Canonical future-facing names should prefer dotted domain events, e.g. `gate.pass.updated`
 * - Existing snake_case and legacy aliases remain supported for backward compatibility
 * - Expansion is symmetric for `.` and `_` separators to keep current modules working
 */

export const realtimeEventAliases: Record<string, string[]> = {
  gate_pass_updated: ['gatepass_updated'],
  gatepass_updated: ['gate_pass_updated'],
  gate_pass_status_changed: ['gatepass_updated', 'gate_pass_updated'],
  // GatePassConsumer (/ws/gatepass/) emits these legacy message types.
  // Map them so existing dashboard/page subscriptions still invalidate correctly.
  gatepass_created: ['new_request'],
  new_request: ['gatepass_created', 'gatepass_updated'],
  gatepass_approved: ['approved_pass', 'status_update'],
  gatepass_rejected: ['status_update'],
  approved_pass: ['gatepass_approved', 'gatepass_updated'],
  status_update: ['gatepass_updated', 'gatepass_approved', 'gatepass_rejected'],
  gate_scan_logged: ['gate_scan'],
  gate_scan: ['gate_scan_logged'],
  disciplinary_updated: ['disciplinary'],
  disciplinary: ['disciplinary_updated'],
  student_type_changed: ['student.type_changed'],
  'student.type_changed': ['student_type_changed'],
  // Event registration aliases: backend emits "event.registered" -> "event_registered"
  event_registered: ['event_registration_created'],
  event_registration_created: ['event_registered'],
  event_registration_updated: ['event_updated'],
}

export const expandRealtimeEventTypes = (value: string): string[] => {
  const variants = new Set<string>([value])
  ;(realtimeEventAliases[value] || []).forEach((v) => variants.add(v))
  if (value.includes('.')) variants.add(value.replace(/\./g, '_'))
  if (value.includes('_')) variants.add(value.replace(/_/g, '.'))
  return Array.from(variants)
}
