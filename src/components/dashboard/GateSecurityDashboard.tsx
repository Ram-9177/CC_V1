import { useState } from 'react';
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
import { useRealtimeQuery } from '@/hooks/useWebSocket';

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

export function GateSecurityDashboard() {
  const [searchTicket, setSearchTicket] = useState('');
  const queryClient = useQueryClient();

  useRealtimeQuery('gatepass_updated', 'security-gate-passes');

  const formatDateTime = (dateStr?: string, timeStr?: string) => {
    if (!dateStr) return '—';
    if (!timeStr) return format(new Date(dateStr), 'PPP');
    const dt = new Date(`${dateStr}T${timeStr}:00`);
    if (Number.isNaN(dt.getTime())) return dateStr;
    return format(dt, 'PPP · p');
  };

  const fetchGatePasses = async (status: 'approved' | 'used') => {
    const params = new URLSearchParams();
    params.set('status', status);
    if (searchTicket) params.set('hall_ticket', searchTicket);
    const response = await api.get(`/gate-passes/?${params.toString()}`);
    return (response.data.results || response.data) as GatePass[];
  };

  const { data: approvedPasses, isLoading: approvedLoading } = useQuery<GatePass[]>({
    queryKey: ['security-gate-passes', 'approved', searchTicket],
    queryFn: () => fetchGatePasses('approved'),
  });

  const { data: usedPasses, isLoading: usedLoading } = useQuery<GatePass[]>({
    queryKey: ['security-gate-passes', 'used', searchTicket],
    queryFn: () => fetchGatePasses('used'),
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number, action: 'check_out' | 'check_in' }) => {
      return api.post(`/gate-passes/${id}/verify/`, { action });
    },
    onSuccess: () => {
      toast.success('Pass verified successfully');
      queryClient.invalidateQueries({ queryKey: ['security-gate-passes'] });
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Verification failed'));
    }
  });

  const isLoading = approvedLoading || usedLoading;
  const approvedCount = approvedPasses?.length || 0;
  const usedCount = usedPasses?.length || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 md:grid-cols-3 gap-2 md:gap-4">
        <Card className="bg-primary border-0 rounded-2xl md:rounded-3xl text-primary-foreground shadow-lg shadow-primary/20">
          <CardHeader className="p-3 md:pb-2">
            <CardTitle className="text-[10px] md:text-xs font-black uppercase tracking-wider opacity-80">Approved</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-2xl md:text-5xl font-black">{approvedCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-0 rounded-2xl md:rounded-3xl text-white shadow-xl">
          <CardHeader className="p-3 md:pb-2">
            <CardTitle className="text-[10px] md:text-xs font-black uppercase tracking-wider opacity-60">Out</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-2xl md:text-5xl font-black">{usedCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-0 rounded-2xl md:rounded-3xl text-blue-900">
          <CardHeader className="p-3 md:pb-2">
            <CardTitle className="text-[10px] md:text-xs font-black uppercase tracking-wider opacity-60">Active</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-2xl md:text-5xl font-black">{approvedCount + usedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm rounded-3xl overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Gate Entry/Exit Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search Student by Hall Ticket / Registration Number..."
              className="pl-10 h-12 text-lg"
              value={searchTicket}
              onChange={(e) => setSearchTicket(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Approved Passes (Check OUT)</h3>
            {isLoading ? (
              <div className="text-center py-8">Loading passes...</div>
            ) : approvedPasses && approvedPasses.length > 0 ? (
              approvedPasses.map((pass) => (
                <div key={pass.id} className="flex flex-col md:flex-row items-center justify-between p-4 border border-border/50 rounded-2xl bg-card hover:shadow-lg transition-all gap-4 group">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <ArrowRightLeft className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold">{pass.student_name}</h4>
                      <p className="text-sm text-muted-foreground">{pass.student_hall_ticket}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">{pass.student_room ? `Room ${pass.student_room}` : '—'}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {formatDateTime(pass.exit_date, pass.exit_time)}
                        </span>
                      </div>
                      {pass.destination ? (
                        <div className="text-xs text-muted-foreground mt-1">Destination: {pass.destination}</div>
                      ) : null}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 w-full md:w-auto">
                    <Button 
                        variant="default" 
                        className="flex-1 md:flex-none primary-gradient text-white font-semibold hover:opacity-90 smooth-transition"
                        onClick={() => verifyMutation.mutate({ id: pass.id, action: 'check_out' })}
                    >
                        <UserCheck className="h-4 w-4 mr-2" /> Check OUT
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">No approved passes found</p>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-6 border-t">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Students Out (Check IN)</h3>
            {isLoading ? (
              <div className="text-center py-8">Loading passes...</div>
            ) : usedPasses && usedPasses.length > 0 ? (
              usedPasses.map((pass) => (
                <div key={pass.id} className="flex flex-col md:flex-row items-center justify-between p-4 border border-border/50 rounded-2xl bg-card hover:shadow-lg transition-all gap-4 group">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <ArrowRightLeft className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold">{pass.student_name}</h4>
                      <p className="text-sm text-muted-foreground">{pass.student_hall_ticket}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">{pass.student_room ? `Room ${pass.student_room}` : '—'}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {formatDateTime(pass.exit_date, pass.exit_time)}
                        </span>
                      </div>
                      {pass.destination ? (
                        <div className="text-xs text-muted-foreground mt-1">Destination: {pass.destination}</div>
                      ) : null}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 w-full md:w-auto">
                    <Button 
                        variant="default" 
                        className="flex-1 md:flex-none primary-gradient text-white font-semibold hover:opacity-90 smooth-transition"
                        onClick={() => verifyMutation.mutate({ id: pass.id, action: 'check_in' })}
                    >
                        <UserCheck className="h-4 w-4 mr-2" /> Check IN
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">No students currently out</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
