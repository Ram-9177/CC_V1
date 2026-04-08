/**
 * CampusCore Frontend State Machines
 * ====================================
 * Pure TypeScript state machines that MIRROR the Django backend's
 * core/state_machine.py exactly. Zero runtime dependencies — no XState install
 * needed, saving ~40KB from the bundle.
 *
 * Philosophy:
 *   - Backend is the authority on WHAT transitions are valid
 *   - Frontend machines prevent illegal API calls BEFORE they happen
 *   - The UI derives what actions to show from allowedActions()
 *   - If backend adds a new state, update BOTH files (keep in sync)
 *
 * Usage:
 *   import { GatePassMachine, ComplaintMachine } from '@/lib/machines'
 *
 *   // Check if a button should be shown:
 *   const actions = GatePassMachine.allowedActions('pending', userRole)
 *   // => ['approve', 'reject', 'cancel']
 *
 *   // Check before calling API:
 *   if (!GatePassMachine.canTransition('expired', 'approved')) {
 *     toast.error('Cannot approve an expired gate pass')
 *     return
 *   }
 */

// ─── Gate Pass State Machine ───────────────────────────────────────────────────
// Mirror of: backend_django/core/state_machine.py → GatePassMachine

export type GatePassStatus =
  | 'draft' | 'pending' | 'approved' | 'rejected'
  | 'out' | 'in' | 'completed' | 'expired' | 'cancelled'

export type GatePassAction = 'submit' | 'approve' | 'reject' | 'cancel' | 'mark_out' | 'mark_in' | 'complete' | 'expire'

interface ActionDef {
  action: GatePassAction
  label: string
  targetState: GatePassStatus
  /** Role groups that can perform this action */
  roles: string[]
  variant: 'default' | 'destructive' | 'outline' | 'ghost'
}

const GP_TRANSITIONS: Record<GatePassStatus, GatePassStatus[]> = {
  draft:     ['pending', 'cancelled'],
  pending:   ['approved', 'rejected', 'cancelled'],
  approved:  ['out', 'expired', 'cancelled'],
  out:       ['in'],
  in:        ['completed'],
  // Terminal states
  completed: [],
  rejected:  [],
  expired:   [],
  cancelled: [],
}

const GP_ACTIONS: ActionDef[] = [
  { action: 'submit',   label: 'Submit for Approval', targetState: 'pending',   roles: ['student'],                               variant: 'default'     },
  { action: 'approve',  label: 'Approve',             targetState: 'approved',  roles: ['warden', 'head_warden', 'admin', 'super_admin'], variant: 'default' },
  { action: 'reject',   label: 'Reject',              targetState: 'rejected',  roles: ['warden', 'head_warden', 'admin', 'super_admin'], variant: 'destructive' },
  { action: 'cancel',   label: 'Cancel',              targetState: 'cancelled', roles: ['student', 'warden', 'head_warden', 'admin'],     variant: 'outline' },
  { action: 'mark_out', label: 'Mark Exit',           targetState: 'out',       roles: ['gate_security', 'security_head', 'admin'],       variant: 'default' },
  { action: 'mark_in',  label: 'Mark Return',         targetState: 'in',        roles: ['gate_security', 'security_head', 'admin'],       variant: 'default' },
  { action: 'complete', label: 'Complete',            targetState: 'completed', roles: ['gate_security', 'security_head', 'admin'],       variant: 'outline' },
  { action: 'expire',   label: 'Mark Expired',        targetState: 'expired',   roles: ['admin', 'super_admin'],                          variant: 'ghost'   },
]

const GP_STATUS_META: Record<GatePassStatus, { label: string; color: string; description: string }> = {
  draft:     { label: 'Draft',     color: 'text-slate-500 bg-slate-50 border-slate-200',     description: 'Saved but not submitted' },
  pending:   { label: 'Pending',   color: 'text-amber-600 bg-amber-50 border-amber-200',     description: 'Awaiting warden approval' },
  approved:  { label: 'Approved',  color: 'text-emerald-600 bg-emerald-50 border-emerald-200', description: 'Ready to exit campus' },
  rejected:  { label: 'Rejected',  color: 'text-rose-600 bg-rose-50 border-rose-200',        description: 'Warden declined this pass' },
  out:       { label: 'Outside',   color: 'text-blue-600 bg-blue-50 border-blue-200',         description: 'Student is outside campus' },
  in:        { label: 'Returned',  color: 'text-purple-600 bg-purple-50 border-purple-200',  description: 'Student has returned' },
  completed: { label: 'Completed', color: 'text-slate-600 bg-slate-50 border-slate-200',     description: 'Pass lifecycle complete' },
  expired:   { label: 'Expired',   color: 'text-orange-600 bg-orange-50 border-orange-200',  description: 'Pass was never used' },
  cancelled: { label: 'Cancelled', color: 'text-slate-400 bg-slate-50 border-slate-100',     description: 'Cancelled before use' },
}

export const GatePassMachine = {
  /** Check if a status transition is legal */
  canTransition(from: GatePassStatus, to: GatePassStatus): boolean {
    return GP_TRANSITIONS[from]?.includes(to) ?? false
  },

  /** Get all valid next states from the current state */
  nextStates(current: GatePassStatus): GatePassStatus[] {
    return GP_TRANSITIONS[current] ?? []
  },

  /** Is the status terminal (no further transitions possible)? */
  isTerminal(status: GatePassStatus): boolean {
    return (GP_TRANSITIONS[status] ?? []).length === 0
  },

  /** Get all actions this role can perform on a gate pass in the given state */
  allowedActions(status: GatePassStatus, role: string): ActionDef[] {
    return GP_ACTIONS.filter(a =>
      a.roles.includes(role) &&
      this.canTransition(status, a.targetState)
    )
  },

  /** Get display metadata for a status */
  meta(status: GatePassStatus) {
    return GP_STATUS_META[status] ?? { label: status, color: '', description: '' }
  },

  TRANSITIONS: GP_TRANSITIONS,
}

