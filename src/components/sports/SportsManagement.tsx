/**
 * SportsManagement — PT/PD/Admin CRUD panel
 * Tabs: Sports | Courts/Grounds | Slots | Policy | Equipment | HOD Requests
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Trophy,
  MapPin,
  Clock,
  Settings,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  ClipboardList,
  Package,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/utils'
import type {
  Sport,
  SportCourt,
  CourtSlot,
  SportsPolicy,
  DepartmentSportsRequest,
  SportEquipment,
  SportEquipmentIssue,
} from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-gray-100 text-gray-500',
  open: 'bg-emerald-100 text-emerald-700',
  maintenance: 'bg-amber-100 text-amber-700',
  closed: 'bg-rose-100 text-rose-700',
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  completed: 'bg-blue-100 text-blue-700',
  available: 'bg-emerald-100 text-emerald-700',
  retired: 'bg-gray-100 text-gray-500',
  issued: 'bg-blue-100 text-blue-700',
  returned: 'bg-gray-100 text-gray-500',
  waitlisted: 'bg-amber-100 text-amber-700',
}

// ─── Sports Tab ───────────────────────────────────────────────────────────────

function SportsTab() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    min_players: '1',
    max_players: '10',
    game_type: 'team',
    status: 'active',
    icon: '',
    description: '',
  })

  const { data: sports = [] } = useQuery<Sport[]>({
    queryKey: ['mgmt-sports'],
    queryFn: async () => {
      const r = await api.get('/sports/sports/')
      return r.data.results ?? r.data
    },
    staleTime: 60_000,
  })

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      api.post('/sports/sports/', {
        ...payload,
        min_players: Number(payload.min_players),
        max_players: Number(payload.max_players),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mgmt-sports'] })
      toast.success('Sport created')
      setOpen(false)
      setForm({ name: '', min_players: '1', max_players: '10', game_type: 'team', status: 'active', icon: '', description: '' })
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to create sport')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/sports/sports/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mgmt-sports'] })
      toast.success('Sport deleted')
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Delete failed')),
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)} className="rounded-sm font-bold gap-2">
          <Plus className="h-4 w-4" /> Add Sport
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sports.map((s) => (
          <Card key={s.id} className="rounded-sm border-0 shadow-lg">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{s.icon || '🏅'}</span>
                  <div>
                    <p className="font-black text-gray-900">{s.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{s.game_type}</p>
                  </div>
                </div>
                <Badge className={`${STATUS_COLOR[s.status]} border-0 text-[10px] font-black uppercase`}>
                  {s.status}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
                <span>Min: {s.min_players}</span>
                <span>Max: {s.max_players}</span>
                <span>{s.courts_count} courts</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-sm w-full font-bold text-xs gap-1"
                onClick={() => deleteMutation.mutate(s.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3 w-3" /> Delete
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded border-0">
          <DialogHeader>
            <DialogTitle className="font-black text-xl">New Sport</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {[
              { label: 'Name', key: 'name', placeholder: 'e.g. Badminton' },
              { label: 'Icon (emoji)', key: 'icon', placeholder: '🏸' },
              { label: 'Min Players', key: 'min_players', type: 'number' },
              { label: 'Max Players', key: 'max_players', type: 'number' },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</Label>
                <Input
                  type={type ?? 'text'}
                  value={(form as Record<string, string>)[key]}
                  placeholder={placeholder}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="rounded-sm border-0 bg-gray-50"
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Game Type</Label>
              <Select value={form.game_type} onValueChange={(v) => setForm({ ...form, game_type: v })}>
                <SelectTrigger className="rounded-sm border-0 bg-gray-50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['singles', 'doubles', 'team', 'mixed'].map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="rounded-sm border-0 bg-gray-50 resize-none"
                rows={2}
              />
            </div>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.name}
              className="w-full rounded-sm font-black h-12"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Sport'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Courts Tab ───────────────────────────────────────────────────────────────

function CourtsTab() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', sport: '', location: '', capacity: '10', status: 'open', notes: '' })

  const { data: sports = [] } = useQuery<Sport[]>({
    queryKey: ['mgmt-sports'],
    queryFn: async () => { const r = await api.get('/sports/sports/'); return r.data.results ?? r.data },
    staleTime: 60_000,
  })

  const { data: courts = [] } = useQuery<SportCourt[]>({
    queryKey: ['mgmt-courts'],
    queryFn: async () => { const r = await api.get('/sports/courts/'); return r.data.results ?? r.data },
    staleTime: 60_000,
  })

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      api.post('/sports/courts/', { ...payload, sport: Number(payload.sport), capacity: Number(payload.capacity) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mgmt-courts'] })
      toast.success('Court / ground created')
      setOpen(false)
      setForm({ name: '', sport: '', location: '', capacity: '10', status: 'open', notes: '' })
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/sports/courts/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mgmt-courts'] }); toast.success('Court deleted') },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Delete failed')),
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)} className="rounded-sm font-bold gap-2">
          <Plus className="h-4 w-4" /> Add Court / Ground
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {courts.map((c) => (
          <Card key={c.id} className="rounded-sm border-0 shadow-lg">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-black text-gray-900">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.sport_details?.name}</p>
                </div>
                <Badge className={`${STATUS_COLOR[c.status]} border-0 text-[10px] font-black uppercase`}>{c.status}</Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
                {c.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.location}</span>}
                <span>Cap: {c.capacity}</span>
                <span>{c.active_slots_today} slots today</span>
              </div>
              <Button
                size="sm" variant="ghost"
                className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-sm w-full font-bold text-xs gap-1"
                onClick={() => deleteMutation.mutate(c.id)} disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3 w-3" /> Delete
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded border-0">
          <DialogHeader><DialogTitle className="font-black text-xl">New Court / Ground</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sport</Label>
              <Select value={form.sport} onValueChange={(v) => setForm({ ...form, sport: v })}>
                <SelectTrigger className="rounded-sm border-0 bg-gray-50"><SelectValue placeholder="Select sport" /></SelectTrigger>
                <SelectContent>
                  {sports.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {[
              { label: 'Court / Ground Name', key: 'name', placeholder: 'e.g. Badminton Court 1 or Cricket Ground' },
              { label: 'Location', key: 'location', placeholder: 'e.g. Block A Ground Floor' },
              { label: 'Capacity', key: 'capacity', type: 'number' },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</Label>
                <Input
                  type={type ?? 'text'} value={(form as Record<string, string>)[key]}
                  placeholder={placeholder}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="rounded-sm border-0 bg-gray-50"
                />
              </div>
            ))}
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.name || !form.sport}
              className="w-full rounded-sm font-black h-12"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Court / Ground'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Slots Tab ─────────────────────────────────────────────────────────────────

function SlotsTab() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ court: '', date: '', start_time: '', end_time: '', max_players: '', notes: '' })

  const { data: courts = [] } = useQuery<SportCourt[]>({
    queryKey: ['mgmt-courts'],
    queryFn: async () => { const r = await api.get('/sports/courts/'); return r.data.results ?? r.data },
    staleTime: 60_000,
  })

  const today = new Date().toISOString().slice(0, 10)
  const { data: slots = [] } = useQuery<CourtSlot[]>({
    queryKey: ['mgmt-slots', today],
    queryFn: async () => {
      const r = await api.get('/sports/slots/today-schedule/')
      return r.data
    },
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      api.post('/sports/slots/', { ...payload, court: Number(payload.court), max_players: Number(payload.max_players) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mgmt-slots'] })
      toast.success('Slot created')
      setOpen(false)
      setForm({ court: '', date: '', start_time: '', end_time: '', max_players: '', notes: '' })
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to create slot')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/sports/slots/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mgmt-slots'] }); toast.success('Slot deleted') },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Delete failed')),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-muted-foreground">Today's Schedule</p>
        <Button onClick={() => setOpen(true)} className="rounded-sm font-bold gap-2">
          <Plus className="h-4 w-4" /> Add Slot
        </Button>
      </div>

      {slots.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm font-medium">
          No slots scheduled for today.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {slots.map((slot) => (
          <Card key={slot.id} className="rounded-sm border-0 shadow-lg">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-black text-gray-900">{slot.court_details?.name}</p>
                  <p className="text-xs text-muted-foreground">{slot.court_details?.sport_details?.name}</p>
                </div>
                <Badge className={`${slot.is_match_ready ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'} border-0 text-[10px] font-black uppercase`}>
                  {slot.is_match_ready ? 'Ready' : 'Open'}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{slot.start_time}–{slot.end_time}</span>
                <span>{slot.current_bookings}/{slot.max_players} players</span>
                <span className={slot.vacancy === 0 ? 'text-rose-500 font-bold' : 'text-emerald-600 font-bold'}>
                  {slot.vacancy === 0 ? 'Full' : `${slot.vacancy} left`}
                </span>
                {slot.waitlist_count > 0 && <span className="text-amber-600 font-bold">{slot.waitlist_count} waiting</span>}
              </div>
              <Button
                size="sm" variant="ghost"
                className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-sm w-full font-bold text-xs gap-1"
                onClick={() => deleteMutation.mutate(slot.id)} disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3 w-3" /> Delete Slot
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded border-0">
          <DialogHeader><DialogTitle className="font-black text-xl">New Time Slot</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Court</Label>
              <Select value={form.court} onValueChange={(v) => setForm({ ...form, court: v })}>
                <SelectTrigger className="rounded-sm border-0 bg-gray-50"><SelectValue placeholder="Select court" /></SelectTrigger>
                <SelectContent>
                  {courts.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {[
              { label: 'Date', key: 'date', type: 'date' },
              { label: 'Start Time', key: 'start_time', type: 'time' },
              { label: 'End Time', key: 'end_time', type: 'time' },
              { label: 'Max Players', key: 'max_players', type: 'number', placeholder: 'e.g. 4' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</Label>
                <Input
                  type={type} value={(form as Record<string, string>)[key]}
                  placeholder={placeholder}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="rounded-sm border-0 bg-gray-50"
                />
              </div>
            ))}
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.court || !form.date || !form.start_time || !form.end_time || !form.max_players}
              className="w-full rounded-sm font-black h-12"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Slot'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Policy Tab ────────────────────────────────────────────────────────────────

function PolicyTab() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ max_bookings_per_day: '1', max_bookings_per_week: '3', booking_window_days: '7', allow_same_sport_same_day: false })
  const [policyId, setPolicyId] = useState<number | null>(null)

  useQuery<SportsPolicy[]>({
    queryKey: ['mgmt-policy'],
    queryFn: async () => {
      const r = await api.get('/sports/policy/')
      const list = r.data.results ?? r.data
      const p = Array.isArray(list) ? list[0] : list
      if (p) {
        setPolicyId(p.id)
        setForm({
          max_bookings_per_day: String(p.max_bookings_per_day),
          max_bookings_per_week: String(p.max_bookings_per_week),
          booking_window_days: String(p.booking_window_days),
          allow_same_sport_same_day: p.allow_same_sport_same_day,
        })
      }
      return list
    },
    staleTime: 60_000,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        max_bookings_per_day: Number(form.max_bookings_per_day),
        max_bookings_per_week: Number(form.max_bookings_per_week),
        booking_window_days: Number(form.booking_window_days),
        allow_same_sport_same_day: form.allow_same_sport_same_day,
      }
      if (policyId) {
        return api.patch(`/sports/policy/${policyId}/`, payload)
      }
      return api.post('/sports/policy/', payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mgmt-policy'] }); toast.success('Policy saved') },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to save policy')),
  })

  return (
    <Card className="rounded-sm border-0 shadow-lg max-w-lg">
      <CardHeader><CardTitle className="font-black">Booking Rules</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        {[
          { label: 'Max Bookings / Day', key: 'max_bookings_per_day', type: 'number' },
          { label: 'Max Bookings / Week', key: 'max_bookings_per_week', type: 'number' },
          { label: 'Booking Window (days ahead)', key: 'booking_window_days', type: 'number' },
        ].map(({ label, key, type }) => (
          <div key={key} className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</Label>
            <Input
              type={type}
              value={(form as Record<string, unknown>)[key] as string}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="rounded-sm border-0 bg-gray-50 h-12 font-bold"
            />
          </div>
        ))}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="same-sport"
            className="h-4 w-4 accent-primary"
            checked={form.allow_same_sport_same_day}
            onChange={(e) => setForm({ ...form, allow_same_sport_same_day: e.target.checked })}
          />
          <Label htmlFor="same-sport" className="font-bold text-sm">Allow same sport twice per day</Label>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full rounded-sm font-black h-12">
          {saveMutation.isPending ? 'Saving...' : 'Save Policy'}
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Equipment Tab ───────────────────────────────────────────────────────────

function EquipmentTab() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [selectedEquipment, setSelectedEquipment] = useState<SportEquipment | null>(null)
  const [form, setForm] = useState({
    sport: '',
    name: '',
    category: '',
    total_quantity: '1',
    low_stock_threshold: '1',
    status: 'available',
    storage_location: '',
    notes: '',
  })
  const [issueForm, setIssueForm] = useState({ issued_to_lookup: '', quantity: '1', due_back_at: '', notes: '' })

  const resetIssueDialog = () => {
    setSelectedEquipment(null)
    setIssueForm({ issued_to_lookup: '', quantity: '1', due_back_at: '', notes: '' })
  }

  const invalidateEquipment = () => {
    qc.invalidateQueries({ queryKey: ['mgmt-equipment'] })
    qc.invalidateQueries({ queryKey: ['mgmt-equipment-issues'] })
    qc.invalidateQueries({ queryKey: ['pd-dashboard-stats'] })
  }

  const { data: sports = [] } = useQuery<Sport[]>({
    queryKey: ['mgmt-sports'],
    queryFn: async () => { const r = await api.get('/sports/sports/'); return r.data.results ?? r.data },
    staleTime: 60_000,
  })

  const { data: equipment = [] } = useQuery<SportEquipment[]>({
    queryKey: ['mgmt-equipment'],
    queryFn: async () => { const r = await api.get('/sports/equipment/'); return r.data.results ?? r.data },
    staleTime: 30_000,
  })

  const { data: activeIssues = [] } = useQuery<SportEquipmentIssue[]>({
    queryKey: ['mgmt-equipment-issues'],
    queryFn: async () => {
      const r = await api.get('/sports/equipment-issues/', { params: { status: 'issued' } })
      return r.data.results ?? r.data
    },
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => api.post('/sports/equipment/', {
      ...payload,
      sport: Number(payload.sport),
      total_quantity: Number(payload.total_quantity),
      low_stock_threshold: Number(payload.low_stock_threshold),
    }),
    onSuccess: () => {
      invalidateEquipment()
      toast.success('Equipment added')
      setOpen(false)
      setForm({
        sport: '',
        name: '',
        category: '',
        total_quantity: '1',
        low_stock_threshold: '1',
        status: 'available',
        storage_location: '',
        notes: '',
      })
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to add equipment')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/sports/equipment/${id}/`),
    onSuccess: () => { invalidateEquipment(); toast.success('Equipment deleted') },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Delete failed')),
  })

  const issueMutation = useMutation({
    mutationFn: () => api.post('/sports/equipment-issues/', {
      equipment: selectedEquipment?.id,
      issued_to_lookup: issueForm.issued_to_lookup,
      quantity: Number(issueForm.quantity),
      due_back_at: issueForm.due_back_at || null,
      notes: issueForm.notes,
    }),
    onSuccess: () => {
      invalidateEquipment()
      toast.success('Equipment issued')
      setIssueOpen(false)
      resetIssueDialog()
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Issue failed')),
  })

  const returnMutation = useMutation({
    mutationFn: (id: number) => api.post(`/sports/equipment-issues/${id}/return-item/`, {}),
    onSuccess: () => { invalidateEquipment(); toast.success('Equipment returned') },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Return failed')),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-muted-foreground">Gear, kits, nets, racquets and issued items</p>
        <Button onClick={() => setOpen(true)} className="rounded-sm font-bold gap-2">
          <Plus className="h-4 w-4" /> Add Equipment
        </Button>
      </div>

      {equipment.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm font-medium">
          No equipment tracked yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {equipment.map((item) => (
            <Card key={item.id} className="rounded-sm border-0 shadow-lg">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-black text-gray-900">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.sport_details?.name}{item.category ? ` · ${item.category}` : ''}</p>
                  </div>
                  <Badge className={`${STATUS_COLOR[item.status]} border-0 text-[10px] font-black uppercase`}>{item.status}</Badge>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs font-medium text-muted-foreground">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-black">Total</p>
                    <p className="text-sm font-black text-gray-900">{item.total_quantity}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-black">Available</p>
                    <p className="text-sm font-black text-emerald-700">{item.available_quantity}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-black">Issued</p>
                    <p className="text-sm font-black text-blue-700">{item.issued_quantity}</p>
                  </div>
                </div>

                <div className="space-y-1 text-xs font-medium text-muted-foreground">
                  {item.storage_location && <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{item.storage_location}</p>}
                  <p>Active checkouts: {item.active_issues}</p>
                </div>

                {item.is_low_stock && (
                  <div className="flex items-center gap-2 rounded-sm bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" /> Low stock threshold reached
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 rounded-sm font-bold gap-1"
                    onClick={() => { setSelectedEquipment(item); setIssueOpen(true) }}
                    disabled={item.status !== 'available' || item.available_quantity === 0}
                  >
                    <Package className="h-3.5 w-3.5" /> Issue
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 rounded-sm font-bold gap-1 text-rose-500 hover:bg-rose-50"
                    onClick={() => deleteMutation.mutate(item.id)}
                    disabled={deleteMutation.isPending || item.issued_quantity > 0}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Checked Out Now</p>
        {activeIssues.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active equipment issues.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeIssues.map((issue) => (
              <Card key={issue.id} className="rounded-sm border-0 shadow-lg">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-black text-gray-900">{issue.equipment_details?.name}</p>
                      <p className="text-xs text-muted-foreground">{issue.issued_to_details.name} · {issue.issued_to_details.registration_number}</p>
                    </div>
                    <Badge className={`${issue.is_overdue ? 'bg-rose-100 text-rose-700' : STATUS_COLOR[issue.status]} border-0 text-[10px] font-black uppercase`}>
                      {issue.is_overdue ? 'overdue' : issue.status}
                    </Badge>
                  </div>
                  <div className="space-y-0.5 text-xs font-medium text-muted-foreground">
                    <p>Qty: {issue.quantity}</p>
                    <p>Issued by: {issue.issued_by_details?.name ?? 'Sports desk'}</p>
                    <p>Issued: {new Date(issue.created_at).toLocaleString()}</p>
                    {issue.due_back_at && <p className={issue.is_overdue ? 'text-rose-600 font-bold' : ''}>Due: {new Date(issue.due_back_at).toLocaleString()}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full rounded-sm font-bold gap-1 text-emerald-600 hover:bg-emerald-50"
                    onClick={() => returnMutation.mutate(issue.id)}
                    disabled={returnMutation.isPending}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Mark Returned
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded border-0">
          <DialogHeader><DialogTitle className="font-black text-xl">Add Sports Equipment</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sport</Label>
              <Select value={form.sport} onValueChange={(v) => setForm({ ...form, sport: v })}>
                <SelectTrigger className="rounded-sm border-0 bg-gray-50"><SelectValue placeholder="Select sport" /></SelectTrigger>
                <SelectContent>
                  {sports.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {[
              { label: 'Equipment Name', key: 'name', placeholder: 'e.g. Shuttle Tubes' },
              { label: 'Category', key: 'category', placeholder: 'e.g. Consumables' },
              { label: 'Total Quantity', key: 'total_quantity', type: 'number' },
              { label: 'Low Stock Threshold', key: 'low_stock_threshold', type: 'number' },
              { label: 'Storage Location', key: 'storage_location', placeholder: 'e.g. Sports Room Rack A' },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</Label>
                <Input
                  type={type ?? 'text'}
                  value={(form as Record<string, string>)[key]}
                  placeholder={placeholder}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="rounded-sm border-0 bg-gray-50"
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="rounded-sm border-0 bg-gray-50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['available', 'maintenance', 'retired'].map((status) => (
                    <SelectItem key={status} value={status} className="capitalize">{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="rounded-sm border-0 bg-gray-50 resize-none"
                rows={2}
              />
            </div>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.sport || !form.name}
              className="w-full rounded-sm font-black h-12"
            >
              {createMutation.isPending ? 'Saving...' : 'Save Equipment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={issueOpen}
        onOpenChange={(next) => {
          setIssueOpen(next)
          if (!next) {
            resetIssueDialog()
          }
        }}
      >
        <DialogContent className="rounded border-0">
          <DialogHeader><DialogTitle className="font-black text-xl">Issue Equipment</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="rounded-sm bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">
              {selectedEquipment ? `${selectedEquipment.name} · ${selectedEquipment.available_quantity} available` : 'Select equipment'}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Student Reg. No / Username</Label>
              <Input
                value={issueForm.issued_to_lookup}
                onChange={(e) => setIssueForm({ ...issueForm, issued_to_lookup: e.target.value })}
                placeholder="e.g. 23CS001 or student username"
                className="rounded-sm border-0 bg-gray-50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quantity</Label>
              <Input
                type="number"
                min="1"
                value={issueForm.quantity}
                onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })}
                className="rounded-sm border-0 bg-gray-50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Due Back</Label>
              <Input
                type="datetime-local"
                value={issueForm.due_back_at}
                onChange={(e) => setIssueForm({ ...issueForm, due_back_at: e.target.value })}
                className="rounded-sm border-0 bg-gray-50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notes</Label>
              <Textarea
                value={issueForm.notes}
                onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })}
                className="rounded-sm border-0 bg-gray-50 resize-none"
                rows={2}
              />
            </div>
            <Button
              onClick={() => issueMutation.mutate()}
              disabled={issueMutation.isPending || !selectedEquipment || !issueForm.issued_to_lookup || !issueForm.quantity}
              className="w-full rounded-sm font-black h-12"
            >
              {issueMutation.isPending ? 'Issuing...' : 'Issue Equipment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── HOD Requests Tab ──────────────────────────────────────────────────────────

function HODRequestsTab() {
  const qc = useQueryClient()
  const [approveData, setApproveData] = useState<{ id: number; courtId: string } | null>(null)

  const { data: requests = [] } = useQuery<DepartmentSportsRequest[]>({
    queryKey: ['mgmt-dept-requests'],
    queryFn: async () => { const r = await api.get('/sports/dept-requests/'); return r.data.results ?? r.data },
    staleTime: 30_000,
  })

  const { data: courts = [] } = useQuery<SportCourt[]>({
    queryKey: ['mgmt-courts'],
    queryFn: async () => { const r = await api.get('/sports/courts/'); return r.data.results ?? r.data },
    staleTime: 60_000,
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, courtId }: { id: number; courtId: string }) =>
      api.post(`/sports/dept-requests/${id}/approve/`, { court_id: Number(courtId) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mgmt-dept-requests'] }); toast.success('Request approved and slot allocated'); setApproveData(null) },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Approval failed')),
  })

  const rejectMutation = useMutation({
    mutationFn: (id: number) => api.post(`/sports/dept-requests/${id}/reject/`, { reason: 'Declined by PD' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mgmt-dept-requests'] }); toast.success('Request rejected') },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Rejection failed')),
  })

  const pending = requests.filter((r) => r.status === 'pending')
  const others = requests.filter((r) => r.status !== 'pending')

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Pending ({pending.length})
        </p>
        {pending.length === 0 && <p className="text-sm text-muted-foreground">No pending requests.</p>}
        {pending.map((req) => (
          <Card key={req.id} className="rounded-sm border-0 shadow-lg border-l-4 border-l-amber-400">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-black text-gray-900">{req.title}</p>
                  <p className="text-xs text-muted-foreground">{req.department} {req.year_of_study ? `· Year ${req.year_of_study}` : ''}</p>
                </div>
                <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] font-black uppercase">Pending</Badge>
              </div>
              <div className="text-xs font-medium text-muted-foreground space-y-0.5">
                <p>Sport: {req.sport_details?.name}</p>
                <p>Date: {req.requested_date} · {req.requested_start_time}–{req.requested_end_time}</p>
                <p>Players: ~{req.estimated_players}</p>
                {req.notes && <p>Note: {req.notes}</p>}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 rounded-sm font-bold gap-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={() => setApproveData({ id: req.id, courtId: '' })}
                >
                  <CheckCircle className="h-3 w-3" /> Approve
                </Button>
                <Button
                  size="sm" variant="ghost"
                  className="flex-1 rounded-sm font-bold gap-1 text-rose-500 hover:bg-rose-50"
                  onClick={() => rejectMutation.mutate(req.id)} disabled={rejectMutation.isPending}
                >
                  <XCircle className="h-3 w-3" /> Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {others.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Past Requests</p>
          {others.map((req) => (
            <div key={req.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-sm">
              <div>
                <p className="font-bold text-sm text-gray-900">{req.title}</p>
                <p className="text-xs text-muted-foreground">{req.department} · {req.requested_date}</p>
              </div>
              <Badge className={`${STATUS_COLOR[req.status]} border-0 text-[10px] font-black uppercase`}>{req.status}</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Approve dialog – pick court */}
      <Dialog open={!!approveData} onOpenChange={() => setApproveData(null)}>
        <DialogContent className="rounded border-0">
          <DialogHeader><DialogTitle className="font-black text-xl">Approve & Allocate Court</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Court</Label>
              <Select
                value={approveData?.courtId ?? ''}
                onValueChange={(v) => setApproveData((prev) => prev ? { ...prev, courtId: v } : prev)}
              >
                <SelectTrigger className="rounded-sm border-0 bg-gray-50"><SelectValue placeholder="Choose a court" /></SelectTrigger>
                <SelectContent>
                  {courts.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => approveData && approveMutation.mutate({ id: approveData.id, courtId: approveData.courtId })}
              disabled={approveMutation.isPending || !approveData?.courtId}
              className="w-full rounded-sm font-black h-12 bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve & Create Slot'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Main Export ───────────────────────────────────────────────────────────────

