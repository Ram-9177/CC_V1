import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Building2, CheckCircle2, Clock3 } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BrandedLoading } from '@/components/common/BrandedLoading';
import { getApiErrorMessage } from '@/lib/utils';

type HallBooking = {
  id: number;
  event_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  hall_name?: string;
};

type DashboardPayload = {
  today_bookings: HallBooking[];
  upcoming_bookings: HallBooking[];
  pending_approvals: HallBooking[];
};

export default function HallBookingPage() {
  const { data, isLoading, error } = useQuery<DashboardPayload>({
    queryKey: ['hall-booking-dashboard'],
    queryFn: async () => {
      const res = await api.get('/hall-booking/bookings/dashboard/');
      return res.data as DashboardPayload;
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return <BrandedLoading message="Loading hall booking dashboard..." />;
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6 text-sm text-red-600 font-bold">
            {getApiErrorMessage(error, 'Failed to load hall booking dashboard')}
          </CardContent>
        </Card>
      </div>
    );
  }

  const today = data?.today_bookings || [];
  const upcoming = data?.upcoming_bookings || [];
  const pending = data?.pending_approvals || [];

  const renderRows = (rows: HallBooking[]) => (
    <div className="space-y-3">
      {rows.map((item) => (
        <div key={item.id} className="rounded-2xl border border-border/60 p-4 bg-white/70">
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
      ))}
      {rows.length === 0 && (
        <div className="rounded-2xl border border-dashed p-6 text-xs text-muted-foreground font-bold text-center">
          No records
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-0 shadow-sm bg-primary/10">
        <CardHeader>
          <CardTitle className="text-xl font-black text-primary flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Hall Booking
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white p-4 border border-border/40">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Today</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{today.length}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 border border-border/40">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Upcoming</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{upcoming.length}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 border border-border/40">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pending Approval</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{pending.length}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Today Bookings
          </CardTitle>
        </CardHeader>
        <CardContent>{renderRows(today)}</CardContent>
      </Card>

      <Card className="rounded-3xl border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <Clock3 className="h-4 w-4" /> Upcoming Bookings
          </CardTitle>
        </CardHeader>
        <CardContent>{renderRows(upcoming)}</CardContent>
      </Card>

      <Card className="rounded-3xl border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Pending Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>{renderRows(pending)}</CardContent>
      </Card>
    </div>
  );
}
