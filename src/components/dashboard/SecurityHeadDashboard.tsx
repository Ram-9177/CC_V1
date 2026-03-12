import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Users, Activity, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useRealtimeQuery } from '@/hooks/useWebSocket';

interface RecentScan {
  id: number;
  student_name: string;
  student_hall_ticket: string;
  direction: 'in' | 'out';
  location: string;
  scan_time: string;
  verified: boolean;
}

interface GatePass {
  id: number;
  student_name: string;
  student_hall_ticket: string;
  hostel_name?: string;
  student_room?: string;
  exit_date: string;
  exit_time: string;
  approval_remarks?: string;
  status: string;
}

interface SecurityStats {
  total_scans_24h: number;
  active_passes: number;
  security_incidents: number;
  on_duty_guards: number;
  recent_scans: RecentScan[];
  approved_today?: GatePass[];
}

export function SecurityHeadDashboard() {
  useRealtimeQuery('gate_scan_logged', 'security-stats');
  useRealtimeQuery('gatepass_created', 'security-stats');
  useRealtimeQuery('gatepass_approved', 'security-stats');
  useRealtimeQuery('gatepass_rejected', 'security-stats');
  useRealtimeQuery('gatepass_updated', 'security-stats');

  const { data: stats, isLoading } = useQuery<SecurityStats>({
    queryKey: ['security-stats'],
    queryFn: async () => {
      const response = await api.get('/metrics/security-stats/');
      return response.data;
    },
  });

  if (isLoading) {
    return <div className="text-muted-foreground">Loading security metrics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-primary/10 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-foreground">Scans (24h)</CardTitle>
            <Activity className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{stats?.total_scans_24h ?? 0}</div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">All gates</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-foreground">Active Passes</CardTitle>
            <ShieldCheck className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-primary">{stats?.active_passes ?? 0}</div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Out of campus</p>
          </CardContent>
        </Card>
        <Card className="bg-black border-black">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-white">Incidents</CardTitle>
            <AlertTriangle className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-primary">{stats?.security_incidents ?? 0}</div>
            <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Last 24h</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-foreground">Guards</CardTitle>
            <Users className="h-5 w-5 text-primary" />
            </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{stats?.on_duty_guards ?? 0}</div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">On duty</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              Recent Gate Scans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.recent_scans && stats.recent_scans.length > 0 ? (
                stats.recent_scans.map((scan) => (
                  <div key={scan.id} className="flex items-center justify-between p-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded bg-muted/40 flex items-center justify-center">
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{scan.student_hall_ticket}</p>
                        <p className="text-xs text-muted-foreground">
                          {scan.location || 'Main Gate'} - {scan.direction === 'out' ? 'Check Out' : 'Check In'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{new Date(scan.scan_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      <Badge
                        variant="outline"
                        className={scan.verified ? 'text-[10px] bg-success/10 text-success border-success/20' : 'text-[10px] bg-destructive/10 text-destructive border-destructive/20'}
                      >
                        {scan.verified ? 'Verified' : 'Unverified'}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No recent scans</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Approved Gatepasses Today</CardTitle>
              <p className="text-xs text-muted-foreground">Authorized movement for the current cycle</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.approved_today && stats.approved_today.length > 0 ? (
                stats.approved_today.map((pass) => (
                  <div key={pass.id} className="p-4 bg-muted/30 rounded-2xl border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center font-black text-primary">
                            {pass.student_name?.[0]}
                        </div>
                        <div>
                            <h4 className="font-bold text-sm text-slate-900">{pass.student_name}</h4>
                            <p className="text-[10px] font-bold text-slate-500">{pass.student_hall_ticket} • Room {pass.student_room}</p>
                        </div>
                    </div>
                    
                    <div className="flex-1 md:px-6">
                        {pass.approval_remarks && (
                            <div className="text-[10px] bg-blue-50 text-blue-700 p-2 rounded-lg border border-blue-100 italic">
                                <strong>Warden:</strong> {pass.approval_remarks}
                            </div>
                        )}
                    </div>

                    <div className="text-right shrink-0">
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Exit Window</div>
                        <p className="text-xs font-bold text-slate-700">{pass.exit_time} ↗</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed">
                  No gatepasses approved today yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
