/**
 * SportsBookingPage — Student slot booking
 * Flow: Browse Sports → Select Court → Browse Slots → Book or Join Waitlist
 */
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, MapPin, Users, Trophy, Clock, ChevronRight, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CardGridSkeleton, ListSkeleton } from '@/components/common/PageSkeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/utils'
import type { Sport, SportCourt, CourtSlot, SportBooking } from '@/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const STATUS_BADGE: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-700',
  waitlisted: 'bg-amber-100 text-amber-700',
  attended: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-400',
  no_show: 'bg-rose-100 text-rose-600',
}

export default function SportsBookingPage() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null)
  const [selectedCourt, setSelectedCourt] = useState<SportCourt | null>(null)
  const [hodOpen, setHodOpen] = useState(false)
  const [hodForm, setHodForm] = useState({ title: '', department: '', year_of_study: '', estimated_players: '', notes: '' })

  const isHOD = ['hod', 'admin', 'super_admin'].includes(user?.role ?? '')

  // ── Data ────────────────────────────────────────────────────────────────────

  const { data: sports = [], isLoading: sportsLoading } = useQuery<Sport[]>({
    queryKey: ['booking-sports'],
    queryFn: async () => { const r = await api.get('/sports/facilities/'); return r.data.results ?? r.data },
    staleTime: 5 * 60_000,
  })

  const { data: courts = [], isLoading: courtsLoading } = useQuery<SportCourt[]>({
    queryKey: ['booking-courts', selectedSport?.id],
    queryFn: async () => {
      const r = await api.get('/sports/facilities/', { params: { sport: selectedSport!.id, status: 'open' } })
      return r.data.results ?? r.data
    },
    enabled: !!selectedSport,
    staleTime: 2 * 60_000,
  })

  const { data: slots = [], isLoading: slotsLoading } = useQuery<CourtSlot[]>({
    queryKey: ['booking-slots', selectedCourt?.id],
    queryFn: async () => {
      const r = await api.get('/sports/slots/', { params: { court: selectedCourt!.id, upcoming: '1' } })
      return r.data.results ?? r.data
    },
    enabled: !!selectedCourt,
    staleTime: 30_000,
  })

  const { data: myBookings = [], isLoading: bookingsLoading } = useQuery<SportBooking[]>({
    queryKey: ['my-sport-bookings'],
    queryFn: async () => { const r = await api.get('/sports/bookings/my-upcoming/'); return r.data },
    staleTime: 30_000,
  })

  const confirmedBookingsBySlot = useMemo(
    () => new Map(myBookings.filter((b) => b.status === 'confirmed').map((b) => [b.slot, b])),
    [myBookings],
  )

  const waitlistedBookingsBySlot = useMemo(
    () => new Map(myBookings.filter((b) => b.status === 'waitlisted').map((b) => [b.slot, b])),
    [myBookings],
  )

  const bookedSlotIds = useMemo(() => new Set(confirmedBookingsBySlot.keys()), [confirmedBookingsBySlot])

  // ── Mutations ────────────────────────────────────────────────────────────────

  const bookMutation = useMutation({
    mutationFn: ({ slotId, joinWaitlist = false }: { slotId: number; joinWaitlist?: boolean }) =>
      api.post('/sports/bookings/', joinWaitlist ? { slot: slotId, join_waitlist: true } : { slot: slotId }),
    onSuccess: (response) => {
      qc.invalidateQueries({ queryKey: ['my-sport-bookings'] })
      qc.invalidateQueries({ queryKey: ['booking-slots', selectedCourt?.id] })
      qc.invalidateQueries({ queryKey: ['pd-dashboard-stats'] })
      if (response.data?.status === 'waitlisted') {
        toast.success('Added to the waitlist. You will be promoted when a spot opens.')
        return
      }
      toast.success('Slot booked! Show the QR code when you arrive.')
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Booking failed')),
  })

  const cancelMutation = useMutation({
    mutationFn: (bookingId: number) => api.delete(`/sports/bookings/${bookingId}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-sport-bookings'] })
      qc.invalidateQueries({ queryKey: ['booking-slots', selectedCourt?.id] })
      qc.invalidateQueries({ queryKey: ['pd-dashboard-stats'] })
      toast.success('Booking updated.')
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Cancel failed')),
  })

  const hodMutation = useMutation({
    mutationFn: (payload: typeof hodForm) =>
      api.post('/sports/dept-requests/', {
        ...payload,
        sport: selectedSport?.id,
        year_of_study: payload.year_of_study ? Number(payload.year_of_study) : null,
        estimated_players: Number(payload.estimated_players),
        requested_date: new Date().toISOString().slice(0, 10),
        requested_start_time: '09:00',
        requested_end_time: '10:00',
      }),
    onSuccess: () => { toast.success('Class sports request submitted to PD.'); setHodOpen(false) },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Request failed')),
  })

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="page-align-shell space-y-3 sm:space-y-4 pb-6">
      {/* Header */}
      <div className="page-align-header">
        <div className="page-align-title">
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Trophy className="h-7 w-7 text-primary" />
            Sports Booking
          </h1>
          <p className="page-align-subtitle">
            Browse courts and book time slots for your sport.
          </p>
        </div>
        {isHOD && (
          <Button
            variant="outline"
            className="rounded-lg font-bold gap-2 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground shadow-sm"
            onClick={() => setHodOpen(true)}
          >
            Request Class Match
          </Button>
        )}
      </div>

      {/* Breadcrumb */}
      {(selectedSport || selectedCourt) && (
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground flex-wrap">
          <button onClick={() => { setSelectedSport(null); setSelectedCourt(null) }} className="text-primary hover:underline">
            All Sports
          </button>
          {selectedSport && (
            <>
              <ChevronRight className="h-4 w-4" />
              <button onClick={() => setSelectedCourt(null)} className="text-primary hover:underline">
                {selectedSport.name}
              </button>
            </>
          )}
          {selectedCourt && (
            <>
              <ChevronRight className="h-4 w-4" />
              <span className="text-gray-900">{selectedCourt.name}</span>
            </>
          )}
        </div>
      )}

      {/* Step 1: Sports */}
      {!selectedSport && (
        <section className="space-y-4">
          <SectionLabel>Select a Sport</SectionLabel>
          {sportsLoading ? (
            <CardGridSkeleton cols={3} rows={2} />
          ) : sports.length === 0 ? (
            <EmptyState icon={Trophy} title="No Sports" description="No active sports configured yet." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sports.filter((s) => s.status === 'active').map((sport) => (
                <button
                  key={sport.id}
                  onClick={() => setSelectedSport(sport)}
                  className="group relative p-5 rounded-xl bg-card border border-border shadow-sm hover:border-primary/30 hover:scale-[1.02] transition-all text-left space-y-3"
                >
                  <span className="text-4xl">{sport.icon || '🏅'}</span>
                  <div>
                    <p className="font-black text-gray-900 text-sm">{sport.name}</p>
                    <p className="text-[10px] font-bold text-muted-foreground capitalize">{sport.game_type} · {sport.courts_count} courts</p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                    <Users className="h-3 w-3" />{sport.min_players}–{sport.max_players} players
                  </div>
                  <ChevronRight className="absolute top-1/2 right-4 -translate-y-1/2 h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Step 2: Courts */}
      {selectedSport && !selectedCourt && (
        <section className="space-y-4">
          <SectionLabel>Select a Court — {selectedSport.name}</SectionLabel>
          {courtsLoading ? (
            <CardGridSkeleton cols={2} rows={2} />
          ) : courts.length === 0 ? (
            <EmptyState icon={MapPin} title="No Courts" description="No open courts for this sport right now." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {courts.map((court) => (
                <button
                  key={court.id}
                  onClick={() => setSelectedCourt(court)}
                  className="group text-left p-5 rounded-xl bg-card border border-border shadow-sm hover:border-primary/30 hover:scale-[1.01] transition-all space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-black text-gray-900">{court.name}</p>
                      {court.location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{court.location}</p>
                      )}
                    </div>
                    <Badge className={`${court.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} border-0 text-[10px] font-black uppercase`}>
                      {court.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Cap: {court.capacity}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {court.active_slots_today} slots today</span>
                  </div>
                  <div className="flex items-center justify-end">
                    <span className="text-xs font-black text-primary group-hover:underline flex items-center gap-1">
                      View Slots <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Step 3: Slots */}
      {selectedCourt && (
        <section className="space-y-4">
          <SectionLabel>Available Slots — {selectedCourt.name}</SectionLabel>
          {slotsLoading ? (
            <ListSkeleton rows={6} />
          ) : slots.length === 0 ? (
            <EmptyState icon={Clock} title="No Slots" description="No upcoming slots for this court." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {slots.map((slot) => {
                const isBooked = bookedSlotIds.has(slot.id)
                const myBooking = confirmedBookingsBySlot.get(slot.id)
                const waitlistedBooking = waitlistedBookingsBySlot.get(slot.id)
                return (
                  <Card key={slot.id} className={`rounded-xl border border-border bg-card shadow-sm transition-all ${slot.is_full && !isBooked ? 'opacity-60' : ''}`}>
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-gray-900 flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" />
                            {new Date(slot.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-sm font-bold text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3.5 w-3.5" />
                            {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          {slot.is_match_ready && (
                            <Badge className="bg-emerald-500 text-white border-0 text-[10px] font-black uppercase">Match Ready</Badge>
                          )}
                          {isBooked && (
                            <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px] font-black uppercase flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Booked
                            </Badge>
                          )}
                          {waitlistedBooking && (
                            <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] font-black uppercase">
                              Waitlist #{waitlistedBooking.waitlist_position ?? '?'}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Vacancy bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {slot.current_bookings} / {slot.max_players} players
                          </span>
                          <span className={slot.vacancy === 0 ? 'text-rose-500' : 'text-emerald-600'}>
                            {slot.vacancy === 0 ? 'Full' : `${slot.vacancy} spot${slot.vacancy > 1 ? 's' : ''} left`}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-sm h-1.5">
                          <div
                            className="bg-primary h-1.5 rounded-sm transition-all"
                            style={{ width: `${(slot.current_bookings / slot.max_players) * 100}%` }}
                          />
                        </div>
                        {slot.waitlist_count > 0 && (
                          <p className="text-[10px] font-bold text-amber-700">{slot.waitlist_count} student{slot.waitlist_count > 1 ? 's' : ''} waiting</p>
                        )}
                      </div>

                      {isBooked && myBooking ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full rounded-lg font-bold text-rose-500 hover:bg-rose-50 gap-1"
                          onClick={() => cancelMutation.mutate(myBooking.id)}
                          disabled={cancelMutation.isPending}
                        >
                          <XCircle className="h-4 w-4" /> Cancel Booking
                        </Button>
                      ) : waitlistedBooking ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full rounded-lg font-bold text-amber-700 hover:bg-amber-50 gap-1"
                          onClick={() => cancelMutation.mutate(waitlistedBooking.id)}
                          disabled={cancelMutation.isPending}
                        >
                          <XCircle className="h-4 w-4" /> Leave Waitlist
                        </Button>
                      ) : (
                        <Button
                          className="w-full rounded-lg font-bold"
                          disabled={bookMutation.isPending}
                          onClick={() => bookMutation.mutate({ slotId: slot.id, joinWaitlist: slot.is_full })}
                        >
                          {slot.is_full ? 'Join Waitlist' : 'Book Slot'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* My Upcoming Bookings */}
      {!selectedCourt && !selectedSport && myBookings.length > 0 && (
        <section className="space-y-4">
          <SectionLabel>My Bookings & Waitlist</SectionLabel>
          {bookingsLoading ? (
            <ListSkeleton rows={3} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myBookings.map((booking) => (
                <Card key={booking.id} className="rounded-xl border border-border bg-card shadow-sm">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-black text-gray-900">{booking.slot_details?.court_details?.sport_details?.name}</p>
                        <p className="text-xs text-muted-foreground">{booking.slot_details?.court_details?.name}</p>
                      </div>
                      <Badge className={`${STATUS_BADGE[booking.status] ?? 'bg-gray-100 text-gray-500'} border-0 text-[10px] font-black uppercase`}>
                        {booking.status}
                      </Badge>
                    </div>
                    <div className="text-xs font-medium text-muted-foreground space-y-0.5">
                      <p className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {booking.slot_details?.date} · {booking.slot_details?.start_time?.slice(0, 5)}–{booking.slot_details?.end_time?.slice(0, 5)}
                      </p>
                      {booking.status === 'waitlisted' && (
                        <p className="text-amber-700 font-bold">Waitlist position: #{booking.waitlist_position ?? '?'}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {/* HOD Request Dialog */}
      <Dialog open={hodOpen} onOpenChange={setHodOpen}>
        <DialogContent className="rounded-xl border border-border shadow-sm">
          <DialogHeader>
            <DialogTitle className="font-black text-xl">Request Class Match</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {[
              { label: 'Match Title', key: 'title', placeholder: 'e.g. CSE 2nd Year Football Match' },
              { label: 'Department', key: 'department', placeholder: 'e.g. Computer Science' },
              { label: 'Year of Study', key: 'year_of_study', type: 'number', placeholder: '2' },
              { label: 'Estimated Players', key: 'estimated_players', type: 'number', placeholder: '20' },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</Label>
                <input
                  type={type ?? 'text'}
                  className="w-full h-11 px-4 rounded-lg bg-muted border border-border font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={placeholder}
                  value={(hodForm as Record<string, string>)[key]}
                  onChange={(e) => setHodForm({ ...hodForm, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notes</Label>
              <Textarea
                className="rounded-lg bg-muted border border-border resize-none"
                rows={2}
                value={hodForm.notes}
                onChange={(e) => setHodForm({ ...hodForm, notes: e.target.value })}
              />
            </div>
            <Button
              onClick={() => hodMutation.mutate(hodForm)}
              disabled={hodMutation.isPending || !hodForm.title || !hodForm.department || !hodForm.estimated_players}
              className="w-full rounded-lg font-black h-12"
            >
              {hodMutation.isPending ? 'Submitting...' : 'Submit to PD'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{children}</p>
  )
}
