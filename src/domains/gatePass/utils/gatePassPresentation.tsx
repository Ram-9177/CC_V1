import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { GatePass } from '@/types'

export const getStatusBadge = (status: string, pass?: GatePass) => {
  const commonClasses = 'uppercase text-[10px] tracking-normal px-2.5 rounded-sm h-5 flex items-center justify-center font-black'

  switch (status) {
    case 'draft': return <Badge className={cn(commonClasses, 'bg-slate-50 text-slate-400 border-slate-200')}>Draft</Badge>
    case 'pending': return <Badge className={cn(commonClasses, 'bg-orange-50 text-orange-600 border-orange-200')}>Pending</Badge>
    case 'approved': return <Badge className={cn(commonClasses, 'bg-emerald-100 text-emerald-700 border-emerald-200')}>Approved</Badge>
    case 'out': return <Badge className={cn(commonClasses, 'bg-rose-100 text-rose-700 border-rose-200')}>OUT</Badge>
    case 'in': return <Badge className={cn(commonClasses, 'bg-sky-100 text-sky-700 border-sky-200')}>IN</Badge>
    case 'completed': return <Badge className={cn(commonClasses, 'bg-indigo-100 text-indigo-700 border-indigo-200')}>Completed</Badge>
    case 'rejected': return <Badge className={cn(commonClasses, 'bg-rose-50 text-rose-600 border-rose-200 uppercase')}>Rejected</Badge>
    case 'late_return': return <Badge className={cn(commonClasses, 'bg-red-100 text-red-700 border-red-200')}>LATE RETURN ({pass?.late_minutes}m)</Badge>
    default: return <Badge variant="outline">{status}</Badge>
  }
}

export const getMovementBadge = (movementStatus?: string) => {
  switch (movementStatus || 'pending') {
    case 'inside':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 uppercase text-[10px] tracking-normal px-2.5">INSIDE</Badge>
    case 'outside':
      return <Badge className="bg-rose-100 text-rose-700 border-rose-200 uppercase text-[10px] tracking-normal px-2.5">OUTSIDE</Badge>
    case 'returned':
      return <Badge className="bg-sky-100 text-sky-700 border-sky-200 uppercase text-[10px] tracking-normal px-2.5">RETURNED</Badge>
    default:
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 uppercase text-[10px] tracking-normal px-2.5">PENDING</Badge>
  }
}

export const getTrackingPhase = (pass?: GatePass | null) => {
  if (!pass) return 0
  if (pass.status === 'rejected') return -1
  if (pass.status === 'completed') return 5
  if (pass.actual_entry_at || pass.movement_status === 'returned' || pass.status === 'returned' || pass.status === 'in') return 4
  if (pass.actual_exit_at || pass.movement_status === 'outside' || pass.status === 'outside' || pass.status === 'out' || pass.status === 'used' || pass.status === 'late_return') return 3
  if (pass.status === 'approved') return 2
  return 1
}
