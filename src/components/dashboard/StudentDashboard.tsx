
import { useQuery, useQueryClient as useQC } from '@tanstack/react-query';
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
import { BrandedLoading } from '@/components/common/BrandedLoading';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { format, formatDistanceToNow } from 'date-fns';
import { useRealtimeQuery, useWebSocketEvent } from '@/hooks/useWebSocket';
import { FeedbackRequestCard } from './FeedbackRequestCard';
import { DiningCountdown } from '@/components/meals/DiningCountdown';
import { cn } from '@/lib/utils';
import type { GatePass, Notification } from '@/types';

interface StudentBundle {
  gate_passes: {
    count: number;
    recent: GatePass[];
  };
  attendance_today: any;
  monthly_attendance: any;
  last_scan: any;
  notifications: Notification[];
  advanced_stats: any;
}

export const StudentDashboard = memo(function StudentDashboard() {
  const user = useAuthStore((state) => state.user);
  const monthKey = format(new Date(), 'yyyy-MM');
  const queryClient = useQC();
  const [selectedPass, setSelectedPass] = useState<GatePass | null>(null);

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
    staleTime: 60 * 1000,
    refetchInterval: 120 * 1000,
    refetchOnWindowFocus: false,
  });

  const gatePassSummary = bundle?.gate_passes as { count: number; recent: GatePass[] } | undefined;
  const lastScan = bundle?.last_scan as { id: number; direction: 'in' | 'out'; scan_time: string; location: string } | null | undefined;
  const notifications = bundle?.notifications;
  const advancedStats = bundle?.advanced_stats;

  const activePass = useMemo(() => {
    if (!gatePassSummary?.recent) return null;
    return gatePassSummary.recent.find(p => p.status === 'used') 
           || gatePassSummary.recent.find(p => p.status === 'approved')
           || gatePassSummary.recent.find(p => p.status === 'pending');
  }, [gatePassSummary?.recent]);

  const timeRemaining = useMemo(() => {
    if (!activePass || !activePass.entry_time || !activePass.exit_date) return null;
    const returnDate = activePass.expected_return_date || activePass.exit_date;
    const returnTime = activePass.expected_return_time || '23:59';
    const returnDt = new Date(`${returnDate}T${returnTime}:00`);
    const now = new Date();
    const diff = returnDt.getTime() - now.getTime();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m remaining`;
  }, [activePass]);

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
        {bundleLoading && !bundle && (
          <BrandedLoading message="Fetching your student profile..." />
        )}

        <FeedbackRequestCard />

        {activePass && (
            <div className="space-y-4">
              <Card 
                className="overflow-hidden border border-primary/20 shadow-lg rounded-3xl bg-primary/5 animate-in fade-in duration-500 cursor-pointer group active:scale-[0.98] transition-all"
                onClick={() => setSelectedPass(activePass)}
              >
                <CardContent className="p-0">
                  <div className="p-5 sm:p-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0 border border-primary/20 transition-transform group-hover:scale-110 group-hover:rotate-3">
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
                      <ArrowRight className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-1">
                      <div className="bg-white/60 dark:bg-white/5 rounded-2xl p-3 border border-border/30">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Type</p>
                        <p className="text-sm font-bold capitalize">{activePass.pass_type || activePass.type || 'Day'}</p>
                      </div>
                      <div className="bg-white/60 dark:bg-white/5 rounded-2xl p-3 border border-border/30">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Status</p>
                        <Badge variant="outline" className={cn(
                          "font-black uppercase text-[10px] tracking-widest px-2 shadow-sm",
                          activePass.status === 'approved' ? 'bg-emerald-500 text-white border-transparent' :
                          activePass.status === 'used' ? 'bg-primary text-foreground border-transparent outline-none ring-1 ring-primary/30' :
                          'bg-black text-white border-transparent'
                        )}>
                          {activePass.status}
                        </Badge>
                      </div>
                      <div className="bg-white/60 dark:bg-white/5 rounded-2xl p-3 border border-border/30">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Exit</p>
                        <p className="text-sm font-bold">{formatDateTime(activePass.exit_date || activePass.date_from, activePass.exit_time)}</p>
                      </div>
                      <div className="bg-white/60 dark:bg-white/5 rounded-2xl p-3 border border-border/30">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Return</p>
                        <p className="text-sm font-bold">{formatDateTime(activePass.expected_return_date || activePass.exit_date, activePass.expected_return_time || undefined)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-primary/10 rounded-2xl p-3 border border-primary/15">
                      <div>
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Protocol Check</p>
                        <p className="text-xs font-bold text-foreground">Tap for full pass details</p>
                      </div>
                      {timeRemaining && (
                        <div className="text-right">
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest">Time Left</p>
                          <p className="text-sm font-black text-foreground">{timeRemaining}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
        )}

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

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                <div className="bg-accent/10 border border-accent/20 rounded-xl p-2">
                  <ChefHat className="h-5 w-5 text-accent" />
                </div>
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

        <Card className="bg-muted border border-border rounded-2xl md:rounded-3xl text-stone-900 shadow-sm">
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
              {bundleLoading ? (
                 <BrandedLoading compact message="Refreshing passes..." />
              ) : gatePassSummary?.recent?.length > 0 ? (
                gatePassSummary.recent.map((pass: GatePass) => (
                  <div 
                    key={pass.id} 
                    className="flex items-center justify-between p-3 mx-2 hover:bg-stone-50 rounded-2xl transition-colors cursor-pointer group"
                    onClick={() => setSelectedPass(pass)}
                  >
                     <div className="flex items-center gap-4">
                       <div className={`p-2.5 rounded-xl shadow-sm border transition-transform group-hover:scale-110 ${
                         pass.id === selectedPass?.id ? 'bg-primary text-white border-primary' : 'bg-primary/20 border-primary/30 text-foreground'
                       }`}>
                          <QrCode className="h-5 w-5" />
                       </div>
                       <div>
                         <div className="font-semibold text-sm text-stone-900">{(pass.pass_type === 'day') ? 'Day Visit' : 'Outing'}</div>
                         <div className="text-xs text-stone-500 font-medium">{formatDateTime(pass.exit_date, pass.exit_time)}</div>
                       </div>
                     </div>
                     <Badge variant="outline" className={cn(
                       "font-bold uppercase text-[10px] tracking-widest",
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
                <div className="text-center py-8 text-muted-foreground text-sm bg-stone-50/50 m-4 rounded-2xl border border-dashed border-stone-200">
                  No recent gate passes
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
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
                
                <DiningCountdown className="mt-2" />
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

      {/* PASS DETAIL MODAL */}
      <Dialog open={!!selectedPass} onOpenChange={(open) => !open && setSelectedPass(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 rounded-[2.5rem] shadow-2xl">
          <div className={cn(
            "p-6 text-white relative",
            selectedPass?.status === 'approved' ? 'bg-emerald-600' :
            selectedPass?.status === 'used' ? 'bg-blue-600' :
            selectedPass?.status === 'pending' ? 'bg-orange-500' : 'bg-slate-800'
          )}>
            <div className="flex flex-col gap-4">
               <div className="h-16 w-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                  <QrCode className="h-10 w-10" />
               </div>
               <div>
                  <Badge variant="outline" className="text-white border-white/40 font-black text-[10px] uppercase mb-1">
                    #{selectedPass?.id} • Institutional Gate Pass
                  </Badge>
                  <DialogTitle className="text-2xl font-black text-white tracking-tight">
                    {selectedPass?.status === 'used' ? 'Currently OUT' : 
                     selectedPass?.status === 'approved' ? 'Ready for Exit' : 'Pending Review'}
                  </DialogTitle>
               </div>
            </div>
          </div>

          <div className="p-6 space-y-6 bg-white overflow-y-auto max-h-[70vh]">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Planned Exit</p>
                <div className="flex items-center gap-2 font-black text-sm">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  {selectedPass?.exit_date ? format(new Date(selectedPass.exit_date), 'MMM d, yyyy') : '—'}
                </div>
                <div className="flex items-center gap-2 font-bold text-xs pl-5.5 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {selectedPass?.exit_time || '—'}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Expected Return</p>
                <div className="flex items-center gap-2 font-black text-sm">
                   <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                   {selectedPass?.date_to ? format(new Date(selectedPass.date_to), 'MMM d, yyyy') : '—'}
                </div>
                <div className="flex items-center gap-2 font-bold text-xs pl-5.5 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {selectedPass?.entry_time || '—'}
                </div>
              </div>
            </div>

            <div className="space-y-3">
               <div className="p-4 bg-muted/30 rounded-2xl border border-dashed border-border space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-primary mt-1" />
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Destination</p>
                      <p className="text-sm font-bold">{selectedPass?.destination}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Info className="h-4 w-4 text-primary mt-1" />
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Purpose/Reason</p>
                      <p className="text-sm font-medium text-slate-600">{selectedPass?.purpose}</p>
                    </div>
                  </div>
               </div>

               {selectedPass?.status === 'approved' && (
                  <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <div>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Approved At</p>
                      <p className="text-xs font-black text-emerald-900">{selectedPass?.updated_at ? format(new Date(selectedPass.updated_at), 'PPP · p') : '—'}</p>
                    </div>
                    {selectedPass?.approved_by_name && (
                      <div className="text-right">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">By Authority</p>
                        <p className="text-xs font-black text-emerald-900">{selectedPass.approved_by_name}</p>
                      </div>
                    )}
                  </div>
               )}

               {selectedPass?.approval_remarks && (
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Official Remarks</p>
                    <p className="text-xs font-medium text-blue-900 italic">{selectedPass.approval_remarks}</p>
                  </div>
               )}

               {selectedPass?.status === 'used' && selectedPass?.actual_exit_at && (
                  <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-200">
                    <div className="flex justify-between items-center mb-2">
                       <p className="text-[10px] font-black uppercase tracking-widest text-primary">Live Tracking</p>
                       <Badge className="bg-primary/20 text-primary border-primary/20 text-[9px] font-black animate-pulse">MONITORED</Badge>
                    </div>
                    <div className="space-y-3">
                       <div className="flex justify-between items-center text-xs">
                          <span className="font-medium text-slate-400">Exit Logged At</span>
                          <span className="font-black">{format(new Date(selectedPass.actual_exit_at), 'p')}</span>
                       </div>
                       <div className="h-px bg-white/10" />
                       <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-slate-400">Remaining Time</span>
                          <span className="text-lg font-black text-primary">
                            {formatDistanceToNow(new Date(`${selectedPass.expected_return_date || selectedPass.exit_date}T${selectedPass.expected_return_time || '23:59'}:00`), { addSuffix: false })}
                          </span>
                       </div>
                    </div>
                  </div>
               )}
            </div>
            
            <Button 
               className="w-full h-14 rounded-2xl font-black bg-slate-900 text-white hover:bg-slate-800 transition-all border-0 shadow-lg"
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
