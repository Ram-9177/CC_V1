
import { useQuery } from '@tanstack/react-query';
import { 
  Clock, 
  QrCode, 
  ArrowRight,
  TrendingUp,
  ChefHat,
  Bed
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { format } from 'date-fns';
import { useRealtimeQuery } from '@/hooks/useWebSocket';

export function StudentDashboard() {
  const user = useAuthStore((state) => state.user);
  const monthKey = format(new Date(), 'yyyy-MM');

  // Keep key student widgets fresh without manual refresh.
  useRealtimeQuery('gatepass_updated', ['student-gate-passes', 'gate-passes']);
  useRealtimeQuery('gate_scan_logged', 'gate-passes');
  useRealtimeQuery('attendance_updated', 'attendance');
  useRealtimeQuery('room_allocated', 'student-room-allocation');
  useRealtimeQuery('room_deallocated', 'student-room-allocation');
  useRealtimeQuery('room_moved', 'student-room-allocation');

  const getNextMeal = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const schedule = [
      { label: 'Breakfast', at: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0, 0, 0) },
      { label: 'Lunch', at: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 0, 0, 0) },
      { label: 'Dinner', at: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0, 0, 0) },
    ];

    const next =
      schedule.find((slot) => now < slot.at) ??
      { label: 'Breakfast', at: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 8, 0, 0, 0) };

    return `${next.label} (${next.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
  };

  const formatDateTime = (dateStr?: string, timeStr?: string) => {
    if (!dateStr) return '';
    if (!timeStr) return format(new Date(dateStr), 'PPP');
    const dt = new Date(`${dateStr}T${timeStr}:00`);
    if (Number.isNaN(dt.getTime())) return dateStr;
    return format(dt, 'PPP · p');
  };

  const { data: gatePassSummary, isLoading: gatePassSummaryLoading } = useQuery<{
    count: number;
    recent: any[];
  }>({
    queryKey: ['student-gate-passes', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const response = await api.get('/gate-passes/', { params: { page_size: 3 } });
      const data = response.data;

      // Non-paginated fallback
      if (Array.isArray(data)) {
        return { count: data.length, recent: data.slice(0, 3) };
      }

      const results = Array.isArray(data?.results) ? data.results : [];
      const count = typeof data?.count === 'number' ? data.count : results.length;
      return { count, recent: results.slice(0, 3) };
    },
  });

  const { data: todayAttendance } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: async () => {
      try {
        const response = await api.get('/attendance/today/');
        return response.data;
      } catch {
        return null;
      }
    }
  });

  const { data: monthlyAttendance } = useQuery<{
    month: string;
    total_days: number;
    status_breakdown: Record<string, number>;
  }>({
    queryKey: ['attendance', 'monthly-summary', user?.id, monthKey],
    enabled: !!user?.id,
    queryFn: async () => {
      const response = await api.get('/attendance/monthly_summary/', {
        params: { user_id: user?.id, month: monthKey },
      });
      return response.data;
    },
  });

  const { data: lastScan } = useQuery<{
    id: number;
    direction: 'in' | 'out';
    scan_time: string;
    location: string;
  } | null>({
    queryKey: ['gate-passes', 'last-scan'],
    queryFn: async () => {
      try {
        const response = await api.get('/gate-passes/last_scan/');
        return response.data;
      } catch {
        return null;
      }
    },
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      // Notifications are namespaced under /notifications/notifications/
      const response = await api.get('/notifications/notifications/');
      return response.data.results?.slice(0, 3) || response.data.slice(0, 3);
    }
  });

  const { data: myAllocation } = useQuery<{
    id: number;
    allocated_date: string;
    room: {
      id: number;
      room_number: string;
      floor: number;
      building: { id: number | null; code: string | null; name: string | null };
    };
    bed: { id: number | null; bed_number: string | null };
  } | null>({
    queryKey: ['student-room-allocation', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      try {
        const response = await api.get('/rooms/allocations/my_active/');
        return response.data ?? null;
      } catch {
        return null;
      }
    },
  });

  const presentDays = monthlyAttendance?.status_breakdown?.present ?? 0;
  const totalRecordedDays = monthlyAttendance?.total_days ?? 0;
  const attendancePct = totalRecordedDays ? (presentDays / totalRecordedDays) * 100 : 0;


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-20 lg:pb-0">
      <div className="lg:col-span-2 space-y-4">
        {/* Welcome Section - Brand Color Card */}
        <div className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground p-6 shadow-lg shadow-primary/20">
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-2">Hello, {user?.first_name || 'Student'}!</h2>
            <p className="text-primary-foreground/90 max-w-sm text-sm sm:text-base mb-6">
              Your attendance status is on track. Don't forget to mark your daily inputs!
            </p>
            <div className="flex gap-3">
              <Link to="/gate-passes" className="flex-1 sm:flex-none">
                <Button variant="secondary" className="w-full sm:w-auto rounded-2xl font-bold h-12 text-primary hover:bg-white/90">
                  Request Pass
                </Button>
              </Link>
              <Link to="/meals" className="flex-1 sm:flex-none">
                <Button className="w-full sm:w-auto rounded-2xl font-bold h-12 bg-black/20 text-white hover:bg-black/30 border-0 backdrop-blur-sm">
                  Meal Menu
                </Button>
              </Link>
            </div>
          </div>
          {/* Decorative Circle */}
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-black/5 rounded-full blur-2xl" />
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="rounded-3xl border-0 bg-orange-50/50 shadow-sm hover:bg-orange-50 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-orange-100 rounded-xl text-orange-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-orange-900/60 uppercase tracking-wide">Attendance</span>
              </div>
              <div className="text-2xl font-bold text-orange-950">
                {attendancePct.toFixed(0)}<span className="text-sm align-top opacity-60">%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 bg-blue-50/50 shadow-sm hover:bg-blue-50 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-blue-100 rounded-xl text-blue-600">
                  <Clock className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-blue-900/60 uppercase tracking-wide">Last Scan</span>
              </div>
              <div className="text-lg font-bold text-blue-950 truncate">
                {lastScan?.scan_time 
                  ? new Date(lastScan.scan_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                  : 'No Scans'}
              </div>
              {lastScan && (
                <div className="text-[10px] sm:text-xs text-blue-800/60 font-medium truncate mt-0.5">
                   {lastScan.direction === 'out' ? 'Checked Out' : 'Checked In'} • {lastScan.location || 'Gate'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Gate Passes */}
        <Card className="rounded-3xl border border-slate-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
             <div className="space-y-1">
               <CardTitle className="text-lg font-bold">Gate Passes</CardTitle>
               <CardDescription>Recent history</CardDescription>
             </div>
             <Link to="/gate-passes">
               <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 rounded-xl">
                 View All <ArrowRight className="ml-1 h-4 w-4" />
               </Button>
             </Link>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <div className="space-y-1 px-2">
              {gatePassSummaryLoading ? (
                 // Skeletons
                 Array.from({ length: 3 }).map((_, i) => (
                   <div key={i} className="flex items-center gap-4 p-3 mx-2">
                     <Skeleton className="h-10 w-10 rounded-xl" />
                     <div className="space-y-2 flex-1">
                       <Skeleton className="h-4 w-24" />
                       <Skeleton className="h-3 w-16" />
                     </div>
                     <Skeleton className="h-6 w-16 rounded-full" />
                   </div>
                 ))
              ) : gatePassSummary?.recent?.length > 0 ? (
                gatePassSummary.recent.map((pass: any) => (
                  <div key={pass.id} className="flex items-center justify-between p-3 mx-2 hover:bg-slate-50 rounded-2xl transition-colors">
                     <div className="flex items-center gap-4">
                       <div className={`p-2.5 rounded-xl shadow-sm border ${
                         pass.pass_type === 'home_pass' ? 'bg-purple-50 border-purple-100 text-purple-600' : 
                         'bg-sky-50 border-sky-100 text-sky-600'
                       }`}>
                          <QrCode className="h-5 w-5" />
                       </div>
                       <div>
                         <div className="font-semibold text-sm text-slate-900">{pass.pass_type === 'home_pass' ? 'Home Visit' : 'Outing'}</div>
                         <div className="text-xs text-slate-500 font-medium">{formatDateTime(pass.exit_date, pass.exit_time)}</div>
                       </div>
                     </div>
                     <Badge variant="outline" className={
                       pass.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                       pass.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                       pass.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                       'bg-slate-100 text-slate-600 border-slate-200'
                     }>
                       {pass.status.charAt(0).toUpperCase() + pass.status.slice(1)}
                     </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm bg-slate-50/50 m-4 rounded-2xl border border-dashed border-slate-200">
                  No recent gate passes
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {/* Today's Context Card */}
        <Card className="rounded-3xl border border-slate-100 shadow-sm overflow-hidden bg-white">
           <CardContent className="p-0">
              <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                <div className="flex justify-between items-start mb-4"> 
                  <div>
                     <h3 className="font-bold text-lg">Today's Focus</h3>
                     <p className="text-slate-400 text-xs">{format(new Date(), 'EEEE, MMMM do')}</p>
                  </div>
                  <ChefHat className="h-5 w-5 text-orange-400" />
                </div>
                
                <div className="flex justify-between items-center p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/5 mb-2">
                  <span className="text-sm font-medium text-slate-200">Next Meal</span>
                  <span className="text-sm font-bold text-orange-300">{getNextMeal().split('(')[0]}</span>
                </div>
                 <div className="flex justify-between items-center p-3 rounded-2xl bg-white/5 border border-white/5">
                  <span className="text-sm font-medium text-slate-200">Attendance</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    todayAttendance?.status === 'present' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white'
                  }`}>
                    {todayAttendance?.status?.toUpperCase() || 'NOT MARKED'}
                  </span>
                </div>
              </div>

              <div className="p-5">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-3">Live Alerts</p>
                {notifications && notifications.length > 0 ? (
                  <div className="space-y-3">
                    {notifications.map((notif: any) => (
                       <div key={notif.id} className="flex gap-3 text-sm">
                         <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                         <p className="text-slate-600 text-xs leading-relaxed">{notif.message}</p>
                       </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No new alerts</p>
                )}
              </div>
           </CardContent>
        </Card>

        {/* My Room / Bed */}
        <Card className="rounded-3xl border border-slate-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Bed className="h-4 w-4 text-slate-400" />
              Allocation
            </CardTitle>
            {myAllocation ? (
               <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Active</Badge> 
            ) : (
               <Badge variant="outline" className="text-xs">Pending</Badge>
            )}
          </CardHeader>
          <CardContent>
            {myAllocation ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Room</div>
                  <div className="text-lg font-bold text-slate-800">{myAllocation.room.room_number}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Bed</div>
                  <div className="text-lg font-bold text-slate-800">{myAllocation.bed?.bed_number || '-'}</div>
                </div>
              </div>
            ) : (
               <div className="text-center py-6 text-slate-400 text-xs">
                 No room allocated yet.
               </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
