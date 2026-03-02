import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, CheckCircle2, Clock, XCircle, CalendarDays, FileText, Ban,
  ChevronDown, Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { isStaff, isWarden, isAdmin } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ───────────────────────────────────────────────────────────────────
interface LeaveApplication {
  id: number;
  student: number;
  student_details?: {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    registration_number?: string;
  };
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  parent_informed: boolean;
  parent_contact?: string;
  destination?: string;
  contact_during_leave?: string;
  attachment_url?: string;
  notes?: string;
  duration_days: number;
  created_at: string;
}

interface LeaveStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  currently_on_leave: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const LEAVE_TYPES = [
  { value: 'sick', label: 'Sick Leave' },
  { value: 'personal', label: 'Personal Leave' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'emergency', label: 'Emergency Leave' },
  { value: 'academic', label: 'Academic Leave' },
  { value: 'family', label: 'Family Event' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: Ban },
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function LeavesPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? null;
  const isStaffUser = isStaff(role) || isWarden(role) || isAdmin(role);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailLeave, setDetailLeave] = useState<LeaveApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── Form state ──
  const [form, setForm] = useState({
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: '',
    destination: '',
    parent_contact: '',
    contact_during_leave: '',
    parent_informed: false,
  });

  // ── Queries ──
  const { data: leaves = [], isLoading } = useQuery<LeaveApplication[]>({
    queryKey: ['leaves', tab],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (tab !== 'all') params.status = tab;
      const res = await api.get('/leaves/', { params });
      return res.data.results ?? res.data;
    },
  });

  useRealtimeQuery('leave_created', ['leaves', 'leave-stats']);
  useRealtimeQuery('leave_updated', ['leaves', 'leave-stats']);
  useRealtimeQuery('leave_approved', ['leaves', 'leave-stats']);
  useRealtimeQuery('leave_rejected', ['leaves', 'leave-stats']);

  const { data: stats } = useQuery<LeaveStats>({
    queryKey: ['leave-stats'],
    queryFn: async () => {
      const res = await api.get('/leaves/stats/');
      return res.data;
    },
  });

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/leaves/', data),
    onSuccess: () => {
      toast.success('Leave application submitted successfully!');
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leave-stats'] });
      setCreateOpen(false);
      setForm({ leave_type: '', start_date: '', end_date: '', reason: '', destination: '', parent_contact: '', contact_during_leave: '', parent_informed: false });
    },
    onError: (err: { response?: { data?: { detail?: string; non_field_errors?: string[] } } }) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.non_field_errors?.[0] || 'Failed to submit leave application';
      toast.error(msg);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => api.post(`/leaves/${id}/approve/`),
    onSuccess: () => {
      toast.success('Leave approved');
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leave-stats'] });
      setDetailLeave(null);
    },
    onError: () => toast.error('Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      api.post(`/leaves/${id}/reject/`, { reason }),
    onSuccess: () => {
      toast.success('Leave rejected');
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leave-stats'] });
      setDetailLeave(null);
      setRejectReason('');
    },
    onError: () => toast.error('Failed to reject'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.post(`/leaves/${id}/cancel/`),
    onSuccess: () => {
      toast.success('Leave cancelled');
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leave-stats'] });
      setDetailLeave(null);
    },
    onError: () => toast.error('Failed to cancel'),
  });

  // ── Helpers ──
  const filteredLeaves = leaves.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const studentName = l.student_details?.name || l.student_details?.first_name || l.student_details?.username || '';
    return (
      studentName.toLowerCase().includes(q) ||
      l.reason.toLowerCase().includes(q) ||
      l.leave_type.toLowerCase().includes(q) ||
      l.destination?.toLowerCase().includes(q)
    );
  });

  const getStudentName = (l: LeaveApplication) =>
    l.student_details?.name ||
    [l.student_details?.first_name, l.student_details?.last_name].filter(Boolean).join(' ') ||
    l.student_details?.username ||
    'Student';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Applications</h1>
          <p className="text-muted-foreground text-sm">
            {isStaffUser ? 'Review and manage student leave requests' : 'Apply for leave and track your applications'}
          </p>
        </div>
          {role === 'student' && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="rounded-full shadow-lg shadow-primary/30 bg-primary hover:bg-primary/90 text-white font-bold hover:shadow-md transition-all active:scale-95 px-6">
                <Plus className="w-5 h-5 mr-1" />
                Apply for Leave
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-3xl text-black">
              <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-6 py-4 border-b">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                    <CalendarDays className="h-6 w-6 text-primary" />
                    Apply for Leave
                  </DialogTitle>
                  <DialogDescription className="font-medium">
                    Submit your leave request for warden approval.
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="p-6 space-y-6">
                {/* Leave Type */}
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Leave Type *</Label>
                  <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                    <SelectTrigger className="h-12 rounded-2xl border-0 bg-gray-50 focus:ring-primary px-4 font-medium">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-gray-100 shadow-2xl">
                      {LEAVE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value} className="font-medium">{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Start Date *</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary px-4 font-medium" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">End Date *</Label>
                    <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary px-4 font-medium" />
                  </div>
                </div>

                {/* Reason */}
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Reason *</Label>
                  <Textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Explain your reason for leave..." className="rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary p-4 font-medium min-h-[100px]" />
                </div>

                {/* Destination */}
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Destination</Label>
                  <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Where will you go?" className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary px-4 font-medium" />
                </div>

                {/* Contact info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Parent Contact</Label>
                    <Input value={form.parent_contact} onChange={(e) => setForm({ ...form, parent_contact: e.target.value })} placeholder="Parent phone number" className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary px-4 font-medium" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Your Contact</Label>
                    <Input value={form.contact_during_leave} onChange={(e) => setForm({ ...form, contact_during_leave: e.target.value })} placeholder="Your active phone" className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary px-4 font-medium" />
                  </div>
                </div>

                {/* Parent Informed */}
                <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <input
                    type="checkbox"
                    id="parent_informed"
                    checked={form.parent_informed}
                    onChange={(e) => setForm({ ...form, parent_informed: e.target.checked })}
                    className="h-5 w-5 rounded-lg border-primary accent-primary"
                  />
                  <Label htmlFor="parent_informed" className="text-sm font-bold text-foreground cursor-pointer">Parent/Guardian has been informed</Label>
                </div>
              </div>

              <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur-md pt-4 px-6 pb-6 border-t flex flex-col gap-3">
                <Button
                  disabled={
                    !form.leave_type || 
                    !form.start_date || 
                    !form.end_date || 
                    !form.reason || 
                    !form.destination || 
                    !form.parent_contact || 
                    !form.parent_informed ||
                    createMutation.isPending
                  }
                  onClick={() => createMutation.mutate(form)}
                  className="w-full h-14 primary-gradient text-white font-black text-lg uppercase tracking-wider rounded-2xl shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
                >
                  {createMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                  Submit Application
                </Button>
                <Button variant="ghost" className="font-bold text-muted-foreground" onClick={() => setCreateOpen(false)}>Cancel</Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.currently_on_leave}</p>
              <p className="text-xs text-muted-foreground">On Leave Now</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search + Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by name, reason, type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 rounded-lg" />
              ))}
            </div>
          ) : filteredLeaves.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">No leave applications found</p>
                {role === 'student' && (
                  <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Apply Now
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredLeaves.map((leave) => {
                const cfg = STATUS_CONFIG[leave.status] || STATUS_CONFIG.pending;
                const StatusIcon = cfg.icon;
                return (
                  <Card
                    key={leave.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setDetailLeave(leave)}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="capitalize text-xs">
                              {leave.leave_type.replace('_', ' ')}
                            </Badge>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                              <StatusIcon className="h-3 w-3" />
                              {cfg.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {leave.duration_days} day{leave.duration_days !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {isStaffUser && (
                            <p className="text-sm font-medium mt-1">
                              {getStudentName(leave)}
                              {leave.student_details?.registration_number && (
                                <span className="text-muted-foreground ml-1">
                                  ({leave.student_details.registration_number})
                                </span>
                              )}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{leave.reason}</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {format(new Date(leave.start_date), 'dd MMM')} – {format(new Date(leave.end_date), 'dd MMM yyyy')}
                          </span>
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail / Action Dialog */}
      <Dialog open={!!detailLeave} onOpenChange={(open) => { if (!open) { setDetailLeave(null); setRejectReason(''); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {detailLeave && (() => {
            const cfg = STATUS_CONFIG[detailLeave.status] || STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    Leave Details
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                  </DialogTitle>
                  <DialogDescription>
                    Review the details of this leave application below.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                  {isStaffUser && (
                    <div>
                      <p className="text-muted-foreground text-xs">Student</p>
                      <p className="font-medium">{getStudentName(detailLeave)}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-muted-foreground text-xs">Leave Type</p>
                      <p className="font-medium capitalize">{detailLeave.leave_type.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Duration</p>
                      <p className="font-medium">{detailLeave.duration_days} day{detailLeave.duration_days !== 1 ? 's' : ''}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Start Date</p>
                      <p className="font-medium">{format(new Date(detailLeave.start_date), 'dd MMM yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">End Date</p>
                      <p className="font-medium">{format(new Date(detailLeave.end_date), 'dd MMM yyyy')}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Reason</p>
                    <p>{detailLeave.reason}</p>
                  </div>
                  {detailLeave.destination && (
                    <div>
                      <p className="text-muted-foreground text-xs">Destination</p>
                      <p>{detailLeave.destination}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    {detailLeave.parent_contact && (
                      <div>
                        <p className="text-muted-foreground text-xs">Parent Contact</p>
                        <p>{detailLeave.parent_contact}</p>
                      </div>
                    )}
                    {detailLeave.contact_during_leave && (
                      <div>
                        <p className="text-muted-foreground text-xs">Contact During Leave</p>
                        <p>{detailLeave.contact_during_leave}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">Parent Informed:</span>
                    <Badge variant={detailLeave.parent_informed ? 'default' : 'outline'}>
                      {detailLeave.parent_informed ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  {detailLeave.rejection_reason && (
                    <div className="border-l-4 border-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded">
                      <p className="text-xs font-medium text-red-700 dark:text-red-300">Rejection Reason</p>
                      <p className="text-red-600 dark:text-red-400">{detailLeave.rejection_reason}</p>
                    </div>
                  )}
                  {detailLeave.approved_by_name && (
                    <div>
                      <p className="text-muted-foreground text-xs">
                        {detailLeave.status === 'approved' ? 'Approved' : 'Reviewed'} by
                      </p>
                      <p className="font-medium">{detailLeave.approved_by_name}</p>
                      {detailLeave.approved_at && (
                        <p className="text-xs text-muted-foreground">
                          on {format(new Date(detailLeave.approved_at), 'dd MMM yyyy, hh:mm a')}
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Applied on {format(new Date(detailLeave.created_at), 'dd MMM yyyy, hh:mm a')}
                  </p>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row">
                  {/* Staff: approve/reject pending */}
                  {isStaffUser && detailLeave.status === 'pending' && (
                    <>
                      <div className="flex-1 w-full">
                        <Input
                          placeholder="Rejection reason (required to reject)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={!rejectReason || rejectMutation.isPending}
                        onClick={() => rejectMutation.mutate({ id: detailLeave.id, reason: rejectReason })}
                      >
                        {rejectMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <XCircle className="mr-1 h-3 w-3" />}
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={approveMutation.isPending}
                        onClick={() => approveMutation.mutate(detailLeave.id)}
                      >
                        {approveMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                        Approve
                      </Button>
                    </>
                  )}
                  {/* Student: cancel own pending/approved */}
                  {role === 'student' && (detailLeave.status === 'pending' || detailLeave.status === 'approved') && (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(detailLeave.id)}
                    >
                      {cancelMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Ban className="mr-1 h-3 w-3" />}
                      Cancel Leave
                    </Button>
                  )}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
