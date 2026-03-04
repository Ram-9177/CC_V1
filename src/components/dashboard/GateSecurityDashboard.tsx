import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, ShieldCheck, UserCheck, Clock, ArrowRightLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useWebSocketEvent } from '@/hooks/useWebSocket';

interface GatePass {
  id: number;
  student_id: number;
  student_name: string;
  student_hall_ticket: string;
  student_room?: string;
  purpose: string;
  destination?: string;
  exit_date?: string;
  exit_time?: string;
  expected_return_date?: string;
  expected_return_time?: string;
  status: 'pending' | 'approved' | 'rejected' | 'used' | 'expired';
}

interface GateScan {
  id: number;
  student_name: string;
  student_hall_ticket: string;
  direction: 'in' | 'out';
  scan_time: string;
  location: string;
}

export function GateSecurityDashboard() {
  const [searchTicket, setSearchTicket] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const queryClient = useQueryClient();

  // Debounce search input to avoid UI lag and redundant API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTicket);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTicket]);

  // Real-time Event Listeners with Cache Patching (Instant Updates)
  useWebSocketEvent('gatepass_updated', (data: { id: number; status: GatePass['status'] }) => {
    // Instant cache patching for smooth updates without full refetch
    queryClient.setQueryData(['security-gate-passes', debouncedSearch], (old: GatePass[] | undefined) => {
      if (!old) return old;
      return old.map(p => p.id === data.id ? { ...p, status: data.status } : p);
    });
  });

  useWebSocketEvent('gatepass_approved', () => {
    // Refetch when a new pass is approved by Warden
    queryClient.invalidateQueries({ queryKey: ['security-gate-passes'] });
  });

  useWebSocketEvent('gate_scan_logged', () => {
    // Refresh the recent scans list when a scan is performed
    queryClient.invalidateQueries({ queryKey: ['recent-gate-scans'] });
  });

  const formatDateTime = (dateStr?: string, timeStr?: string) => {
    if (!dateStr) return '—';
    if (!timeStr) return format(new Date(dateStr), 'PPP');
    const dt = new Date(`${dateStr}T${timeStr}:00`);
    if (Number.isNaN(dt.getTime())) return dateStr;
    return format(dt, 'PPP · p');
  };

  // Unified Fetch: Security role gets both 'approved' and 'used' by default
  const { data: allPasses, isLoading } = useQuery<GatePass[]>({
    queryKey: ['security-gate-passes', debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('hall_ticket', debouncedSearch);
      // No status filter = get all relevant for security in one request
      const response = await api.get(`/gate-passes/?${params.toString()}`);
      return (response.data.results || response.data) as GatePass[];
    },
    staleTime: 30000,
  });

  // Recent Scans Fetch
  const { data: recentScans } = useQuery<GateScan[]>({
    queryKey: ['recent-gate-scans'],
    queryFn: async () => {
      const response = await api.get('/gate-scans/?limit=5');
      return (response.data.results || response.data) as GateScan[];
    },
  });

  const approvedPasses = useMemo(() => 
    allPasses?.filter(p => p.status === 'approved') || [], 
    [allPasses]
  );
  
  const usedPasses = useMemo(() => 
    allPasses?.filter(p => p.status === 'used') || [], 
    [allPasses]
  );

  const verifyMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number, action: 'check_out' | 'check_in' | 'deny_exit' }) => {
      return api.post(`/gate-passes/${id}/verify/`, { action });
    },
    onMutate: async ({ id, action }) => {
      // Optimistic Update: Move data immediately for "Instant" feel
      await queryClient.cancelQueries({ queryKey: ['security-gate-passes'] });
      const previousPasses = queryClient.getQueryData(['security-gate-passes', debouncedSearch]);
      
      const nextStatus = action === 'check_out' ? 'used' : (action === 'check_in' ? 'expired' : 'rejected');
      
      queryClient.setQueryData(['security-gate-passes', debouncedSearch], (old: GatePass[] | undefined) => {
        if (!old) return old;
        return old.map(p => p.id === id ? { ...p, status: nextStatus as GatePass['status'] } : p);
      });

      return { previousPasses };
    },
    onSuccess: () => {
      toast.success('Gate action verified');
      if ('vibrate' in navigator) navigator.vibrate(100);
    },
    onError: (error: unknown, __, context) => {
      // Rollback on error
      if (context?.previousPasses) {
        queryClient.setQueryData(['security-gate-passes', debouncedSearch], context.previousPasses);
      }
      toast.error(getApiErrorMessage(error, 'Verification failed'));
    },
    onSettled: () => {
       // Sync with server eventually
       queryClient.invalidateQueries({ queryKey: ['security-gate-passes'] });
       queryClient.invalidateQueries({ queryKey: ['recent-gate-scans'] });
    }
  });

  const approvedCount = approvedPasses.length;
  const usedCount = usedPasses.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Card className="bg-primary/10 border border-primary/20 rounded-2xl md:rounded-3xl text-primary shadow-sm hover:scale-[1.02] transition-transform cursor-pointer">
          <CardHeader className="p-3 md:pb-2">
            <CardTitle className="text-[10px] md:text-xs font-black uppercase tracking-wider opacity-80">Approved (IN)</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
            <div className="text-2xl md:text-5xl font-black">{approvedCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-muted border border-border rounded-2xl md:rounded-3xl text-foreground shadow-sm hover:scale-[1.02] transition-transform cursor-pointer">
          <CardHeader className="p-3 md:pb-2">
            <CardTitle className="text-[10px] md:text-xs font-black uppercase tracking-wider opacity-60">Out (ACTIVE)</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
            <div className="text-2xl md:text-5xl font-black">{usedCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-black text-white rounded-2xl md:rounded-3xl shadow-sm hover:scale-[1.02] transition-transform cursor-pointer overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldCheck className="h-12 w-12" />
          </div>
          <CardHeader className="p-3 md:pb-2">
            <CardTitle className="text-[10px] md:text-xs font-black uppercase tracking-wider opacity-60">Total Active</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
            <div className="text-2xl md:text-5xl font-black">{approvedCount + usedCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-0 shadow-sm rounded-3xl overflow-hidden bg-white/50 backdrop-blur-sm h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Gate Entry/Exit Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search Student (Hall Ticket / Reg. No)..."
                className="pl-12 h-14 text-lg rounded-2xl border-2 focus-visible:ring-primary/20 transition-all shadow-sm"
                value={searchTicket}
                onChange={(e) => setSearchTicket(e.target.value)}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Check OUT Queue</h3>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">{approvedCount} Expected</Badge>
              </div>
              
              {isLoading ? (
                <div className="text-center py-12 space-y-4">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                  <p className="text-sm font-bold text-muted-foreground">Searching database...</p>
                </div>
              ) : approvedPasses.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {approvedPasses.map((pass) => (
                    <div key={pass.id} className="flex flex-col md:flex-row items-center justify-between p-5 border border-border/50 rounded-[2rem] bg-white hover:border-primary/30 transition-all gap-4 shadow-sm group">
                      <div className="flex items-center gap-5 flex-1 w-full">
                        <div className="h-14 w-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 group-hover:scale-110 transition-transform">
                            <UserCheck className="h-7 w-7" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-lg text-gray-900 truncate">{pass.student_name}</h4>
                          <p className="text-sm font-bold text-muted-foreground">{pass.student_hall_ticket}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider">{pass.student_room ? `Room ${pass.student_room}` : 'No Room'}</Badge>
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                <Clock className="h-3 w-3" /> {formatDateTime(pass.exit_date, pass.exit_time)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 w-full md:w-auto">
                        <Button 
                          size="lg"
                          className="flex-1 md:flex-none bg-emerald-600 text-white font-black hover:bg-emerald-700 h-14 px-8 rounded-2xl shadow-lg shadow-emerald-200 transition-all active:scale-95"
                          onClick={() => verifyMutation.mutate({ id: pass.id, action: 'check_out' })}
                          disabled={verifyMutation.isPending}
                        >
                          {verifyMutation.isPending ? "..." : "ALLOW EXIT"}
                        </Button>
                        <Button 
                          variant="ghost"
                          size="lg"
                          className="flex-1 md:flex-none text-red-500 font-bold hover:bg-red-50 h-14 rounded-2xl px-6"
                          onClick={() => verifyMutation.mutate({ id: pass.id, action: 'deny_exit' })}
                          disabled={verifyMutation.isPending}
                        >
                          DENY
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 border-2 border-dashed rounded-[2rem] bg-muted/10">
                  <ShieldCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-bold italic">No approved departures found</p>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-8 border-t-2 border-dashed mt-8">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Check IN Queue</h3>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">{usedCount} Outside</Badge>
              </div>

              {usedPasses.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {usedPasses.map((pass) => (
                    <div key={pass.id} className="flex flex-col md:flex-row items-center justify-between p-5 border border-border/50 rounded-[2rem] bg-white hover:border-primary/30 transition-all gap-4 shadow-sm group">
                      <div className="flex items-center gap-5 flex-1 w-full">
                        <div className="h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 group-hover:scale-110 transition-transform">
                            <ArrowRightLeft className="h-7 w-7" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-lg text-gray-900 truncate">{pass.student_name}</h4>
                          <p className="text-sm font-bold text-muted-foreground">{pass.student_hall_ticket}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider">{pass.student_room ? `Room ${pass.student_room}` : 'No Room'}</Badge>
                            <span className="text-[10px] font-black text-blue-600/70 uppercase tracking-widest flex items-center gap-1.5">
                                <Clock className="h-3 w-3" /> OUT SINCE {formatDateTime(pass.exit_date, pass.exit_time)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 w-full md:w-auto">
                        <Button 
                          size="lg"
                          className="flex-1 md:flex-none bg-blue-600 text-white font-black hover:bg-blue-700 h-14 px-8 rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-95"
                          onClick={() => verifyMutation.mutate({ id: pass.id, action: 'check_in' })}
                          disabled={verifyMutation.isPending}
                        >
                          {verifyMutation.isPending ? "..." : "MARK ENTRY"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !isLoading && (
                <div className="text-center py-16 border-2 border-dashed rounded-[2rem] bg-muted/10">
                  <ShieldCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-bold italic">Everyone is safely inside</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Live Scan Log - Premium Real-time Monitor */}
        <div className="space-y-6">
          <Card className="border-0 shadow-lg rounded-3xl bg-slate-900 text-white overflow-hidden sticky top-6">
            <CardHeader className="pb-2 border-b border-white/10 bg-white/5">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                 <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                 Live Activity Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               {recentScans && recentScans.length > 0 ? (
                 <div className="divide-y divide-white/10">
                    {recentScans.map((scan) => (
                      <div key={scan.id} className="p-4 hover:bg-white/5 transition-colors group">
                         <div className="flex justify-between items-start mb-1">
                            <p className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                               {scan.direction === 'out' ? '↗ Exit Logged' : '↙ Entry Logged'}
                            </p>
                            <span className="text-[9px] font-bold opacity-40">{format(new Date(scan.scan_time), 'HH:mm:ss')}</span>
                         </div>
                         <h5 className="font-bold text-sm truncate">{scan.student_name}</h5>
                         <p className="text-[10px] font-medium opacity-60 uppercase">{scan.student_hall_ticket}</p>
                         <div className="mt-2 flex items-center gap-1.5">
                            <Badge className="bg-white/10 text-[9px] font-black border-0 text-white/70 h-5">Verified</Badge>
                            <span className="text-[9px] font-bold opacity-30">{scan.location}</span>
                         </div>
                      </div>
                    ))}
                 </div>
               ) : (
                 <div className="p-12 text-center">
                    <Clock className="h-8 w-8 opacity-10 mx-auto mb-2" />
                    <p className="text-[10px] font-black opacity-30 uppercase">Waiting for activity...</p>
                 </div>
               )}
               <div className="p-4 bg-white/5 border-t border-white/10">
                  <Button variant="ghost" className="w-full text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 h-8 rounded-xl" onClick={() => queryClient.invalidateQueries({ queryKey: ['recent-gate-scans'] })}>
                     Force Refresh List
                  </Button>
               </div>
            </CardContent>
          </Card>
          
          <Card className="border-2 border-dashed border-primary/20 rounded-3xl bg-primary/5 p-6 text-center">
             <ShieldCheck className="h-8 w-8 text-primary mx-auto mb-3 opacity-50" />
             <h4 className="text-xs font-black text-primary uppercase tracking-widest">Secure Environment</h4>
             <p className="text-[10px] font-bold text-primary/60 mt-2 px-2">Every verification is audited and time-stamped for student safety.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

