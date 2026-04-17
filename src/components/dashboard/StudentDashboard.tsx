import { safeLazy } from "@/lib/safeLazy";

import { useQuery, useMutation, useQueryClient as useQC } from '@tanstack/react-query';
import { memo, useState, useCallback, useMemo } from 'react';
import { 
  Clock, 
  QrCode, 
  ArrowRight,
  ChefHat,
  Calendar,
  MapPin,
  Info,
  CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { format, formatDistanceToNow } from 'date-fns';
import { useRealtimeQuery, useWebSocketEvent } from '@/hooks/useWebSocket';
import { cn } from '@/lib/utils';
import type { GatePass, Notification } from '@/types';
import { getStudentName } from '@/lib/student';
import { HostellerOnly } from '@/hooks/useStudentType';
import { toast } from 'sonner';
import { Suspense } from 'react';

// Start downloading child chunks immediately to prevent cascading Suspense waterfalls, while keeping safeLazy protection
const _trackerPromise = import('./StudentLifecycleTracker').then(m => ({ default: m.StudentLifecycleTracker }));
const _feedbackPromise = import('./FeedbackRequestCard').then(m => ({ default: m.FeedbackRequestCard }));
const _diningPromise = import('@/components/meals/DiningCountdown').then(m => ({ default: m.DiningCountdown }));

const StudentLifecycleTracker = safeLazy(() => _trackerPromise);
const FeedbackRequestCard = safeLazy(() => _feedbackPromise);
const DiningCountdown = safeLazy(() => _diningPromise);

interface StudentBundle {
  gate_passes: {
    count: number;
    recent: GatePass[];
  };
  attendance_today: {
    status: 'present' | 'absent' | 'late' | 'not_marked';
    marked_at?: string;
  } | null;
  monthly_attendance: {
    present: number;
    absent: number;
    total: number;
    percentage: number;
  };
  last_scan: {
    id: number;
    direction: 'in' | 'out';
    scan_time: string;
    location: string;
  } | null;
  notifications: Notification[];
  advanced_stats: {
    pending_special_requests: number;
    approved_special_requests: number;
    active_gate_passes: number;
  };
}

export const StudentDashboard = memo(function StudentDashboard() {
  const user = useAuthStore((state) => state.user);
  const monthKey = format(new Date(), 'yyyy-MM');
  const queryClient = useQC();
  const [selectedPass, setSelectedPass] = useState<GatePass | null>(null);

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await api.delete('/notifications/clear_all/');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['student-bundle', user?.id] });
      toast.success('Live alerts cleared');
    },
    onError: () => {
      toast.error('Failed to clear live alerts');
    }
  });

  // Keep key student widgets fresh without manual refresh.
  useRealtimeQuery('gatepass_created', ['student-gate-passes', 'gate-passes', 'student-bundle']);
  useRealtimeQuery('gatepass_updated', ['student-gate-passes', 'gate-passes', 'student-bundle']);
  useRealtimeQuery('gate_scan_logged', ['gate-passes', 'student-bundle']);
  useRealtimeQuery('attendance_updated', ['attendance', 'student-bundle']);
  useRealtimeQuery('notifications_updated', ['notifications', 'notifications-unread-count', 'student-bundle']);
  useRealtimeQuery('notification', ['notifications', 'notifications-unread-count', 'student-bundle']);

  // Truly Instant UI Patching
  useWebSocketEvent('gatepass_updated', (data: { id: number; status: string }) => {
    // Patch the local cache for immediate feedback
    queryClient.setQueryData(['student-bundle', user?.id], (old: StudentBundle | undefined) => {
      if (!old || !old.gate_passes || !old.gate_passes.recent) return old;
      const updatedPasses = old.gate_passes.recent.map((p: GatePass) => 
        p.id === data.id ? { ...p, ...data } : p
      );
      return {
        ...old,
        gate_passes: {
          ...old.gate_passes,
          recent: updatedPasses
        }
      };
    });
    
    // Also invalidate for complete sync
    queryClient.invalidateQueries({ queryKey: ['student-bundle', user?.id] });
  });

  useWebSocketEvent('gatepass_created', () => {
     queryClient.invalidateQueries({ queryKey: ['student-bundle', user?.id] });
  });

  const formatDateTime = useCallback((dateStr?: string, timeStr?: string) => {
    if (!dateStr) return '';
    if (!timeStr) return format(new Date(dateStr), 'PPP');
    const dt = new Date(`${dateStr}T${timeStr}:00`);
    if (Number.isNaN(dt.getTime())) return dateStr;
    return format(dt, 'PPP · p');
  }, []);

  // ── SINGLE BATCHED FETCH ──
  const { data: bundle, isLoading: bundleLoading, isError: bundleError } = useQuery({
    queryKey: ['student-bundle', user?.id],
    enabled: !!user?.id && user?.role === 'student',
    queryFn: async () => {
      const { data } = await api.get('/metrics/student-bundle/');
      // Seed individual query caches
      queryClient.setQueryData(['student-gate-passes', user?.id], data.gate_passes);
      queryClient.setQueryData(['attendance', 'today'], data.attendance_today);
      queryClient.setQueryData(['attendance', 'monthly-summary', user?.id, monthKey], data.monthly_attendance);
      queryClient.setQueryData(['gate-passes', 'last-scan'], data.last_scan);
      queryClient.setQueryData(['notifications'], data.notifications);
      queryClient.setQueryData(['student-advanced-stats', user?.id], data.advanced_stats);
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (Real-time will invalidate)
    refetchOnWindowFocus: false,
  });

  // Real-time invalidation for student bundle
  useRealtimeQuery(
    ['gate_scan_logged', 'gatepass_updated', 'attendance_updated', 'notification_created'],
    [['student-bundle', user?.id?.toString() || '']]
  );

  const gatePassSummary = bundle?.gate_passes as { count: number; recent: GatePass[] } | undefined;
  const notifications = bundle?.notifications;
  const recentPasses = gatePassSummary?.recent ?? [];

  const activePass = useMemo(() => {
    if (!gatePassSummary?.recent) return null;
    return gatePassSummary.recent.find(p => p.status === 'out') 
           || gatePassSummary.recent.find(p => p.status === 'approved')
           || gatePassSummary.recent.find(p => p.status === 'pending');
  }, [gatePassSummary?.recent]);

  if (bundleError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="p-4 bg-red-50 text-red-500 rounded-sm">
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 pb-20 lg:pb-0">
      <div className="lg:col-span-7 xl:col-span-8 space-y-4 sm:space-y-5 lg:space-y-6">
        <HostellerOnly>
          <Suspense fallback={<Skeleton className="h-20 w-full rounded" />}>
            <FeedbackRequestCard />
          </Suspense>
        </HostellerOnly>

        {/* HERO SECTION */}
        {bundleLoading && !bundle ? (
          <Skeleton className="h-56 sm:h-64 rounded-lg sm:rounded-2xl lg:rounded-xl w-full" />
        ) : (
          <Card className="bg-[#0B0B0C] border-0 rounded-lg sm:rounded-2xl lg:rounded-xl text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10 p-5 sm:p-6 lg:p-8 flex flex-col justify-between min-h-[200px] sm:min-h-[220px]">
              <div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-normal break-words">Hello, {getStudentName(user)}{user?.department ? '.' : '!'}</h2>
                {(user?.department || user?.year) && (
                  <div className="mt-2 flex flex-wrap gap-1 sm:gap-2 opacity-80 text-xs sm:text-sm font-medium">
                    <span className="text-zinc-300">{user?.department}</span>
                    {user?.year && <span className="text-zinc-400">• {user.year}{user.year === 1 ? 'st' : user.year === 2 ? 'nd' : user.year === 3 ? 'rd' : 'th'} Year</span>}
                    {user?.semester && <span className="text-zinc-400">• Sem {user.semester}</span>}
                  </div>
                )}
              </div>

              <div className="mt-6 sm:mt-8">
                {activePass ? (
                  <div className={cn(
                    "p-4 sm:p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-5 backdrop-blur-md shadow-lg transition-all",
                    activePass.status === 'approved' ? "bg-emerald-500/10 border-emerald-500/20" :
                    activePass.status === 'used' ? "bg-purple-500/10 border-purple-500/20" :
                    activePass.status === 'pending' ? "bg-orange-500/10 border-blue-500/20" :
                    "bg-white/5 border-white/10"
                  )}>
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "h-12 w-12 rounded-full flex items-center justify-center shrink-0",
                        activePass.status === 'approved' ? "bg-emerald-500/20 text-emerald-400" :
                        activePass.status === 'used' ? "bg-purple-500/20 text-purple-400" :
                        activePass.status === 'pending' ? "bg-orange-500/20 text-blue-400" :
                        "bg-white/10 text-white"
                      )}>
                        <QrCode className="h-5 sm:h-6 w-5 sm:w-6" />
                      </div>
                      <div className="min-w-0">
                        <p className={cn(
                          "text-[9px] sm:text-[10px] lg:text-xs font-black uppercase tracking-normal mb-1",
                          activePass.status === 'approved' ? "text-emerald-400" :
                          activePass.status === 'used' ? "text-purple-400" :
                          activePass.status === 'pending' ? "text-blue-400" :
                          "text-zinc-400"
                        )}>
                          {activePass.status === 'used' ? 'Currently OUT' : 
                           activePass.status === 'approved' ? 'Pass Approved' : 'Pending Review'}
                        </p>
                        <p className="text-sm sm:text-lg lg:text-xl font-bold text-white leading-tight truncate">
                          {activePass.destination || (activePass.pass_type === 'day' ? 'Day Visit' : 'Outing')}
                        </p>
                      </div>
                    </div>
                    <div className="flex w-full sm:w-auto shrink-0">
                      <Button 
                        variant="secondary" 
                        className={cn(
                          "w-full sm:w-auto font-bold h-10 sm:h-11 px-4 sm:px-6 text-sm shadow-sm border-0 transition-opacity hover:opacity-90",
                          activePass.status === 'approved' ? "bg-emerald-500 text-white" :
                          activePass.status === 'used' ? "bg-purple-500 text-white" :
                          activePass.status === 'pending' ? "bg-orange-500 text-white" :
                          "bg-white text-black"
                        )}
                        onClick={() => setSelectedPass(activePass)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 sm:p-5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md flex flex-col gap-1">
                    <p className="text-zinc-400 text-[10px] sm:text-xs font-bold uppercase tracking-normal">Movement Status</p>
                    <p className="text-base sm:text-lg font-semibold text-white">Currently on Campus</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* QUICK ACTIONS */}
        <div className="pt-2">
          <h3 className="text-[10px] sm:text-xs font-black text-muted-foreground uppercase tracking-normal mb-3 sm:mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <HostellerOnly>
              <Link to="/gate-passes" className="group block focus:outline-none h-full">
                <Card className="h-full border-0 bg-white shadow-sm hover:shadow-md transition-all duration-300 group-hover:-translate-y-1 rounded-lg sm:rounded-2xl overflow-hidden relative">
                  <div className="absolute inset-0 bg-stone-900 opacity-0 group-hover:opacity-5 transition-opacity" />
                  <CardContent className="p-4 sm:p-6 flex flex-col items-center justify-center text-center gap-3 sm:gap-4">
                    <div className="h-12 sm:h-14 w-12 sm:w-14 rounded-lg sm:rounded-2xl bg-stone-100 text-stone-700 flex items-center justify-center group-hover:bg-stone-900 group-hover:text-white transition-colors duration-300">
                      <QrCode className="h-5 sm:h-6 w-5 sm:w-6" />
                    </div>
                    <span className="font-bold text-sm sm:text-base text-stone-900 transition-colors">Request Pass</span>
                  </CardContent>
                </Card>
              </Link>
            </HostellerOnly>

            <Link to="/sports-booking" className="group block focus:outline-none h-full">
              <Card className="h-full border-0 bg-white shadow-sm hover:shadow-md transition-all duration-300 group-hover:-translate-y-1 rounded-lg sm:rounded-2xl overflow-hidden relative">
                <div className="absolute inset-0 bg-orange-600 opacity-0 group-hover:opacity-5 transition-opacity" />
                <CardContent className="p-4 sm:p-6 flex flex-col items-center justify-center text-center gap-3 sm:gap-4">
                  <div className="h-12 sm:h-14 w-12 sm:w-14 rounded-lg sm:rounded-2xl bg-stone-100 text-stone-700 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-colors duration-300">
                    <Calendar className="h-5 sm:h-6 w-5 sm:w-6" />
                  </div>
                  <span className="font-bold text-sm sm:text-base text-stone-900 transition-colors">Book Court</span>
                </CardContent>
              </Card>
            </Link>

            <HostellerOnly>
              <Link to="/meals" className="group block focus:outline-none h-full">
                <Card className="h-full border-0 bg-white shadow-sm hover:shadow-md transition-all duration-300 group-hover:-translate-y-1 rounded-lg sm:rounded-2xl overflow-hidden relative">
                  <div className="absolute inset-0 bg-orange-500 opacity-0 group-hover:opacity-5 transition-opacity" />
                  <CardContent className="p-4 sm:p-6 flex flex-col items-center justify-center text-center gap-3 sm:gap-4">
                    <div className="h-12 sm:h-14 w-12 sm:w-14 rounded-lg sm:rounded-2xl bg-stone-100 text-stone-700 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300">
                      <ChefHat className="h-5 sm:h-6 w-5 sm:w-6" />
                    </div>
                    <span className="font-bold text-sm sm:text-base text-stone-900 transition-colors">Meal Menu</span>
                  </CardContent>
                </Card>
              </Link>
            </HostellerOnly>
          </div>
        </div>

        <Suspense fallback={<Skeleton className="h-40 w-full mb-4 rounded-sm shadow-sm" />}>
          <StudentLifecycleTracker />
        </Suspense>

        <HostellerOnly>
          <Card className="bg-muted border border-border rounded-lg lg:rounded text-stone-900 shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 sm:pb-4 gap-2 sm:gap-0">
               <div className="space-y-1">
                 <CardTitle className="text-base sm:text-lg font-bold">Gate Passes</CardTitle>
                 <CardDescription className="text-xs">Recent history</CardDescription>
               </div>
               <Link to="/gate-passes">
                 <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 rounded-sm text-xs sm:text-sm px-2 sm:px-3">
                   View All <ArrowRight className="ml-1 h-4 w-4" />
                 </Button>
               </Link>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              <div className="space-y-1 px-2">
                {bundleLoading && !bundle ? (
                   <div className="space-y-2 p-3 sm:p-4">
                     <Skeleton className="h-12 w-full rounded-sm" />
                     <Skeleton className="h-12 w-full rounded-sm" />
                   </div>
                ) : recentPasses.length > 0 ? (
                  recentPasses.map((pass: GatePass) => (
                    <div 
                      key={pass.id} 
                      className="flex items-center justify-between gap-2 p-3 mx-2 hover:bg-stone-50 rounded-sm transition-colors cursor-pointer group"
                      onClick={() => setSelectedPass(pass)}
                    >
                       <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                         <div className={`p-2 sm:p-2.5 rounded-sm shadow-sm border transition-transform group-hover:scale-110 ${
                           pass.id === selectedPass?.id ? 'bg-primary text-white border-primary' : 'bg-primary/20 border-primary/30 text-foreground'
                         }`}>
                            <QrCode className="h-4 sm:h-5 w-4 sm:w-5" />
                         </div>
                         <div className="min-w-0">
                           <div className="font-semibold text-xs sm:text-sm text-stone-900 truncate">{(pass.pass_type === 'day') ? 'Day Visit' : 'Outing'}</div>
                           <div className="text-[10px] sm:text-xs text-stone-500 font-medium truncate">{formatDateTime(pass.exit_date, pass.exit_time)}</div>
                         </div>
                       </div>
                       <Badge variant="outline" className={cn(
                         "font-bold uppercase text-[8px] sm:text-[10px] tracking-normal shrink-0",
                         pass.status === 'approved' ? 'bg-primary/20 text-black border-primary/30' :
                         pass.status === 'pending' ? 'bg-secondary text-black border-border' :
                         pass.status === 'rejected' ? 'bg-black text-white' :
                         'bg-muted text-black border-border'
                       )}>
                         {pass.status}
                       </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 sm:py-8 text-muted-foreground text-xs sm:text-sm bg-stone-50/50 m-2 sm:m-4 rounded-sm border border-dashed border-stone-200">
                    No recent gate passes
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </HostellerOnly>
      </div>

      <div className="lg:col-span-5 xl:col-span-4 space-y-4">
        <Card className="rounded border border-stone-100 shadow-sm overflow-hidden bg-white h-fit">
           <CardContent className="p-0">
              <HostellerOnly>
                <div className="p-4 sm:p-5 bg-muted/80 text-foreground border-b border-border/10">
                  <div className="flex justify-between items-start mb-3 sm:mb-4 gap-2"> 
                    <div className="min-w-0">
                       <h3 className="font-bold text-base sm:text-lg">Today's Focus</h3>
                       <p className="text-stone-400 text-[10px] sm:text-xs">{format(new Date(), 'EEEE, MMMM do')}</p>
                    </div>
                    <ChefHat className="h-4 sm:h-5 w-4 sm:w-5 text-primary flex-shrink-0" />
                  </div>
                  
                  <Suspense fallback={<Skeleton className="h-16 w-full mt-2 rounded" />}>
                    <DiningCountdown className="mt-2" />
                  </Suspense>
                </div>
              </HostellerOnly>

              <div className="p-4 sm:p-5">
                <p className="text-[9px] sm:text-[10px] text-stone-400 uppercase tracking-normal font-bold mb-3">Live Alerts</p>
                {notifications && notifications.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="space-y-2 sm:space-y-3 max-h-[200px] sm:max-h-none overflow-y-auto">
                      {notifications.map((notif: Notification) => (
                         <div key={notif.id} className="flex gap-2 sm:gap-3 text-sm">
                           <div className="w-1.5 h-1.5 rounded-sm bg-primary mt-1.5 flex-shrink-0" />
                           <p className="text-stone-600 text-[10px] sm:text-xs leading-relaxed">{notif.message}</p>
                         </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-stone-100 flex justify-end">
                      <Button 
                        variant="ghost"
                        size="sm"
                        onClick={() => clearAllMutation.mutate()}
                        disabled={clearAllMutation.isPending}
                        className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 font-bold tracking-normal uppercase text-[9px] sm:text-[10px] h-7 px-2 sm:px-3 py-0"
                      >
                        Close All
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] sm:text-xs text-stone-400 italic">No new alerts</p>
                )}
              </div>
           </CardContent>
        </Card>
      </div>

      {/* PASS DETAIL MODAL */}
      <Dialog open={!!selectedPass} onOpenChange={(open) => !open && setSelectedPass(null)}>
        <DialogContent className="w-[95vw] sm:w-full max-w-md p-0 overflow-hidden border-0 rounded-lg sm:rounded shadow-2xl">
          <div className={cn(
            "p-5 sm:p-6 text-white relative",
            selectedPass?.status === 'approved' ? 'bg-emerald-600' :
            selectedPass?.status === 'used' ? 'bg-orange-600' :
            selectedPass?.status === 'pending' ? 'bg-orange-500' : 'bg-slate-800'
          )}>
            <div className="flex flex-col gap-3 sm:gap-4">
               <div className="h-14 sm:h-16 w-14 sm:w-16 bg-white/20 backdrop-blur-md rounded-sm flex items-center justify-center border border-white/20">
                  <QrCode className="h-8 sm:h-10 w-8 sm:w-10" />
               </div>
               <div>
                  <Badge variant="outline" className="text-white border-white/40 font-black text-[9px] sm:text-[10px] uppercase mb-1">
                    #{selectedPass?.id} • Institutional Gate Pass
                  </Badge>
                  <DialogTitle className="text-xl sm:text-2xl font-black text-white tracking-normal break-words">
                    {selectedPass?.status === 'used' ? 'Currently OUT' : 
                     selectedPass?.status === 'approved' ? 'Ready for Exit' : 'Pending Review'}
                  </DialogTitle>
               </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 bg-white overflow-y-auto max-h-[60vh] sm:max-h-[70vh]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1">
                <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-normal">Planned Exit</p>
                <div className="flex items-center gap-2 font-black text-xs sm:text-sm">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  {selectedPass?.exit_date ? format(new Date(selectedPass.exit_date), 'MMM d, yyyy') : '—'}
                </div>
                <div className="flex items-center gap-2 font-bold text-[10px] sm:text-xs pl-5.5 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {selectedPass?.exit_time || '—'}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-normal">Expected Return</p>
                <div className="flex items-center gap-2 font-black text-xs sm:text-sm">
                   <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                   {selectedPass?.date_to ? format(new Date(selectedPass.date_to), 'MMM d, yyyy') : '—'}
                </div>
                <div className="flex items-center gap-2 font-bold text-[10px] sm:text-xs pl-5.5 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {selectedPass?.entry_time || '—'}
                </div>
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3">
               <div className="p-3 sm:p-4 bg-muted/30 rounded-sm border border-dashed border-border space-y-3">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <MapPin className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-normal leading-none mb-1">Destination</p>
                      <p className="text-xs sm:text-sm font-bold break-words">{selectedPass?.destination}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <Info className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-normal leading-none mb-1">Purpose/Reason</p>
                      <p className="text-xs sm:text-sm font-medium text-slate-600 break-words">{selectedPass?.purpose}</p>
                    </div>
                  </div>
               </div>

               {selectedPass?.status === 'approved' && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-emerald-50 rounded-sm border border-emerald-100 gap-4 sm:gap-0">
                    <div>
                      <p className="text-[9px] sm:text-[10px] font-black text-emerald-600 uppercase tracking-normal">Approved At</p>
                      <p className="text-[10px] sm:text-xs font-black text-emerald-900">{selectedPass?.updated_at ? format(new Date(selectedPass.updated_at), 'PPP · p') : '—'}</p>
                    </div>
                    {selectedPass?.approved_by_name && (
                      <div className="sm:text-right">
                        <p className="text-[9px] sm:text-[10px] font-black text-emerald-600 uppercase tracking-normal">By Authority</p>
                        <p className="text-[10px] sm:text-xs font-black text-emerald-900">{selectedPass.approved_by_name}</p>
                      </div>
                    )}
                  </div>
               )}

               {selectedPass?.approval_remarks && (
                  <div className="p-3 sm:p-4 bg-orange-50 rounded-sm border border-orange-100">
                    <p className="text-[9px] sm:text-[10px] font-black text-orange-600 uppercase tracking-normal mb-1">Official Remarks</p>
                    <p className="text-[10px] sm:text-xs font-medium text-blue-900 italic">{selectedPass.approval_remarks}</p>
                  </div>
               )}

               {selectedPass?.status === 'used' && selectedPass?.actual_exit_at && (
                  <div className="p-3 sm:p-4 bg-slate-900 text-white rounded-sm shadow-xl shadow-slate-200">
                    <div className="flex justify-between items-center mb-2">
                       <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-normal text-primary">Live Tracking</p>
                       <Badge className="bg-primary/20 text-primary border-primary/20 text-[8px] sm:text-[9px] font-black animate-pulse">MONITORED</Badge>
                    </div>
                    <div className="space-y-3">
                       <div className="flex justify-between items-center text-xs">
                          <span className="font-medium text-slate-400 text-[10px]">Exit Logged At</span>
                          <span className="font-black text-xs">{format(new Date(selectedPass.actual_exit_at), 'p')}</span>
                       </div>
                       <div className="h-px bg-white/10" />
                       <div className="flex justify-between items-center gap-2">
                          <span className="text-[10px] sm:text-xs font-medium text-slate-400">Remaining Time</span>
                          <span className="text-sm sm:text-lg font-black text-primary">
                            {formatDistanceToNow(new Date(`${selectedPass.expected_return_date || selectedPass.exit_date}T${selectedPass.expected_return_time || '23:59'}:00`), { addSuffix: false })}
                          </span>
                       </div>
                    </div>
                  </div>
               )}
            </div>
            
            <Button 
               className="w-full h-12 sm:h-14 rounded-sm font-black bg-slate-900 text-white hover:bg-slate-800 transition-all border-0 shadow-lg text-sm sm:text-base"
               onClick={() => setSelectedPass(null)}
            >
               CLOSE DETAILS
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});
