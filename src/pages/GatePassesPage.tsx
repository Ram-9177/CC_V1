
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Filter, Search, QrCode, AlertCircle, Calendar, Clock,
  Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { validateGatePassForm, sanitizeInput, GatePassFormData } from '@/lib/validation';

interface GatePass {
  id: number;
  student_id: number;
  student_name: string;
  student_hall_ticket: string;
  student_room?: string;
  pass_type?: 'day' | 'overnight' | 'weekend' | 'emergency';
  purpose: string;
  exit_date: string | null;
  exit_time: string | null;
  expected_return_date: string | null;
  expected_return_time: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'used' | 'expired';
  approved_by?: string;
  created_at: string;
  remarks?: string;
  qr_code?: string;
}

export default function GatePassesPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTicket, setSearchTicket] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    pass_type: 'day' as 'day' | 'overnight' | 'weekend' | 'emergency',
    purpose: '',
    destination: '',
    exit_date: '',
    exit_time: '',
    expected_return_date: '',
    expected_return_time: '',
    remarks: '',
  });
  const [selectedQR, setSelectedQR] = useState<{ id: number; code: string } | null>(null);

  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const isAuthority = ['admin', 'super_admin', 'warden', 'head_warden'].includes(user?.role || '');
  const isSecurity = ['gate_security', 'security_head'].includes(user?.role || '');
  const canCreate = user?.role === 'student';

  const [page, setPage] = useState(1);

  const { data: queryData, isLoading, isError } = useQuery({
    queryKey: ['gate-passes', statusFilter, searchTicket, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchTicket) params.append('hall_ticket', searchTicket);

      const response = await api.get(`/gate-passes/?${params.toString()}`);
      return response.data;
    },
    placeholderData: (previousData) => previousData, // smooth transitions
  });

  const gatePasses: GatePass[] = queryData?.results || (Array.isArray(queryData) ? queryData : []);
  const totalCount = queryData?.count || 0;
  const hasNextPage = !!queryData?.next;


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
        pass_type: 'day',
        purpose: '',
        destination: '',
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

  const verifyMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: 'check_out' | 'check_in' }) => {
      await api.post(`/gate-passes/${id}/verify/`, { action });
    },
    onSuccess: () => {
      toast.success('Pass verified successfully');
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Verification failed'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data
    const validation = validateGatePassForm(formData as GatePassFormData);
    if (!validation.isValid) {
      // Set error messages
      const errors: Record<string, string> = {};
      validation.errors.forEach(err => {
        errors[err.field] = err.message;
      });
      setFormErrors(errors);
      
      // Show first error as toast
      const firstError = validation.errors[0];
      if (firstError) {
        toast.error(firstError.message);
      }
      return;
    }
    
    // Clear previous errors
    setFormErrors({});
    
    // Sanitize input data
    const sanitizedData = {
      ...formData,
      purpose: sanitizeInput(formData.purpose),
      destination: sanitizeInput(formData.destination),
      remarks: sanitizeInput(formData.remarks),
    };
    
    createMutation.mutate(sanitizedData);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-amber-500 text-white border-0 shadow-sm font-semibold">⏳ Pending</Badge>;
      case 'approved':
        return <Badge className="bg-emerald-600 text-white border-0 shadow-sm font-semibold">✓ Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500 text-white border-0 shadow-sm font-semibold">✕ Rejected</Badge>;
      case 'used':
        return <Badge className="bg-slate-700 text-white border-0 shadow-sm font-semibold">📍 Out</Badge>;
      case 'expired':
        return <Badge className="bg-slate-200 text-slate-700 border-0 shadow-sm font-semibold">⏱ Expired</Badge>;
      default:
        return <Badge className="bg-slate-500/90 text-white border-0 font-semibold">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-xl p-4 border border-border shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <FileText className="h-6 w-6" />
            </div>
            <span className="text-foreground">Gate Passes</span>
          </h1>
          <p className="text-sm text-muted-foreground">Manage & track student exit requests</p>
        </div>
        {canCreate && (
          <Button 
            onClick={() => setCreateDialogOpen(true)}
            className="bg-primary text-primary-foreground font-semibold h-10 hover:bg-primary/90 shadow-sm hover:shadow transition-all rounded-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Gate Pass
          </Button>
        )}
        {isAuthority && (
             <Button
                variant="outline"
                onClick={async () => {
                  try {
                     toast.info('Downloading CSV...');
                     await import('@/lib/api').then(m => m.downloadFile('/gate-passes/export_csv/', 'gate_passes.csv'));
                     toast.success('Download complete');
                  } catch (e) {
                      toast.error('Failed to download CSV');
                  }
                }}
                className="ml-2 border-slate-200 text-slate-700 hover:bg-slate-50"
             >
                <FileText className="h-4 w-4 mr-2" />
                Export CSV
             </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Filter className="h-5 w-5 text-muted-foreground" />
            Filter & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Hall Ticket..."
              value={searchTicket}
              onChange={(e) => setSearchTicket(e.target.value)}
              className="pl-9 bg-background border-input focus:border-primary rounded-lg"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-64 border-input focus:border-primary rounded-lg bg-background">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">🔵 All Status</SelectItem>
              <SelectItem value="pending">⏳ Pending</SelectItem>
              <SelectItem value="approved">✅ Approved</SelectItem>
              <SelectItem value="rejected">❌ Rejected</SelectItem>
              <SelectItem value="used">📍 Out/Used</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Gate Passes Container */}
      <Card className="border border-border shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border-b">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="p-6 bg-destructive/10 border-t border-destructive/20 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-destructive text-lg">Failed to load gate passes</p>
                  <p className="text-sm text-destructive/80 mt-1">Please try again later or contact support</p>
                </div>
              </div>
            </div>
          ) : gatePasses && gatePasses.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
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
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gatePasses.map((gatePass) => (
                      <TableRow key={gatePass.id}>
                        <TableCell>
                          <div className="font-medium">{gatePass.student_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {gatePass.student_hall_ticket}
                          </div>
                        </TableCell>
                        <TableCell>{gatePass.student_room || 'N/A'}</TableCell>
                        <TableCell className="max-w-xs truncate">{gatePass.purpose}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3" />
                            {gatePass.exit_date ? new Date(gatePass.exit_date).toLocaleDateString() : '—'}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {gatePass.exit_time || '—'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3" />
                            {gatePass.expected_return_date ? new Date(gatePass.expected_return_date).toLocaleDateString() : '—'}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {gatePass.expected_return_time || '—'}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(gatePass.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(gatePass.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                             {gatePass.status === 'approved' && !isAuthority && !isSecurity && (
                                <Button
                                  size="sm"
                                  className="h-8 bg-slate-800 hover:bg-primary text-white shadow-sm transition-all"
                                  onClick={() => setSelectedQR({ id: gatePass.id, code: gatePass.qr_code || '' })}
                                >
                                  <QrCode className="h-4 w-4 mr-1.5" />
                                  QR
                                </Button>
                              )}
                            {isAuthority && gatePass.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  title="Approve"
                                  className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
                                  onClick={() => approveMutation.mutate(gatePass.id)}
                                  disabled={approveMutation.isPending}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  title="Reject"
                                  className="h-8 w-8 p-0 bg-destructive hover:bg-destructive/90 text-white shadow-sm transition-all"
                                  onClick={() => rejectMutation.mutate(gatePass.id)}
                                  disabled={rejectMutation.isPending}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {isSecurity && gatePass.status === 'approved' && (
                               <Button
                                 size="sm"
                                 className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
                                 onClick={() => {
                                   verifyMutation.mutate({ id: gatePass.id, action: 'check_out' });
                                 }}
                                 disabled={verifyMutation.isPending}
                               >
                                 Check OUT
                               </Button>
                            )}
                            {isSecurity && gatePass.status === 'used' && (
                               <Button
                                 size="sm"
                                 className="h-8 bg-slate-800 hover:bg-slate-900 text-white shadow-sm transition-all"
                                 onClick={() => verifyMutation.mutate({ id: gatePass.id, action: 'check_in' })}
                                 disabled={verifyMutation.isPending}
                               >
                                 Check IN
                               </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List View */}
              <div className="lg:hidden space-y-4">
                {gatePasses.map((gatePass) => (
                  <Card key={gatePass.id} className="overflow-hidden border border-slate-200 shadow-sm rounded-lg bg-white hover:shadow-md transition-all">
                    <CardHeader className="p-3 bg-slate-50 border-b border-slate-200">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="font-semibold text-sm text-slate-900">{gatePass.student_name}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{gatePass.student_hall_ticket}</div>
                        </div>
                        {getStatusBadge(gatePass.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 space-y-2">
                      {/* Exit & Return Row */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-muted/50 p-2.5 rounded-lg border border-border">
                          <p className="text-[9px] font-bold text-muted-foreground mb-1">EXIT</p>
                          <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {gatePass.exit_date ? new Date(gatePass.exit_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{gatePass.exit_time || '—'}</div>
                        </div>
                        <div className="bg-muted/50 p-2.5 rounded-lg border border-border">
                          <p className="text-[9px] font-bold text-muted-foreground mb-1">RETURN</p>
                          <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {gatePass.expected_return_date ? new Date(gatePass.expected_return_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{gatePass.expected_return_time || '—'}</div>
                        </div>
                      </div>
                      
                      {/* Purpose */}
                      <div className="bg-muted/50 p-2.5 rounded-lg border border-border">
                        <p className="text-[9px] font-bold text-muted-foreground mb-1">PURPOSE</p>
                        <p className="text-xs text-foreground line-clamp-2">
                          {gatePass.purpose || "—"}
                        </p>
                      </div>

                        {gatePass.status === 'approved' && !isAuthority && !isSecurity && (
                           <Button
                              className="w-full mt-2 rounded-lg bg-foreground text-background font-semibold h-9 hover:bg-primary shadow-md hover:shadow-lg transition-all"
                              onClick={() => setSelectedQR({ id: gatePass.id, code: gatePass.qr_code || '' })}
                            >
                              <QrCode className="h-4 w-4 mr-2" />
                              Show QR Code
                            </Button>
                        )}

                      {isAuthority && gatePass.status === 'pending' && (
                        <div className="flex gap-2 pt-2">
                            <Button
                              className="flex-1 rounded-lg bg-foreground text-background font-semibold h-9 text-sm hover:bg-muted-foreground shadow-md hover:shadow-lg transition-all"
                              onClick={() => approveMutation.mutate(gatePass.id)}
                              disabled={approveMutation.isPending}
                            >
                              ✓ Approve
                            </Button>
                            <Button
                              className="flex-1 rounded-lg bg-primary text-primary-foreground font-semibold h-9 text-sm hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                              onClick={() => rejectMutation.mutate(gatePass.id)}
                              disabled={rejectMutation.isPending}
                            >
                              ✕ Reject
                            </Button>
                        </div>
                      )}

                        {isSecurity && gatePass.status === 'approved' && (
                           <Button
                              className="w-full mt-2 rounded-lg bg-foreground text-background font-semibold h-9 hover:bg-primary shadow-md hover:shadow-lg transition-all"
                               onClick={() => {
                                 verifyMutation.mutate({ id: gatePass.id, action: 'check_out' });
                               }}
                              disabled={verifyMutation.isPending}
                            >
                              📤 Check OUT
                            </Button>
                        )}

                        {isSecurity && gatePass.status === 'used' && (
                           <Button
                              className="w-full mt-2 rounded-lg bg-foreground text-background font-semibold h-9 hover:bg-muted-foreground shadow-md hover:shadow-lg transition-all"
                              onClick={() => verifyMutation.mutate({ id: gatePass.id, action: 'check_in' })}
                              disabled={verifyMutation.isPending}
                            >
                              📥 Check IN
                            </Button>
                        )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 bg-muted/20 border border-dashed border-border rounded-lg">
              <FileText className="h-14 w-14 text-muted-foreground/50 mb-4" />
              <p className="text-foreground font-semibold text-lg mb-2">No gate passes yet</p>
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                {canCreate 
                  ? "Create your first gate pass to request exit from the hostel" 
                  : "No gate passes match your search criteria"}
              </p>
            </div>
          )}
        </CardContent>
        
        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <div className="text-xs font-medium text-slate-500">
                Page {page} • {totalCount || 0} items
            </div>
            <div className="flex gap-2">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || isLoading}
                    className="h-8 px-3 text-xs"
                >
                    Previous
                </Button>
                <div className="flex items-center justify-center px-2 min-w-[2rem] text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded h-8">
                    {page}
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => p + 1)}
                    disabled={!hasNextPage || isLoading}
                    className="h-8 px-3 text-xs"
                >
                    Next
                </Button>
            </div>
        </div>
      </Card>

      {/* Create Gate Pass Dialog */}
      {canCreate && (
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl rounded-xl bg-card border border-border shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-primary/5 text-primary p-2 rounded-t-lg">Request Gate Pass</DialogTitle>
            <DialogDescription className="text-slate-600 text-sm">
              Fill in all required details for your exit request
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="purpose" className="font-semibold text-slate-900">Purpose of Visit *</Label>
                <Textarea
                  id="purpose"
                  placeholder="Where are you going and why? (e.g., Home, Hospital visit, etc.)"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className={`border-input focus:border-primary ${formErrors.purpose ? 'border-destructive' : ''}`}
                  required
                />
                {formErrors.purpose && (
                  <p className="text-xs text-destructive font-semibold">⚠️ {formErrors.purpose}</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-semibold text-slate-900">Pass Type *</Label>
                  <Select
                    value={formData.pass_type}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        pass_type: value as 'day' | 'overnight' | 'weekend' | 'emergency',
                      })
                    }
                  >
                    <SelectTrigger className="border-input focus:border-foreground">
                      <SelectValue placeholder="Select pass type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">☀️ Day Pass</SelectItem>
                      <SelectItem value="overnight">🌙 Overnight</SelectItem>
                      <SelectItem value="weekend">🏖️ Weekend</SelectItem>
                      <SelectItem value="emergency">🚨 Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="destination" className="font-semibold text-slate-900">Destination *</Label>
                  <Input
                    id="destination"
                    placeholder="City/Place name"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    className={`border-input focus:border-primary ${formErrors.destination ? 'border-destructive' : ''}`}
                    required
                  />
                  {formErrors.destination && (
                    <p className="text-xs text-destructive font-semibold">⚠️ {formErrors.destination}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exit_date" className="font-semibold text-slate-900">Exit Date *</Label>
                  <Input
                    id="exit_date"
                    type="date"
                    value={formData.exit_date}
                    onChange={(e) => setFormData({ ...formData, exit_date: e.target.value })}
                    className={`border-input focus:border-foreground ${formErrors.exit_date ? 'border-primary' : ''}`}
                    required
                  />
                  {formErrors.exit_date && (
                    <p className="text-xs text-primary font-semibold">⚠️ {formErrors.exit_date}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exit_time" className="font-semibold text-slate-900">Exit Time *</Label>
                  <Input
                    id="exit_time"
                    type="time"
                    value={formData.exit_time}
                    onChange={(e) => setFormData({ ...formData, exit_time: e.target.value })}
                    className={`border-input focus:border-foreground ${formErrors.exit_time ? 'border-primary' : ''}`}
                    required
                  />
                  {formErrors.exit_time && (
                    <p className="text-xs text-primary font-semibold">⚠️ {formErrors.exit_time}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="return_date" className="font-semibold text-slate-900">Expected Return Date *</Label>
                  <Input
                    id="return_date"
                    type="date"
                    value={formData.expected_return_date}
                    onChange={(e) =>
                      setFormData({ ...formData, expected_return_date: e.target.value })
                    }
                    className={`border-input focus:border-foreground ${formErrors.expected_return_date ? 'border-primary' : ''}`}
                    required
                  />
                  {formErrors.expected_return_date && (
                    <p className="text-xs text-primary font-semibold">⚠️ {formErrors.expected_return_date}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="return_time" className="font-semibold text-slate-900">Expected Return Time *</Label>
                  <Input
                    id="return_time"
                    type="time"
                    value={formData.expected_return_time}
                    onChange={(e) =>
                      setFormData({ ...formData, expected_return_time: e.target.value })
                    }
                    className={`border-input focus:border-primary ${formErrors.expected_return_time ? 'border-destructive' : ''}`}
                    required
                  />
                  {formErrors.expected_return_time && (
                    <p className="text-xs text-destructive font-semibold">⚠️ {formErrors.expected_return_time}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="remarks" className="font-semibold text-slate-900">Additional Notes</Label>
                <Textarea
                  id="remarks"
                  placeholder="Any additional information (optional)"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="border-input focus:border-primary"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-lg border-input hover:bg-muted transition-colors"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="rounded-lg bg-primary text-primary-foreground font-semibold hover:shadow-lg hover:shadow-primary/20 transition-all"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? '⏳ Creating...' : '✓ Create Gate Pass'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}

      {/* QR Code Viewer Dialog */}
      <Dialog open={!!selectedQR} onOpenChange={(open) => !open && setSelectedQR(null)}>
        <DialogContent className="sm:max-w-md rounded-xl bg-card border border-border shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold text-primary">Gate Pass QR Code</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground text-sm">
              Show this to security for scanning at the gate
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 space-y-4">
            <div className="relative p-6 bg-white rounded-lg border-2 border-border shadow-md">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${selectedQR?.code}`}
                alt="Gate Pass QR"
                  className="w-48 h-48"
                />
              </div>
            <div className="text-center space-y-2 w-full">
              <p className="text-xs font-mono text-slate-600 uppercase tracking-wide">Pass Token</p>
              <p className="font-semibold text-sm text-slate-900 break-all font-mono">{selectedQR?.code}</p>
            </div>
              <Badge className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0 text-xs font-semibold shadow-md">
                ✓ Valid for Scanning
              </Badge>
          </div>
          <DialogFooter>
            <Button className="w-full rounded-2xl h-12 font-bold bg-primary text-primary-foreground hover:shadow-lg transition-all" onClick={() => setSelectedQR(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