export function SportsManagement() {
  return (
    <Card className="rounded border-0 shadow-2xl shadow-black/5 overflow-hidden bg-white">
      <CardHeader className="px-8 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-sm text-primary">
            <Settings className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl font-black">Sports Management</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground ml-1 font-medium">
          PT/PD/Admin can configure sports, courts, grounds, slots, booking policies, inventory and class requests.
        </p>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        <Tabs defaultValue="sports">
          <TabsList className="rounded-sm bg-gray-100 p-1 h-auto mb-6 flex flex-wrap gap-1">
            {[
              { value: 'sports', label: 'Sports', icon: Trophy },
              { value: 'courts', label: 'Courts / Grounds', icon: MapPin },
              { value: 'slots', label: 'Slots', icon: Clock },
              { value: 'policy', label: 'Policy', icon: Settings },
              { value: 'equipment', label: 'Equipment', icon: Package },
              { value: 'hod', label: 'HOD Requests', icon: ClipboardList },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-sm px-4 py-2 text-xs font-black uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-md gap-1.5"
              >
                <Icon className="h-3 w-3" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="sports"><SportsTab /></TabsContent>
          <TabsContent value="courts"><CourtsTab /></TabsContent>
          <TabsContent value="slots"><SlotsTab /></TabsContent>
          <TabsContent value="policy"><PolicyTab /></TabsContent>
          <TabsContent value="equipment"><EquipmentTab /></TabsContent>
          <TabsContent value="hod"><HODRequestsTab /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
