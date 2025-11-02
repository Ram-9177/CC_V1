import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Textarea } from '../../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { HallticketChip } from '../../HallticketChip';
import { HighSearch, SearchResult } from '../../HighSearch';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { t } from '../../../lib/i18n';
import { GatePass } from '../../../lib/types';
import { hasBackend } from '../../../lib/config';
import { searchUsersLite } from '../../../lib/search';
import { approveGatePass, listGatePasses, rejectGatePass } from '../../../lib/gate-passes';
import { useSocketEvent } from '../../../lib/socket';

export function ApprovalsScreen() {
  const [passes, setPasses] = useState<GatePass[]>([]);
  const [selectedPass, setSelectedPass] = useState<GatePass | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const fetchPasses = useCallback(async () => {
    try {
      if (!hasBackend()) return;
      const arr = await listGatePasses();
      setPasses(arr);
    } catch {}
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => { if (mounted) await fetchPasses(); })();
    return () => { mounted = false; };
  }, [fetchPasses]);

  // Realtime refresh on gate-pass events
  useSocketEvent('gate-pass:created', fetchPasses, true);
  useSocketEvent('gate-pass:approved', fetchPasses, true);
  useSocketEvent('gate-pass:rejected', fetchPasses, true);
  useSocketEvent('gate-pass:revoked', fetchPasses, true);

  const pendingPasses = passes.filter(p => p.state === 'SUBMITTED');

  const handleAction = (pass: GatePass, action: 'approve' | 'reject') => {
    setSelectedPass(pass);
    setActionType(action);
    setRejectionReason('');
  };

  const handleConfirm = async () => {
    if (!selectedPass || !actionType) return;
    try {
      if (actionType === 'approve') {
        await approveGatePass(selectedPass.id);
      } else {
        await rejectGatePass(selectedPass.id, rejectionReason);
      }
      // remove from pending list upon success
      setPasses(prev => prev.filter(p => p.id !== selectedPass.id));
    } catch {}
    setSelectedPass(null);
    setActionType(null);
  };

  const handleSearch = async (query: string) => {
    if (!query) return setSearchResults([]);
    if (hasBackend()) {
      try {
        const users = await searchUsersLite(query, 10);
        setSearchResults(users.map(u => ({
          hallticket: u.hallticket,
          name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.hallticket,
          userId: u.id,
          room: u.roomNumber ? `${u.hostelBlock || ''}-${u.roomNumber}`.replace(/^-/,'') : undefined,
          hostel: u.hostelBlock,
          phone: u.phoneNumber,
          tags: [u.role],
        })));
        return;
      } catch (e) {}
    }
    setSearchResults([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Gate Pass Approvals</h1>
        <p className="text-muted-foreground">Review and approve/reject gate pass requests</p>
      </div>

      <HighSearch
        placeholder="Search students by hallticket, name, room..."
        onSearch={handleSearch}
        results={searchResults}
        onSelect={(result) => console.log('Selected:', result)}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{pendingPasses.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Approved Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-green-600 dark:text-green-400">
              {passes.filter(p => p.state === 'APPROVED').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rejected Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600 dark:text-red-400">
              {passes.filter(p => p.state === 'REJECTED').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingPasses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending approvals</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingPasses.map((pass) => (
                <div key={pass.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3 gap-4">
                    <div className="flex-1">
                      <HallticketChip hallticket={pass.hallticket} name={pass.studentName} />
                      <div className="mt-2">
                        <h3 className="font-medium">{pass.reason}</h3>
                        <p className="text-sm text-muted-foreground">{pass.destination}</p>
                      </div>
                    </div>
                    <Badge variant={pass.isEmergency ? 'destructive' : 'secondary'}>
                      {pass.isEmergency ? 'EMERGENCY' : 'NORMAL'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-sm">
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

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAction(pass, 'approve')}
                      className="flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleAction(pass, 'reject')}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedPass} onOpenChange={() => setSelectedPass(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve' : 'Reject'} Gate Pass
            </DialogTitle>
          </DialogHeader>

          {selectedPass && (
            <div className="space-y-4">
              <div>
                <HallticketChip hallticket={selectedPass.hallticket} name={selectedPass.studentName} />
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedPass.reason} • {selectedPass.destination}
                </p>
              </div>

              {actionType === 'reject' && (
                <div>
                  <label className="text-sm font-medium">Rejection Reason</label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Please provide a reason for rejection..."
                    className="mt-2"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPass(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={actionType === 'reject' && !rejectionReason.trim()}
              variant={actionType === 'approve' ? 'default' : 'destructive'}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
