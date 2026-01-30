import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QrCode, Plus, Search } from 'lucide-react';
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
import { getApiErrorMessage } from '@/lib/utils';

interface GateScan {
  id: number;
  student: number;
  student_details?: {
    id: number;
    name: string;
    hall_ticket?: string;
    registration_number?: string;
  };
  direction: 'in' | 'out';
  scan_time: string;
  qr_code: string;
  location: string;
  verified: boolean;
}

export default function GateScansPage() {
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
  const isGateStaff = user?.role === 'staff' || user?.role === 'admin';
  const queryClient = useQueryClient();

  const { data: scans, isLoading } = useQuery<GateScan[]>({
    queryKey: ['gate-scans'],
    queryFn: async () => {
      const response = await api.get('/gate-scans/gate-scans/');
      return response.data.results || response.data;
    },
  });

  const logMutation = useMutation({
    mutationFn: async () => {
      await api.post('/gate-scans/gate-scans/log_scan/', {
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
    onError: (error: any) => {
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
        scan.student_details?.name?.toLowerCase().includes(term) ||
        scan.student_details?.hall_ticket?.toLowerCase().includes(term) ||
        scan.student_details?.registration_number?.toLowerCase().includes(term)
      );
    });
  }, [scans, directionFilter, searchQuery]);

  const getDirectionBadge = (direction: 'in' | 'out') => {
    return direction === 'in' ? (
      <Badge className="bg-green-100 text-green-800">Entry</Badge>
    ) : (
      <Badge className="bg-blue-100 text-blue-800">Exit</Badge>
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
        {isGateStaff && (
          <Button onClick={() => setCreateDialogOpen(true)}>
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
            <div className="overflow-x-auto">
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
                        <div className="font-medium">{scan.student_details?.name || `ID ${scan.student}`}</div>
                        <div className="text-sm text-muted-foreground">
                          Hall Ticket: {scan.student_details?.hall_ticket || ''}
                        </div>
                      </TableCell>
                      <TableCell>{getDirectionBadge(scan.direction)}</TableCell>
                      <TableCell>{scan.location || 'Main Gate'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(scan.scan_time).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {scan.verified ? (
                          <Badge className="bg-green-100 text-green-800">Verified</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">Unverified</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
              <Button type="submit" disabled={logMutation.isPending}>
                Log Scan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
