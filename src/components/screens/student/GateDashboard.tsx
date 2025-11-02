import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { HallticketChip } from '../../HallticketChip';
import { Plus, QrCode, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { t } from '../../../lib/i18n';
import { GatePass } from '../../../lib/types';
import { listMyGatePasses } from '../../../lib/gate-passes';
import { useSocketEvent } from '../../../lib/socket';
import { useNavigate } from 'react-router-dom';

export function GateDashboard() {
  const navigate = useNavigate();
  const [passes, setPasses] = useState<GatePass[]>([]);

  const fetchMyPasses = useCallback(async () => {
    try {
      const arr = await listMyGatePasses();
      setPasses(arr);
    } catch {}
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => { if (mounted) await fetchMyPasses(); })();
    return () => { mounted = false; };
  }, [fetchMyPasses]);

  // Realtime updates
  useSocketEvent('gate-pass:created', fetchMyPasses, true);
  useSocketEvent('gate-pass:approved', fetchMyPasses, true);
  useSocketEvent('gate-pass:rejected', fetchMyPasses, true);
  useSocketEvent('gate-pass:revoked', fetchMyPasses, true);
  useSocketEvent('gate-pass:scanned', fetchMyPasses, true);

  const getStateColor = (state: GatePass['state']) => {
    switch (state) {
      case 'APPROVED':
      case 'ACTIVE':
        return 'default';
      case 'SUBMITTED':
        return 'secondary';
      case 'REJECTED':
      case 'OVERDUE':
      case 'REVOKED_AUTO':
        return 'destructive';
      case 'COMPLETED':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStateIcon = (state: GatePass['state']) => {
    switch (state) {
      case 'APPROVED':
      case 'ACTIVE':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'SUBMITTED':
        return <Clock className="h-4 w-4" />;
      case 'REJECTED':
      case 'OVERDUE':
      case 'REVOKED_AUTO':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getInactivityWarning = (pass: GatePass) => {
    const hoursSinceActivity = (Date.now() - new Date(pass.lastActivityAt).getTime()) / (1000 * 60 * 60);
    const hoursRemaining = 72 - hoursSinceActivity;
    
    if (hoursRemaining <= 24 && hoursRemaining > 0 && ['SUBMITTED', 'APPROVED'].includes(pass.state)) {
      return `Auto-revoke in ${Math.floor(hoursRemaining)}h`;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl">Gate Pass Dashboard</h1>
          <p className="text-muted-foreground">Manage your gate pass requests</p>
        </div>
        <Button onClick={() => navigate('/student/gate-pass/create')}>
          <Plus className="h-4 w-4" />
          Create Pass
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Passes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">
              {passes.filter(p => p.state === 'ACTIVE').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">
              {passes.filter(p => p.state === 'SUBMITTED').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{passes.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Gate Passes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {passes.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No gate passes yet. Create your first pass to get started.
              </div>
            )}

            {passes.map((pass) => {
              const warning = getInactivityWarning(pass);
              
              return (
                <div
                  key={pass.id}
                  className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => navigate(`/student/gate-pass/${pass.id}`)}
                >
                  <div className="flex items-start justify-between mb-3 gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant={getStateColor(pass.state)} className="gap-1">
                          {getStateIcon(pass.state)}
                          {pass.state}
                        </Badge>
                        {warning && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {warning}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-medium text-wrap">{pass.reason}</h3>
                      <p className="text-sm text-muted-foreground text-wrap">{pass.destination}</p>
                    </div>

                    {pass.state === 'APPROVED' && !pass.adUnlocked && (
                      <Button size="sm" variant="outline" onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate(`/student/gate-pass/${pass.id}`); }}>
                        <QrCode className="h-4 w-4" />
                        Unlock QR
                      </Button>
                    )}

                    {pass.adUnlocked && pass.qrToken && (
                      <Button size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate(`/student/gate-pass/${pass.id}`); }}>
                        <QrCode className="h-4 w-4" />
                        View QR
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Departure</p>
                      <p className="font-medium">
                        {new Date(pass.departureTime).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expected Return</p>
                      <p className="font-medium">
                        {new Date(pass.expectedReturn).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {pass.approvedBy && (
                    <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                      Approved by {pass.approvedBy} • {new Date(pass.approvedAt!).toLocaleDateString()}
                    </div>
                  )}

                  {pass.rejectionReason && (
                    <div className="mt-3 pt-3 border-t text-sm">
                      <p className="text-destructive">Rejection Reason: {pass.rejectionReason}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
