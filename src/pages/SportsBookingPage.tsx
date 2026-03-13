import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, MapPin, Users, Trophy } from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BrandedLoading } from '@/components/common/BrandedLoading'
import { EmptyState } from '@/components/ui/empty-state'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/utils'

interface SportEvent {
  id: number
  title: string
  start_date: string
  end_date: string
  location: string
  max_participants: number | null
  registration_count: number
  vacancy: number | null
  court_details?: { name: string; sport_name: string } | null
  is_match_ready?: boolean
}

interface EventRegistration {
  id: number
  event: number
  student: number
}

export default function SportsBookingPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  const { data: events, isLoading } = useQuery<SportEvent[]>({
    queryKey: ['sports-booking-events'],
    queryFn: async () => {
      const response = await api.get('/events/events/sports_upcoming/')
      return response.data.results || response.data
    },
    staleTime: 60_000,
  })

  const { data: registrations } = useQuery<EventRegistration[]>({
    queryKey: ['event-registrations'],
    queryFn: async () => {
      const response = await api.get('/events/registrations/')
      return response.data.results || response.data
    },
    staleTime: 30_000,
  })

  const registeredEventIds = useMemo(() => {
    if (!user?.id) return new Set<number>()
    return new Set(
      (registrations || [])
        .filter((r) => r.student === user.id)
        .map((r) => r.event)
    )
  }, [registrations, user?.id])

  const registerMutation = useMutation({
    mutationFn: async (eventId: number) => {
      await api.post('/events/registrations/register/', { event_id: eventId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-registrations'] })
      queryClient.invalidateQueries({ queryKey: ['sports-booking-events'] })
      toast.success('Sports slot booked successfully')
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to book sports slot'))
    },
  })

  if (isLoading) return <BrandedLoading message="Loading sports/ground slots..." />

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
          <Trophy className="h-7 w-7 text-primary" />
          Sports / Ground Booking
        </h1>
        <p className="text-sm text-muted-foreground font-medium">
          Apply for sports court/ground slots. This module is separate from general events.
        </p>
      </div>

      {events && events.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {events.map((event) => {
            const isRegistered = registeredEventIds.has(event.id)
            const isFull = event.vacancy === 0
            return (
              <Card key={event.id} className="rounded-2xl border-0 shadow-lg">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="text-xl font-black">{event.title}</CardTitle>
                    <Badge className={event.is_match_ready ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700'}>
                      {event.is_match_ready ? 'Match Ready' : 'Open'}
                    </Badge>
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {new Date(event.start_date).toLocaleString()}</p>
                    <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {event.court_details?.name || event.location}</p>
                    <p className="flex items-center gap-2"><Users className="h-4 w-4" /> {event.registration_count}/{event.max_participants || '∞'}</p>
                  </div>

                  <Button
                    className="w-full font-bold rounded-xl"
                    disabled={isRegistered || isFull || registerMutation.isPending}
                    onClick={() => registerMutation.mutate(event.id)}
                  >
                    {isRegistered ? 'Applied' : isFull ? 'Slot Full' : 'Apply Slot'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState icon={Trophy} title="No Sports Slots" description="No upcoming sports/ground slots available right now." />
      )}
    </div>
  )
}
