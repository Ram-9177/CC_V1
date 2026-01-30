import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Check, X, Calendar, Clock, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
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
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

interface GatePass {
  id: number;
  student: {
    id: number;
    name: string;
    hall_ticket?: string;
    username?: string;
    room_number?: string;
  };
  purpose: string;
  exit_date: string;
  exit_time: string;
  expected_return_date: string;
  expected_return_time: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  created_at: string;
  remarks?: string;
}

export default function GatePassesPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    purpose: '',
    exit_date: '',
    exit_time: '',
    expected_return_date: '',
    expected_return_time: '',
    remarks: '',
  });

  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const isWarden = user?.role === 'staff' || user?.role === 'admin';

  const { data: gatePasses, isLoading } = useQuery<GatePass[]>({
    queryKey: ['gate-passes', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await api.get(`/gate-passes/?${params.toString()}`);
      return response.data.results || response.data;
    },
  });

  // Real-time updates for gate passes
  useRealtimeQuery('gatepass_created', 'gate-passes');
  useRealtimeQuery('gatepass_approved', 'gate-passes');
  useRealtimeQuery('gatepass_rejected', 'gate-passes');
  useRealtimeQuery('gatepass_updated', 'gate-passes');

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      await api.post('/gate-passes/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
      toast.success('Gate pass created successfully');
      setCreateDialogOpen(false);
      setFormData({
        purpose: '',
        exit_date: '',
        exit_time: '',
        expected_return_date: '',
        expected_return_time: '',
        remarks: '',
      });
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to create gate pass'));
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/gate-passes/${id}/approve/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
      toast.success('Gate pass approved');
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to approve gate pass'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/gate-passes/${id}/reject/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
      toast.success('Gate pass rejected');
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to reject gate pass'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Gate Passes
          </h1>
          <p className="text-muted-foreground">Manage student gate passes</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Gate Pass
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Gate Passes Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading gate passes...
            </div>
          ) : gatePasses && gatePasses.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Exit Date & Time</TableHead>
                    <TableHead>Return Date & Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                    {isWarden && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gatePasses.map((gatePass) => (
                    <TableRow key={gatePass.id}>
                      <TableCell>
                        <div className="font-medium">{gatePass.student.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {gatePass.student.hall_ticket || gatePass.student.username || '—'}
                        </div>
                      </TableCell>
                      <TableCell>{gatePass.student.room_number || 'N/A'}</TableCell>
                      <TableCell className="max-w-xs truncate">{gatePass.purpose}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {new Date(gatePass.exit_date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {gatePass.exit_time}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {new Date(gatePass.expected_return_date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {gatePass.expected_return_time}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(gatePass.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(gatePass.created_at).toLocaleDateString()}
                      </TableCell>
                      {isWarden && (
                        <TableCell>
                          {gatePass.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600"
                                onClick={() => approveMutation.mutate(gatePass.id)}
                                disabled={approveMutation.isPending}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                                onClick={() => rejectMutation.mutate(gatePass.id)}
                                disabled={rejectMutation.isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No gate passes found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Gate Pass Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Gate Pass</DialogTitle>
            <DialogDescription>Fill in the details for your gate pass request</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="purpose">Purpose *</Label>
                <Textarea
                  id="purpose"
                  placeholder="Enter purpose of visit"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exit_date">Exit Date *</Label>
                  <Input
                    id="exit_date"
                    type="date"
                    value={formData.exit_date}
                    onChange={(e) => setFormData({ ...formData, exit_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exit_time">Exit Time *</Label>
                  <Input
                    id="exit_time"
                    type="time"
                    value={formData.exit_time}
                    onChange={(e) => setFormData({ ...formData, exit_time: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="return_date">Expected Return Date *</Label>
                  <Input
                    id="return_date"
                    type="date"
                    value={formData.expected_return_date}
                    onChange={(e) =>
                      setFormData({ ...formData, expected_return_date: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="return_time">Expected Return Time *</Label>
                  <Input
                    id="return_time"
                    type="time"
                    value={formData.expected_return_time}
                    onChange={(e) =>
                      setFormData({ ...formData, expected_return_time: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="remarks">Additional Remarks</Label>
                <Textarea
                  id="remarks"
                  placeholder="Any additional information"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Gate Pass'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
