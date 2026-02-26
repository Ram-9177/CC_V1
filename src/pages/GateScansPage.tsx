import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QrCode, Plus, Search, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { getApiErrorMessage, cn } from '@/lib/utils';
import { useRealtimeQuery } from '@/hooks/useWebSocket';

interface GateScan {
  id: number;
  student: number;
  student_name?: string;
  student_photo?: string;
  student_room?: string;
  direction: 'in' | 'out';
  scan_time: string;
  qr_code: string;
  location: string;
  verified: boolean;
}

export default function GateScansPage() {
  useRealtimeQuery('gate_scan_logged', 'gate-scans');

  const [directionFilter, setDirectionFilter] = useState<'all' | 'in' | 'out'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    student_id: '',
    direction: 'in',
    qr_code: '',
    location: 'Main Gate',
  });

  const user = useAuthStore((state) => state.user);
  // Gate security, security head, and admins have authority to log scans.
  // Wardens can view the logs but not perform the action.
  const canLogScans = ['gate_security', 'security_head', 'admin', 'super_admin'].includes(
    user?.role || ''
  );
  const queryClient = useQueryClient();

  const { data: scans, isLoading } = useQuery<GateScan[]>({
    queryKey: ['gate-scans'],
    queryFn: async () => {
      const response = await api.get('/gate-scans/');
      return response.data.results || response.data;
    },
  });

  const logMutation = useMutation({
    mutationFn: async () => {
      await api.post('/gate-scans/log_scan/', {
        student_id: formData.student_id,
        direction: formData.direction,
        qr_code: formData.qr_code,
        location: formData.location,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-scans'] });
      toast.success('Gate scan logged');
      setCreateDialogOpen(false);
      setFormData({ student_id: '', direction: 'in', qr_code: '', location: 'Main Gate' });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to log gate scan'));
    },
  });

  const filteredScans = useMemo(() => {
    if (!scans) return [];
    return scans.filter((scan) => {
      if (directionFilter !== 'all' && scan.direction !== directionFilter) return false;
      if (!searchQuery) return true;
      const term = searchQuery.toLowerCase();
      return (
        scan.student_name?.toLowerCase().includes(term) ||
        scan.student_room?.toLowerCase().includes(term) ||
        String(scan.student).includes(term)
      );
    });
  }, [scans, directionFilter, searchQuery]);

  const getDirectionBadge = (direction: 'in' | 'out') => {
    return direction === 'in' ? (
      <Badge className="bg-secondary text-black border border-primary/20 font-bold">Entry</Badge>
    ) : (
      <Badge className="bg-primary text-foreground border-0 font-bold">Exit</Badge>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <QrCode className="h-8 w-8" />
            Gate Scans
          </h1>
          <p className="text-muted-foreground">Track gate entry and exit scans</p>
        </div>
        {canLogScans && (
          <Button onClick={() => setCreateDialogOpen(true)} className="bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/30 hover:shadow-md smooth-transition rounded-lg active:scale-95 transition-all">
            <Plus className="h-4 w-4 mr-2" />
            Log Scan
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by student name, hall ticket, or reg no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={directionFilter} onValueChange={(value) => setDirectionFilter(value as 'all' | 'in' | 'out')}>
            <SelectTrigger>
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Directions</SelectItem>
              <SelectItem value="in">Entry</SelectItem>
              <SelectItem value="out">Exit</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading scans...</div>
          ) : filteredScans.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Scan Time</TableHead>
                      <TableHead>Verified</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredScans.map((scan) => (
                      <TableRow key={scan.id}>
                        <TableCell>
                          <div className="font-medium">{scan.student_name || `ID ${scan.student}`}</div>
                          <div className="text-sm text-muted-foreground">
                            Room: {scan.student_room || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>{getDirectionBadge(scan.direction)}</TableCell>
                        <TableCell>{scan.location || 'Main Gate'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(scan.scan_time).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {scan.verified ? (
                            <Badge className="bg-primary/20 text-black border border-primary/30 font-bold">Verified</Badge>
                          ) : (
                            <Badge className="bg-black text-white border-0 font-bold">Unverified</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List View */}
              <div className="lg:hidden space-y-4">
                {filteredScans.map((scan) => (
                  <Card key={scan.id} className="overflow-hidden border shadow-sm rounded-2xl bg-card">
                    <CardHeader className="p-4 bg-muted/20 border-b">
                       <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                             <div className={cn(
                                 "p-2 rounded-xl shadow-sm",
                               scan.direction === 'in' ? "bg-secondary text-foreground" : "bg-primary text-foreground"
                             )}>
                                <QrCode className="h-4 w-4" />
                              </div>
                             <div>
                                <div className="font-bold text-sm leading-tight">{scan.student_name || `ID ${scan.student}`}</div>
                                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Room: {scan.student_room || 'N/A'}</div>
                             </div>
                          </div>
                          {getDirectionBadge(scan.direction)}
                       </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                       <div className="flex justify-between items-center text-xs">
                          <div className="space-y-1">
                             <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Time & Location</p>
                             <div className="font-semibold flex items-center gap-1.5 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {new Date(scan.scan_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                <span className="mx-1">·</span>
                                {scan.location || 'Main Gate'}
                             </div>
                          </div>
                          <div className="text-right space-y-1">
                             <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Status</p>
                             {scan.verified ? (
                                <Badge className="bg-primary/20 text-black border border-primary/30 h-5 px-2 text-[10px] font-bold">Verified</Badge>
                             ) : (
                                <Badge className="bg-black text-white border-0 h-5 px-2 text-[10px] font-bold">Unverified</Badge>
                             )}
                          </div>
                       </div>
                       
                       <div className="pt-2 border-t border-muted/50">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">QR Data</p>
                          <p className="text-[10px] font-mono text-muted-foreground break-all bg-muted/30 p-2 rounded-lg">
                             {scan.qr_code}
                          </p>
                       </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No scans found</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Gate Scan</DialogTitle>
            <DialogDescription>Record a new gate scan entry.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              logMutation.mutate();
            }}
          >
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="student_id">Student ID *</Label>
                <Input
                  id="student_id"
                  value={formData.student_id}
                  onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Direction *</Label>
                <Select
                  value={formData.direction}
                  onValueChange={(value) => setFormData({ ...formData, direction: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Entry</SelectItem>
                    <SelectItem value="out">Exit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qr_code">QR Code *</Label>
                <Input
                  id="qr_code"
                  value={formData.qr_code}
                  onChange={(e) => setFormData({ ...formData, qr_code: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={logMutation.isPending} className="primary-gradient text-white font-semibold hover:opacity-90 smooth-transition">
                Log Scan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
