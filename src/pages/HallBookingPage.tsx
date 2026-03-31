import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Building2, CheckCircle2, Clock3, CalendarDays, Send, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getApiErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';

type HallBooking = {
  id: number;
  event_name: string;
  department?: string;
  expected_participants?: number | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  hall?: number;
  hall_details?: {
    hall_name: string;
  };
};

type Hall = {
  id: number;
  hall_name: string;
  capacity: number;
  location: string;
};

type HallSlot = {
  id: number;
  hall: number;
  start_time: string;
  end_time: string;
  status: string;
};

type HallEquipment = {
  id: number;
  name: string;
};

type DashboardPayload = {
  bookings_today_count: number;
  pending_requests_count: number;
  available_halls_count: number;
  hall_utilization_percent: number;
  today_bookings: HallBooking[];
  upcoming_bookings: HallBooking[];
  pending_approvals: HallBooking[];
};

type CalendarPayload = {
  date: string;
  schedule: Record<string, Array<{
    id: number;
    event_name: string;
    department: string;
    start_time: string;
    end_time: string;
    status: string;
    requester_name: string;
  }>>;
};

const APPROVER_ROLES = new Set(['admin', 'super_admin', 'principal', 'director']);

export default function HallBookingPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isApprover = APPROVER_ROLES.has((user?.role || '').toLowerCase());

  const [calendarDate, setCalendarDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({
    event_name: '',
    department: user?.department || '',
    expected_participants: '',
    hall: '',
    booking_date: new Date().toISOString().slice(0, 10),
    slot: '',
    description: '',
  });
  const [selectedEquipment, setSelectedEquipment] = useState<number[]>([]);

  const { data, isLoading } = useQuery<DashboardPayload>({
    queryKey: ['hall-booking-dashboard'],
    queryFn: async () => {
      const res = await api.get('/hall-booking/bookings/dashboard/');
      return res.data as DashboardPayload;
    },
    staleTime: 60_000,
  });

  const { data: halls = [] } = useQuery<Hall[]>({
    queryKey: ['hall-booking-halls'],
    queryFn: async () => {
      const res = await api.get('/hall-booking/halls/');
      return (res.data.results || res.data) as Hall[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: allSlots = [] } = useQuery<HallSlot[]>({
    queryKey: ['hall-booking-slots'],
    queryFn: async () => {
      const res = await api.get('/hall-booking/slots/');
      return (res.data.results || res.data) as HallSlot[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: equipment = [] } = useQuery<HallEquipment[]>({
    queryKey: ['hall-booking-equipment'],
    queryFn: async () => {
      const res = await api.get('/hall-booking/equipment/');
      return (res.data.results || res.data) as HallEquipment[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: calendarData } = useQuery<CalendarPayload>({
    queryKey: ['hall-booking-calendar', calendarDate],
    queryFn: async () => {
      const res = await api.get('/hall-booking/bookings/calendar/', { params: { date: calendarDate } });
      return res.data as CalendarPayload;
    },
    staleTime: 60_000,
  });

  const requestMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        event_name: form.event_name,
        department: form.department,
        expected_participants: form.expected_participants ? Number(form.expected_participants) : null,
        hall: Number(form.hall),
        booking_date: form.booking_date,
        slot: Number(form.slot),
        description: form.description,
        requested_equipment: selectedEquipment,
      };
      return api.post('/hall-booking/bookings/', payload);
    },
    onSuccess: () => {
      toast.success('Hall booking request submitted');
      setForm((prev) => ({
        ...prev,
        event_name: '',
        expected_participants: '',
        description: '',
      }));
      setSelectedEquipment([]);
      queryClient.invalidateQueries({ queryKey: ['hall-booking-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['hall-booking-calendar'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to submit hall booking request'));
    },
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ id, action, review_note }: { id: number; action: 'approve' | 'reject'; review_note?: string }) => {
      return api.post(`/hall-booking/bookings/${id}/${action}/`, { review_note: review_note || '' });
    },
    onSuccess: () => {
      toast.success('Booking updated');
      queryClient.invalidateQueries({ queryKey: ['hall-booking-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['hall-booking-calendar'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to update booking'));
    },
  });

  const availableSlots = useMemo(() => {
    if (!form.hall) return [];
    return allSlots.filter((s) => s.hall === Number(form.hall) && s.status === 'open');
  }, [allSlots, form.hall]);

  const today = data?.today_bookings || [];
  const upcoming = data?.upcoming_bookings || [];
  const pending = data?.pending_approvals || [];

  const renderRows = (rows: HallBooking[], loading: boolean) => (
    <div className="space-y-3">
      {loading ? (
        <>
          <div className="h-16 w-full rounded-sm bg-slate-100 animate-pulse" />
          <div className="h-16 w-full rounded-sm bg-slate-100/50 animate-pulse" />
        </>
      ) : (
        rows.map((item) => (
          <div key={item.id} className="rounded-sm border border-border/60 p-4 bg-white/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-900">{item.event_name}</p>
                <p className="text-xs font-semibold text-muted-foreground">
                  {item.booking_date} • {item.start_time} - {item.end_time}
                </p>
              </div>
              <Badge variant="outline" className="uppercase text-[10px] tracking-widest font-black">
                {item.status}
              </Badge>
            </div>
          </div>
        ))
      )}
      {!loading && rows.length === 0 && (
        <div className="rounded-sm border border-dashed p-6 text-xs text-muted-foreground font-bold text-center">
          No records
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="rounded-sm border-0 shadow-sm bg-primary/10">
        <CardHeader>
          <CardTitle className="text-xl font-black text-primary flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Hall Booking
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-sm bg-white p-4 border border-border/40">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Today</p>
            {isLoading ? <div className="h-8 w-12 bg-slate-100 animate-pulse mt-1 rounded-sm" /> : <p className="text-2xl font-black text-slate-900 mt-1">{data?.bookings_today_count ?? today.length}</p>}
          </div>
          <div className="rounded-sm bg-white p-4 border border-border/40">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pending Requests</p>
            {isLoading ? <div className="h-8 w-12 bg-slate-100 animate-pulse mt-1 rounded-sm" /> : <p className="text-2xl font-black text-slate-900 mt-1">{data?.pending_requests_count ?? pending.length}</p>}
          </div>
          <div className="rounded-sm bg-white p-4 border border-border/40">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Available Halls</p>
            {isLoading ? <div className="h-8 w-12 bg-slate-100 animate-pulse mt-1 rounded-sm" /> : <p className="text-2xl font-black text-slate-900 mt-1">{data?.available_halls_count ?? 0}</p>}
            {isLoading ? <div className="h-3 w-20 bg-slate-100 animate-pulse mt-1 rounded-sm" /> : <p className="text-[10px] font-bold text-muted-foreground mt-1">Utilization: {data?.hall_utilization_percent ?? 0}%</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-sm border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <Send className="h-4 w-4" /> Request Hall Booking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Event Title</Label>
              <Input
                value={form.event_name}
                onChange={(e) => setForm((prev) => ({ ...prev, event_name: e.target.value }))}
                placeholder="AI Workshop"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input
                value={form.department}
                onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
                placeholder="CSE"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expected Participants</Label>
              <Input
                type="number"
                value={form.expected_participants}
                onChange={(e) => setForm((prev) => ({ ...prev, expected_participants: e.target.value }))}
                placeholder="120"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.booking_date}
                onChange={(e) => setForm((prev) => ({ ...prev, booking_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hall</Label>
              <select
                className="h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
                value={form.hall}
                onChange={(e) => setForm((prev) => ({ ...prev, hall: e.target.value, slot: '' }))}
              >
                <option value="">Select hall</option>
                {halls.map((hall) => (
                  <option key={hall.id} value={hall.id}>
                    {hall.hall_name} ({hall.capacity})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Time Slot</Label>
              <select
                className="h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
                value={form.slot}
                onChange={(e) => setForm((prev) => ({ ...prev, slot: e.target.value }))}
              >
                <option value="">Select slot</option>
                {availableSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.start_time} - {slot.end_time}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Purpose of the event"
            />
          </div>

          {equipment.length > 0 && (
            <div className="space-y-2">
              <Label>Required Equipment</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {equipment.map((item) => {
                  const selected = selectedEquipment.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`rounded-sm border px-3 py-2 text-xs font-bold ${selected ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-border text-muted-foreground'}`}
                      onClick={() => {
                        setSelectedEquipment((prev) =>
                          prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                        );
                      }}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending || !form.event_name || !form.hall || !form.slot || !form.booking_date}
              className="font-black"
            >
              Submit Request
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-sm border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Hall Calendar View
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs">
            <Input type="date" value={calendarDate} onChange={(e) => setCalendarDate(e.target.value)} />
          </div>
          <div className="space-y-4">
            {Object.entries(calendarData?.schedule || {}).map(([hallName, events]) => (
              <div key={hallName} className="rounded-sm border p-4 space-y-2">
                <p className="font-black text-slate-900">{hallName}</p>
                {events.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No bookings</p>
                ) : (
                  events.map((entry) => (
                    <div key={entry.id} className="text-xs font-medium text-muted-foreground flex items-center justify-between gap-2">
                      <span>
                        {entry.start_time} - {entry.end_time} → {entry.event_name}
                      </span>
                      <Badge variant="outline" className="uppercase text-[10px] tracking-widest font-black">
                        {entry.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            ))}
            {Object.keys(calendarData?.schedule || {}).length === 0 && (
              <div className="rounded-sm border border-dashed p-6 text-xs text-muted-foreground font-bold text-center">
                No calendar entries for selected date
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-sm border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Today Bookings
          </CardTitle>
        </CardHeader>
        <CardContent>{renderRows(today, isLoading)}</CardContent>
      </Card>

      <Card className="rounded-sm border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <Clock3 className="h-4 w-4" /> Upcoming Bookings
          </CardTitle>
        </CardHeader>
        <CardContent>{renderRows(upcoming, isLoading)}</CardContent>
      </Card>

      <Card className="rounded-sm border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Pending Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isApprover ? (
            <div className="space-y-3">
              {pending.map((item) => (
                <div key={item.id} className="rounded-sm border border-border/60 p-4 bg-white/70 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">{item.event_name}</p>
                      <p className="text-xs font-semibold text-muted-foreground">
                        {item.booking_date} • {item.start_time} - {item.end_time}
                      </p>
                    </div>
                    <Badge variant="outline" className="uppercase text-[10px] tracking-widest font-black">
                      {item.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      size="sm"
                      className="h-8 px-3"
                      disabled={approvalMutation.isPending}
                      onClick={() => approvalMutation.mutate({ id: item.id, action: 'approve' })}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-red-600 border-red-300 hover:bg-red-50"
                      disabled={approvalMutation.isPending}
                      onClick={() => approvalMutation.mutate({ id: item.id, action: 'reject' })}
                    >
                      <XCircle className="h-3 w-3 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
              {pending.length === 0 && (
                <div className="rounded-sm border border-dashed p-6 text-xs text-muted-foreground font-bold text-center">
                  No pending approvals
                </div>
              )}
            </div>
          ) : (
            renderRows(pending, isLoading)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