// ─── Complaint State Machine ───────────────────────────────────────────────────
// Mirror of: backend_django/core/state_machine.py → ComplaintMachine

export type ComplaintStatus =
  | 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'escalated' | 'rejected'

export type ComplaintAction = 'assign' | 'start' | 'resolve' | 'close' | 'escalate' | 'reject' | 'reopen'

interface ComplaintActionDef {
  action: ComplaintAction
  label: string
  targetState: ComplaintStatus
  roles: string[]
  variant: 'default' | 'destructive' | 'outline' | 'ghost'
}

const COMPLAINT_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  open:        ['assigned', 'escalated', 'rejected'],
  assigned:    ['in_progress', 'escalated', 'rejected'],
  in_progress: ['resolved', 'escalated'],
  resolved:    ['closed'],
  escalated:   ['assigned', 'rejected'],
  // Terminal states
  closed:      [],
  rejected:    [],
}

const COMPLAINT_ACTIONS: ComplaintActionDef[] = [
  { action: 'assign',   label: 'Assign',    targetState: 'assigned',    roles: ['warden', 'head_warden', 'admin', 'super_admin'], variant: 'default'     },
  { action: 'start',    label: 'Start Work', targetState: 'in_progress', roles: ['warden', 'incharge', 'admin'],                  variant: 'default'     },
  { action: 'resolve',  label: 'Resolve',   targetState: 'resolved',    roles: ['warden', 'incharge', 'admin', 'super_admin'],   variant: 'default'     },
  { action: 'close',    label: 'Close',     targetState: 'closed',      roles: ['head_warden', 'admin', 'super_admin'],           variant: 'outline'     },
  { action: 'escalate', label: 'Escalate',  targetState: 'escalated',   roles: ['warden', 'head_warden', 'admin', 'super_admin'], variant: 'destructive' },
  { action: 'reject',   label: 'Reject',    targetState: 'rejected',    roles: ['warden', 'head_warden', 'admin', 'super_admin'], variant: 'destructive' },
]

const COMPLAINT_STATUS_META: Record<ComplaintStatus, { label: string; color: string; description: string }> = {
  open:        { label: 'Open',        color: 'text-blue-600 bg-blue-50 border-blue-200',         description: 'Newly raised, awaiting assignment' },
  assigned:    { label: 'Assigned',    color: 'text-amber-600 bg-amber-50 border-amber-200',       description: 'Assigned to staff member' },
  in_progress: { label: 'In Progress', color: 'text-purple-600 bg-purple-50 border-purple-200',   description: 'Staff is actively working on it' },
  resolved:    { label: 'Resolved',    color: 'text-emerald-600 bg-emerald-50 border-emerald-200', description: 'Issue fixed, pending closure' },
  closed:      { label: 'Closed',      color: 'text-slate-500 bg-slate-50 border-slate-200',       description: 'Resolution confirmed and closed' },
  escalated:   { label: 'Escalated',   color: 'text-rose-600 bg-rose-50 border-rose-200',          description: 'Raised to higher authority' },
  rejected:    { label: 'Rejected',    color: 'text-slate-400 bg-slate-50 border-slate-100',       description: 'Complaint deemed invalid' },
}

export const ComplaintMachine = {
  canTransition(from: ComplaintStatus, to: ComplaintStatus): boolean {
    return COMPLAINT_TRANSITIONS[from]?.includes(to) ?? false
  },

  nextStates(current: ComplaintStatus): ComplaintStatus[] {
    return COMPLAINT_TRANSITIONS[current] ?? []
  },

  isTerminal(status: ComplaintStatus): boolean {
    return (COMPLAINT_TRANSITIONS[status] ?? []).length === 0
  },

  allowedActions(status: ComplaintStatus, role: string): ComplaintActionDef[] {
    return COMPLAINT_ACTIONS.filter(a =>
      a.roles.includes(role) &&
      this.canTransition(status, a.targetState)
    )
  },

  meta(status: ComplaintStatus) {
    return COMPLAINT_STATUS_META[status] ?? { label: status, color: '', description: '' }
  },

  TRANSITIONS: COMPLAINT_TRANSITIONS,
}

// ─── Leave State Machine ───────────────────────────────────────────────────────

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

const LEAVE_TRANSITIONS: Record<LeaveStatus, LeaveStatus[]> = {
  pending:   ['approved', 'rejected', 'cancelled'],
  approved:  ['cancelled'],
  rejected:  [],
  cancelled: [],
}

const LEAVE_STATUS_META: Record<LeaveStatus, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: 'text-amber-600 bg-amber-50 border-amber-200'   },
  approved:  { label: 'Approved',  color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  rejected:  { label: 'Rejected',  color: 'text-rose-600 bg-rose-50 border-rose-200'     },
  cancelled: { label: 'Cancelled', color: 'text-slate-400 bg-slate-50 border-slate-100'  },
}

export const LeaveMachine = {
  canTransition: (from: LeaveStatus, to: LeaveStatus) => LEAVE_TRANSITIONS[from]?.includes(to) ?? false,
  isTerminal: (s: LeaveStatus) => LEAVE_TRANSITIONS[s].length === 0,
  meta: (s: LeaveStatus) => LEAVE_STATUS_META[s] ?? { label: s, color: '' },
  TRANSITIONS: LEAVE_TRANSITIONS,
}
