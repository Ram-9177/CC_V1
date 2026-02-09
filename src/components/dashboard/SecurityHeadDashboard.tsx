import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Users, Activity, AlertTriangle, FileText, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { Link } from 'react-router-dom';
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

interface SecurityStats {
  total_scans_24h: number;
  active_passes: number;
  security_incidents: number;
  on_duty_guards: number;
  recent_scans: RecentScan[];
}

export function SecurityHeadDashboard() {
  useRealtimeQuery('gate_scan_logged', 'security-stats');
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Scans (24h)</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_scans_24h ?? 0}</div>
            <p className="text-xs text-muted-foreground">All gate scan logs (last 24h)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Passes</CardTitle>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active_passes ?? 0}</div>
            <p className="text-xs text-muted-foreground">Students out of campus</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.security_incidents ?? 0}</div>
            <p className="text-xs text-muted-foreground">Unverified scans (last 24h)</p>
          </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Guards on Duty</CardTitle>
            <Users className="h-4 w-4 text-primary" />
            </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.on_duty_guards ?? 0}</div>
            <p className="text-xs text-muted-foreground">Main, North, South gates</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              Recent Gate Scans
              <Link to="/gate-scans">
                <Button variant="ghost" size="sm">View All <ArrowUpRight className="ml-1 h-3 w-3" /></Button>
              </Link>
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

        <Card>
          <CardHeader>
            <CardTitle>Security Quick Access</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Link to="/metrics" className="block">
              <Button variant="outline" className="h-24 w-full flex flex-col gap-2">
                <ShieldCheck className="h-6 w-6 text-primary" />
                <span>Security Metrics</span>
              </Button>
            </Link>
            <Link to="/reports" className="block">
              <Button variant="outline" className="h-24 w-full flex flex-col gap-2">
                <FileText className="h-6 w-6 text-primary" />
                <span>Shift Reports</span>
              </Button>
            </Link>
            <Link to="/gate-scans" className="block">
              <Button variant="outline" className="h-24 w-full flex flex-col gap-2">
                <Users className="h-6 w-6 text-primary" />
                <span>Guard Roster</span>
              </Button>
            </Link>
            <Link to="/gate-scans" className="block">
              <Button variant="outline" className="h-24 w-full flex flex-col gap-2">
                <Activity className="h-6 w-6 text-primary" />
                <span>Live Monitor</span>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
