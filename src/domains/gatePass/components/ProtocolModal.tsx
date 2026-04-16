import { useEffect, useState } from 'react'
import { Calendar as CalendarIcon, CheckCircle2, Clock, Phone, User as UserIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { GatePass } from '@/types'
import { AudioPlayer } from '@/domains/gatePass/components/AudioPlayer'

type ProtocolModalProps = {
  pass: GatePass | null
  setProtocolPass: (pass: GatePass | null) => void
  setSelectedStudentForCard: (pass: GatePass | null) => void
  approveMutation: {
    isPending?: boolean
    mutate: (params: { id: number; remarks: string; parent_informed: boolean }) => void
  }
  rejectMutation: {
    isPending?: boolean
    mutate: (params: { id: number; remarks: string }) => void
  }
}

export function ProtocolModal({
  pass,
  setProtocolPass,
  setSelectedStudentForCard,
  approveMutation,
  rejectMutation,
}: ProtocolModalProps) {
  const [remarks, setRemarks] = useState('')
  const [parentInformed, setParentInformed] = useState(pass?.parent_informed || false)

  useEffect(() => {
    if (pass) {
      setRemarks('')
      setParentInformed(pass.parent_informed || false)
    }
  }, [pass])

  if (!pass) return null

  return (
    <Dialog open={!!pass} onOpenChange={(open) => !open && setProtocolPass(null)}>
      <DialogContent className="max-w-md rounded p-0 overflow-hidden border-0 shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="bg-primary/10 p-6 border-b border-primary/20">
          <DialogTitle className="text-xl font-black text-primary">Gatepass Review</DialogTitle>
          <DialogDescription className="text-xs font-semibold text-primary/60 uppercase tracking-normaler">Pending Approval Request</DialogDescription>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto stylish-scrollbar focus:outline-none">
          <div className="bg-muted/30 p-5 rounded-sm border border-border space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-normal mb-1">Student Information</p>
                <h3 className="font-black text-lg text-slate-900 leading-tight">{pass.student_name}</h3>
                <p className="text-xs font-bold text-primary">{pass.student_hall_ticket}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-sm font-black text-[10px] h-8 border-primary/20 hover:bg-primary/5 text-primary"
                onClick={() => setSelectedStudentForCard(pass)}
              >
                <UserIcon className="h-3 w-3 mr-1.5" /> DIGITAL CARD
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed">
              <div>
                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-normal mb-0.5">Hostel / Room</p>
                <p className="text-xs font-bold text-slate-700">{pass.hostel_name} • {pass.student_room}</p>
              </div>
              <div>
                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-normal mb-0.5">Contact</p>
                <p className="text-xs font-bold text-slate-700">{pass.student_phone}</p>
              </div>
            </div>
          </div>

          {pass.audio_brief && (
            <div className="p-4 bg-primary/5 rounded-sm border border-primary/10">
              <AudioPlayer url={pass.audio_brief} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-orange-50/50 rounded-sm border border-orange-100">
              <p className="text-[8px] font-black text-orange-600 uppercase tracking-normal mb-1.5 flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Outbound
              </p>
              <p className="text-xs font-black text-blue-950">{pass.exit_date}</p>
              <p className="text-[10px] font-bold text-blue-800/60">{pass.exit_time}</p>
            </div>
            <div className="p-4 bg-emerald-50/50 rounded-sm border border-emerald-100">
              <p className="text-[8px] font-black text-emerald-600 uppercase tracking-normal mb-1.5 flex items-center gap-1.5">
                <CalendarIcon className="h-3 w-3" /> Inbound
              </p>
              <p className="text-xs font-black text-emerald-950">{pass.expected_return_date}</p>
              <p className="text-[10px] font-bold text-emerald-800/60">{pass.expected_return_time}</p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex flex-col gap-3 p-4 bg-orange-50/50 rounded-sm border border-orange-100">
              <div
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity mb-2"
                onClick={() => setParentInformed(!parentInformed)}
              >
                <div className={cn(
                  'h-5 w-5 rounded-sm border-2 flex items-center justify-center transition-all',
                  parentInformed ? 'bg-primary border-primary' : 'bg-white border-orange-200'
                )}>
                  {parentInformed && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                </div>
                <span className="text-xs font-black text-blue-900 uppercase tracking-normal">Parent / Guardian Informed</span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {pass.student_phone && (
                  <a href={`tel:${pass.student_phone}`} className="flex items-center justify-between p-3 bg-white border border-orange-200 hover:border-primary hover:bg-orange-50 rounded-sm transition-all shadow-sm group">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-orange-500 uppercase tracking-normal">Student Mobile</span>
                      <span className="text-sm font-bold text-slate-800 group-hover:text-primary">{pass.student_name || 'Student'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-blue-800 font-black">
                      <span>{pass.student_phone}</span>
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-orange-600 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                        <Phone className="h-4 w-4" />
                      </div>
                    </div>
                  </a>
                )}
                {pass.father_phone && (
                  <a href={`tel:${pass.father_phone}`} className="flex items-center justify-between p-3 bg-white border border-orange-200 hover:border-primary hover:bg-orange-50 rounded-sm transition-all shadow-sm group">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-orange-500 uppercase tracking-normal">Father Number</span>
                      <span className="text-sm font-bold text-slate-800 group-hover:text-primary">{pass.father_name || 'Father'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-blue-800 font-black">
                      <span>{pass.father_phone}</span>
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-orange-600 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                        <Phone className="h-4 w-4" />
                      </div>
                    </div>
                  </a>
                )}
                {pass.guardian_phone && (
                  <a href={`tel:${pass.guardian_phone}`} className="flex items-center justify-between p-3 bg-white border border-orange-200 hover:border-primary hover:bg-orange-50 rounded-sm transition-all shadow-sm group">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-orange-500 uppercase tracking-normal">Guardian Number</span>
                      <span className="text-sm font-bold text-slate-800 group-hover:text-primary">{pass.guardian_name || 'Guardian'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-blue-800 font-black">
                      <span>{pass.guardian_phone}</span>
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-orange-600 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                        <Phone className="h-4 w-4" />
                      </div>
                    </div>
                  </a>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-normal text-muted-foreground ml-1">Warden Remarks (Mandatory)</Label>
              <Textarea
                placeholder="Enter reason for approval or rejection..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="rounded-sm border-2 border-slate-100 bg-slate-50 min-h-[100px] focus:ring-primary p-4 font-bold text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <Button
              disabled={!remarks.trim() || approveMutation.isPending || rejectMutation.isPending}
              className="h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-sm shadow-xl shadow-emerald-500/20 text-sm flex flex-col gap-0.5"
              onClick={() => approveMutation.mutate({ id: pass.id, remarks, parent_informed: parentInformed })}
            >
              {approveMutation.isPending ? 'Processing...' : 'APPROVE'}
            </Button>
            <Button
              variant="outline"
              disabled={!remarks.trim() || approveMutation.isPending || rejectMutation.isPending}
              className="h-14 border-2 border-rose-100 hover:bg-rose-50 text-rose-600 font-black rounded-sm text-sm transition-all"
              onClick={() => rejectMutation.mutate({ id: pass.id, remarks })}
            >
              {rejectMutation.isPending ? 'Processing...' : 'REJECT'}
            </Button>
          </div>

          <Button variant="ghost" className="w-full h-10 rounded-sm font-bold text-slate-400 text-xs" onClick={() => setProtocolPass(null)}>Close Review Panel</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
