
import { useQuery, useQueryClient as useQC } from '@tanstack/react-query';
import { memo } from 'react';
import { 
  Clock, 
  QrCode, 
  ArrowRight,
  TrendingUp,
  ChefHat,
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
import { FeedbackRequestCard } from './FeedbackRequestCard';
import type { GatePass, Notification } from '@/types';

export const StudentDashboard = memo(function StudentDashboard() {
  const user = useAuthStore((state) => state.user);
  const monthKey = format(new Date(), 'yyyy-MM');
  const queryClient = useQC();

  // Keep key student widgets fresh without manual refresh.
  useRealtimeQuery('gatepass_created', ['student-gate-passes', 'gate-passes', 'student-bundle']);
  useRealtimeQuery('gatepass_updated', ['student-gate-passes', 'gate-passes', 'student-bundle']);
  useRealtimeQuery('gate_scan_logged', ['gate-passes', 'student-bundle']);
  useRealtimeQuery('attendance_updated', ['attendance', 'student-bundle']);
  useRealtimeQuery('notifications_updated', ['notifications', 'notifications-unread-count', 'student-bundle']);
  useRealtimeQuery('notification', ['notifications', 'notifications-unread-count', 'student-bundle']);

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

  // ── SINGLE BATCHED FETCH ──
  // Replaces 6 individual API calls: gate-passes, attendance/today,
  // attendance/monthly, last_scan, notifications, advanced-dashboard
  const { data: bundle, isLoading: bundleLoading, isError: bundleError } = useQuery({
    queryKey: ['student-bundle', user?.id],
    enabled: !!user?.id && user?.role === 'student',
    queryFn: async () => {
      const { data } = await api.get('/metrics/student-bundle/');
      // Seed individual query caches so WebSocket invalidation still works
      queryClient.setQueryData(['student-gate-passes', user?.id], data.gate_passes);
      queryClient.setQueryData(['attendance', 'today'], data.attendance_today);
      queryClient.setQueryData(['attendance', 'monthly-summary', user?.id, monthKey], data.monthly_attendance);
      queryClient.setQueryData(['gate-passes', 'last-scan'], data.last_scan);
      queryClient.setQueryData(['notifications'], data.notifications);
      queryClient.setQueryData(['student-advanced-stats', user?.id], data.advanced_stats);
      return data;
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Extract from bundle (fallback to individual query cache for partial invalidation)
  const gatePassSummary = bundle?.gate_passes as { count: number; recent: GatePass[] } | undefined;
  const gatePassSummaryLoading = bundleLoading;
  const todayAttendance = bundle?.attendance_today;
  const monthlyAttendance = bundle?.monthly_attendance as { month: string; total_days: number; status_breakdown: Record<string, number> } | undefined;
  const lastScan = bundle?.last_scan as { id: number; direction: 'in' | 'out'; scan_time: string; location: string } | null | undefined;
  const notifications = bundle?.notifications;
  const advancedStats = bundle?.advanced_stats;

  const presentDays = monthlyAttendance?.status_breakdown?.present ?? 0;
  const totalRecordedDays = monthlyAttendance?.total_days ?? 0;
  const attendancePct = totalRecordedDays ? (presentDays / totalRecordedDays) * 100 : 0;

  if (bundleError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="p-4 bg-red-50 text-red-500 rounded-full">
          <Clock className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-lg font-bold">Failed to load dashboard</h3>
          <p className="text-sm text-muted-foreground">Please check your connection and try again.</p>
        </div>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['student-bundle'] })}>
          Retry Loading
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-20 lg:pb-0">
      <div className="lg:col-span-2 space-y-5 sm:space-y-6">
        {/* Skeleton loading state for initial bundle fetch */}
        {bundleLoading && !bundle && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Pass card skeleton */}
            <Card className="rounded-3xl border-0 shadow-sm">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-14 w-14 rounded-2xl" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-24 rounded-full" />
                    <Skeleton className="h-6 w-48" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-16 rounded-2xl" />
                  <Skeleton className="h-16 rounded-2xl" />
                  <Skeleton className="h-16 rounded-2xl" />
                  <Skeleton className="h-16 rounded-2xl" />
                </div>
              </CardContent>
            </Card>
            {/* Welcome card skeleton */}
            <Skeleton className="h-32 rounded-3xl" />
            {/* Stats grid skeleton */}
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-28 rounded-3xl" />
              <Skeleton className="h-28 rounded-3xl" />
              <Skeleton className="h-28 rounded-3xl" />
              <Skeleton className="h-28 rounded-3xl" />
            </div>
          </div>
        )}

        <FeedbackRequestCard />

        {gatePassSummary?.recent?.find(p => p.status === 'pending' || p.status === 'approved' || p.status === 'used') && (() => {
           const activePass = gatePassSummary.recent.find(p => p.status === 'used') 
             || gatePassSummary.recent.find(p => p.status === 'approved')
             || gatePassSummary.recent.find(p => p.status === 'pending');
           if (!activePass) return null;

           const getTimeRemaining = () => {
             if (!activePass.entry_time || !activePass.exit_date) return null;
             const returnDate = activePass.date_to || activePass.exit_date;
             const returnTime = activePass.entry_time || '23:59';
             const returnDt = new Date(`${returnDate}T${returnTime}:00`);
             const now = new Date();
             const diff = returnDt.getTime() - now.getTime();
             if (diff <= 0) return 'Expired';
             const hours = Math.floor(diff / (1000 * 60 * 60));
             const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
             return `${hours}h ${minutes}m remaining`;
           };

           return (
           <Card className="overflow-hidden border border-primary/20 shadow-sm rounded-3xl bg-primary/5 animate-in slide-in-from-top duration-500">
             <CardContent className="p-0">
               <div className="p-5 sm:p-6 flex flex-col gap-4">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-4">
                     <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0 border border-primary/20">
                       <QrCode className="h-8 w-8 text-primary" />
                     </div>
                     <div>
                       <Badge className="bg-primary/10 text-primary border-primary/20 font-black text-[10px] uppercase tracking-widest px-2 mb-1.5">Active Movement</Badge>
                       <h3 className="text-xl font-black tracking-tight leading-none text-foreground">
                         {activePass.status === 'used' ? 'You are Currently OUT' : 
                          activePass.status === 'approved' ? 'Your Pass is Ready' : 'Pass Pending Review'}
                       </h3>
                     </div>
                   </div>
                   {/* Desktop: link to full page */}
                   <Link to="/gate-passes">
                     <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 rounded-xl">
                       View All <ArrowRight className="ml-1 h-4 w-4" />
                     </Button>
                   </Link>
                 </div>

                 {/* Inline Pass Details (mobile-first, always visible) */}
                 <div className="grid grid-cols-2 gap-3 mt-1">
                   <div className="bg-white/60 dark:bg-white/5 rounded-2xl p-3 border border-border/30">
                     <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Type</p>
                     <p className="text-sm font-bold capitalize">{activePass.pass_type || activePass.type || 'Day'}</p>
                   </div>
                   <div className="bg-white/60 dark:bg-white/5 rounded-2xl p-3 border border-border/30">
                     <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Status</p>
                     <Badge variant="outline" className={
                       activePass.status === 'approved' ? 'bg-primary/20 text-black font-bold border-primary/30' :
                       activePass.status === 'used' ? 'bg-emerald-100 text-emerald-700 font-bold border-emerald-200' :
                       'bg-secondary text-black font-bold border-border'
                     }>
                       {activePass.status.charAt(0).toUpperCase() + activePass.status.slice(1)}
                     </Badge>
                   </div>
                   <div className="bg-white/60 dark:bg-white/5 rounded-2xl p-3 border border-border/30">
                     <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Exit</p>
                     <p className="text-sm font-bold">{formatDateTime(activePass.exit_date || activePass.date_from, activePass.exit_time)}</p>
                   </div>
                   <div className="bg-white/60 dark:bg-white/5 rounded-2xl p-3 border border-border/30">
                     <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Return</p>
                     <p className="text-sm font-bold">{formatDateTime(activePass.date_to || activePass.exit_date, activePass.entry_time || undefined)}</p>
                   </div>
                   {activePass.destination && (
                     <div className="col-span-2 bg-white/60 dark:bg-white/5 rounded-2xl p-3 border border-border/30">
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Destination</p>
                       <p className="text-sm font-bold">{activePass.destination}</p>
                     </div>
                   )}
                 </div>

                 {/* Time Remaining + Approved At */}
                 <div className="flex items-center justify-between bg-primary/10 rounded-2xl p-3 border border-primary/15">
                   <div>
                     <p className="text-[10px] font-black text-primary uppercase tracking-widest">Approved</p>
                     <p className="text-xs font-bold text-foreground">{activePass.updated_at ? new Date(activePass.updated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</p>
                   </div>
                   {getTimeRemaining() && (
                     <div className="text-right">
                       <p className="text-[10px] font-black text-primary uppercase tracking-widest">Time Left</p>
                       <p className="text-sm font-black text-foreground">{getTimeRemaining()}</p>
                     </div>
                   )}
                 </div>
               </div>
             </CardContent>
           </Card>
           );
         })()}

        {/* Welcome Section - Brand Color Card */}
        <Card className="bg-primary/10 border border-primary/20 rounded-2xl md:rounded-3xl text-primary shadow-sm">
          <div className="relative z-10 p-6">
            <h2 className="text-3xl font-bold mb-2">Hello, {user?.first_name || user?.username || 'Student'}!</h2>
            <p className="text-primary-foreground/90 max-w-sm text-sm sm:text-base mb-6">
              Your attendance status is on track. Don't forget to mark your daily inputs!
            </p>
            <div className="flex gap-3">
              <Link to="/gate-passes" className="flex-1 sm:flex-none">
                <Button variant="secondary" className="w-full sm:w-auto rounded-2xl font-bold h-12 bg-white text-primary hover:bg-white/90 border-0 shadow-sm">
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
        </Card>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card className="rounded-3xl border-0 bg-primary/10 shadow-sm hover:bg-primary/20 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-primary/20 rounded-xl text-foreground">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">Attendance</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {attendancePct.toFixed(0)}<span className="text-sm align-top opacity-60">%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 bg-secondary/50 shadow-sm hover:bg-secondary transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-secondary rounded-xl text-foreground">
                  <Clock className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">Last Scan</span>
              </div>
              <div className="text-lg font-bold text-foreground truncate">
                {lastScan?.scan_time 
                  ? new Date(lastScan.scan_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                  : 'No Scans'}
              </div>
              {lastScan && (
                <div className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate mt-0.5">
                   {lastScan.direction === 'out' ? 'Checked Out' : 'Checked In'} • {lastScan.location || 'Gate'}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 bg-purple-100 shadow-sm hover:bg-purple-200 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <Card className="bg-accent/40 border border-accent/60 rounded-2xl md:rounded-3xl text-foreground shadow-sm p-2.5">
                  <ChefHat className="h-5 w-5" />
                </Card>
                <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">Special Meal</span>
              </div>
              <div className="text-lg font-bold text-purple-900 truncate">
                {advancedStats?.pending_special_requests || 0} Pending
              </div>
              <Link to="/meals" className="text-[10px] text-purple-600 font-bold hover:underline flex items-center gap-1 mt-1">
                 Manage Requests <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Recent Gate Passes */}
        <Card className="bg-muted border border-border rounded-2xl md:rounded-3xl text-foreground shadow-sm">
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
                gatePassSummary.recent.map((pass: GatePass) => (
                  <div key={pass.id} className="flex items-center justify-between p-3 mx-2 hover:bg-stone-50 rounded-2xl transition-colors">
                     <div className="flex items-center gap-4">
                       <div className={`p-2.5 rounded-xl shadow-sm border ${
                         pass.type === 'home_pass' || pass.type === 'day' ? 'bg-primary/20 border-primary/30 text-foreground' : 
                         'bg-primary/10 border-primary/20 text-foreground'
                       }`}>
                          <QrCode className="h-5 w-5" />
                       </div>
                       <div>
                         <div className="font-semibold text-sm text-stone-900">{(pass.type === 'day' || pass.pass_type === 'day') ? 'Day Visit' : 'Outing'}</div>
                         <div className="text-xs text-stone-500 font-medium">{formatDateTime(pass.exit_date || pass.date_to, pass.exit_time)}</div>
                       </div>
                     </div>
                     <Badge variant="outline" className={
                       pass.status === 'approved' ? 'bg-primary/20 text-black font-bold border-primary/30' :
                       pass.status === 'pending' ? 'bg-secondary text-black font-bold border-border' :
                       pass.status === 'rejected' ? 'bg-black text-white font-bold' :
                       'bg-muted text-black border-border'
                     }>
                       {pass.status.charAt(0).toUpperCase() + pass.status.slice(1)}
                     </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm bg-stone-50/50 m-4 rounded-2xl border border-dashed border-stone-200">
                  No recent gate passes
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {/* Today's Context Card */}
        <Card className="rounded-3xl border border-stone-100 shadow-sm overflow-hidden bg-white">
           <CardContent className="p-0">
              <div className="p-5 bg-muted/80 text-foreground border-b border-border/10">
                <div className="flex justify-between items-start mb-4"> 
                  <div>
                     <h3 className="font-bold text-lg">Today's Focus</h3>
                     <p className="text-stone-400 text-xs">{format(new Date(), 'EEEE, MMMM do')}</p>
                  </div>
                  <ChefHat className="h-5 w-5 text-primary" />
                </div>
                
                <div className="flex justify-between items-center p-3 rounded-2xl bg-primary/10 border border-primary/10 mb-2">
                  <span className="text-sm font-medium text-muted-foreground">Next Meal</span>
                  <span className="text-sm font-bold text-primary">{bundle?.next_meal?.meal_type || getNextMeal().split('(')[0]}</span>
                </div>
                 <div className="flex justify-between items-center p-3 rounded-2xl bg-secondary/30 border border-border/10">
                  <span className="text-sm font-medium text-muted-foreground">Attendance</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    todayAttendance?.status === 'present' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-black/10 text-white'
                  }`}>
                    {todayAttendance?.status?.toUpperCase() || 'NOT MARKED'}
                  </span>
                </div>
              </div>

              <div className="p-5">
                <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-3">Live Alerts</p>
                {notifications && notifications.length > 0 ? (
                  <div className="space-y-3">
                    {notifications.map((notif: Notification) => (
                       <div key={notif.id} className="flex gap-3 text-sm">
                         <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                         <p className="text-stone-600 text-xs leading-relaxed">{notif.message}</p>
                       </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400 italic">No new alerts</p>
                )}
              </div>
           </CardContent>
        </Card>
      </div>
    </div>
  );
});
