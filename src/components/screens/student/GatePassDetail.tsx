import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import { AdGate } from '../../AdGate';
import { ArrowLeft, QrCode, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { t } from '../../../lib/i18n';
import { useSocketEvent } from '../../../lib/socket';
import { toast } from 'sonner';
import { fetchGatePassQRDataUrl, getGatePass, watchAd } from '../../../lib/gate-passes';
import type { GatePass } from '../../../lib/types';

export function GatePassDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pass, setPass] = useState<GatePass | null>(null);
  const [showAdGate, setShowAdGate] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);

  // Initial fetch (backend if configured, else mock)
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const gp = await getGatePass(id as string);
        if (mounted) setPass(gp);
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load gate pass');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (id) load();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Live updates for this pass: listen to specific events and refresh state
  const handlePassUpdate = (payload: any) => {
    try {
      if (!payload || payload.id !== pass?.id) return;
      setPass((prev: any) => ({ ...(prev as any), ...payload }));
      if (payload.state) toast.info(`Gate pass ${payload.state}`);
    } catch {}
  };

  useSocketEvent('gate-pass:created', handlePassUpdate, true);
  useSocketEvent('gate-pass:approved', handlePassUpdate, true);
  useSocketEvent('gate-pass:rejected', handlePassUpdate, true);
  useSocketEvent('gate-pass:revoked', handlePassUpdate, true);
  useSocketEvent('gate-pass:scanned', handlePassUpdate, true);

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading gate pass…</p>
      </div>
    );
  }

  if (!pass) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Gate pass not found</p>
        <Button variant="link" onClick={() => navigate('/student/gate-pass')}>
          Go back
        </Button>
      </div>
    );
  }

  const handleUnlockQR = () => {
    setShowAdGate(true);
  };

  const handleAdComplete = async () => {
    try {
      setUnlocking(true);
      // Tell backend the ad was watched (no-op in mock mode)
      const result = await watchAd(pass.id);
      if ('ok' in result && !result.ok) {
        throw new Error(result.message || `Ad verification failed (HTTP ${result.status})`);
      }
      // Fetch QR from secure endpoint (or generate in mock mode)
      const dataUrl = await fetchGatePassQRDataUrl(pass.id, pass.qrToken);
      setQrDataUrl(dataUrl);
      setPass({ ...pass, adUnlocked: true });
      setShowAdGate(false);
      toast.success('QR unlocked');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to unlock QR');
    } finally {
      setUnlocking(false);
    }
  };

  const hoursSinceActivity = (Date.now() - new Date(pass.lastActivityAt).getTime()) / (1000 * 60 * 60);
  const hoursUntilRevoke = 72 - hoursSinceActivity;
  const showRevokeWarning = hoursUntilRevoke > 0 && hoursUntilRevoke <= 24 && ['SUBMITTED', 'APPROVED'].includes(pass.state);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate('/student/gate-pass')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      {showRevokeWarning && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This pass will be auto-revoked in {Math.floor(hoursUntilRevoke)} hours due to inactivity.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle>{pass.reason}</CardTitle>
              <p className="text-muted-foreground mt-1">{pass.destination}</p>
            </div>
            <Badge variant={pass.state === 'APPROVED' ? 'default' : 'secondary'}>
              {pass.state}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Departure Time</p>
              <p className="font-medium">{new Date(pass.departureTime).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expected Return</p>
              <p className="font-medium">{new Date(pass.expectedReturn).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Hostel</p>
              <p className="font-medium">{pass.hostelName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Emergency</p>
              <p className="font-medium">{pass.isEmergency ? 'Yes' : 'No'}</p>
            </div>
          </div>

          {pass.approvedBy && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <p className="font-medium">{t('approved')}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                By {pass.approvedBy} on {new Date(pass.approvedAt!).toLocaleString()}
              </p>
            </div>
          )}

          {pass.rejectionReason && (
            <Alert variant="destructive">
              <AlertDescription>
                <strong>Rejection Reason:</strong> {pass.rejectionReason}
              </AlertDescription>
            </Alert>
          )}

          {pass.state === 'APPROVED' && !pass.adUnlocked && (
            <div className="border-t pt-4">
              <Alert className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You must watch a 20-second ad to unlock your QR code. This cannot be skipped.
                </AlertDescription>
              </Alert>
              <Button onClick={handleUnlockQR} className="w-full" size="lg" disabled={unlocking}>
                <QrCode className="mr-2 h-5 w-5" />
                Unlock QR Code (Watch 20s Ad)
              </Button>
            </div>
          )}

          {pass.adUnlocked && qrDataUrl && (
            <div className="border-t pt-4">
              <div className="bg-white p-6 rounded-lg border text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Show this QR code to the gateman
                </p>
                <img src={qrDataUrl} alt="Gate Pass QR" className="mx-auto max-w-sm" />
                <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                  <Button asChild variant="outline" size="sm">
                    <a href={qrDataUrl} download={`gatepass-${pass.id}.png`}>Download QR</a>
                  </Button>
                  <Button variant="outline" size="sm" onClick={async () => {
                    try { await navigator.clipboard.writeText(qrDataUrl); toast.success('QR copied'); } catch { toast.error('Copy failed'); }
                  }}>Copy QR</Button>
                  <Button variant="outline" size="sm" onClick={async () => {
                    try {
                      if (navigator.share) {
                        await navigator.share({ title: 'Gate Pass QR', text: `Gate Pass ${pass.id}`, url: qrDataUrl });
                      } else {
                        await navigator.clipboard.writeText(qrDataUrl);
                        toast.success('Copied QR to clipboard');
                      }
                    } catch {}
                  }}>Share</Button>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Valid for 120 seconds • Pass ID: {pass.id}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AdGate
        open={showAdGate}
        onComplete={handleAdComplete}
        gatePassId={pass.id}
      />
    </div>
  );
}
