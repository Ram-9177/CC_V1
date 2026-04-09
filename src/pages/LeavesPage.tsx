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
  DialogDescription, DialogTrigger,
} from '@/components/ui/dialog';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { ListSkeleton } from '@/components/common/PageSkeleton';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { getApiErrorMessage, cn } from '@/lib/utils';

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
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'pending' | 'approved' | 'rejected' | 'cancelled';
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
  PENDING_APPROVAL: { label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Clock },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Clock },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle2 },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
  ACTIVE: { label: 'Active', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: Loader2 },
  COMPLETED: { label: 'Completed', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: Ban },
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
      if (tab === 'pending') params.status = 'PENDING_APPROVAL';
      else if (tab === 'approved') params.status = 'APPROVED';
      else if (tab !== 'all') params.status = tab.toUpperCase();
      
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
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, 'Failed to submit leave application'));
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
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Failed to approve leave')),
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
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Failed to reject leave')),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.post(`/leaves/${id}/cancel/`),
    onSuccess: () => {
      toast.success('Leave cancelled');
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leave-stats'] });
      setDetailLeave(null);
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Failed to cancel leave')),
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
    <div className="page-align-shell space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="page-align-header">
        <div className="page-align-title max-w-full">
          <h1 className="text-3xl font-black tracking-tight text-foreground truncate">Leave Applications</h1>
          <p className="page-align-subtitle truncate">
            {isStaffUser ? 'Review and manage student leave requests' : 'Apply for leave and track your applications'}
          </p>
        </div>
          {role === 'student' && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="rounded-xl shadow-none bg-primary hover:bg-primary/90 text-white font-bold transition-all active:scale-95 px-5 border border-primary/40">
                <Plus className="w-5 h-5 mr-1" />
                Apply for Leave
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 border border-slate-200 bg-white rounded-xl text-black shadow-none">
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
                    <SelectTrigger className="h-12 rounded-sm border-0 bg-gray-50 focus:ring-primary px-4 font-medium">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-sm border-gray-100 shadow-xl">
                      {LEAVE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value} className="font-medium">{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Start Date *</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="h-12 rounded-sm border-0 bg-gray-50 focus-visible:ring-primary px-4 font-medium" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">End Date *</Label>
                    <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="h-12 rounded-sm border-0 bg-gray-50 focus-visible:ring-primary px-4 font-medium" />
                  </div>
                </div>

                {/* Reason */}
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Reason *</Label>
                  <Textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Explain your reason for leave..." className="rounded-sm border-0 bg-gray-50 focus-visible:ring-primary p-4 font-medium min-h-[100px]" />
                </div>

                {/* Destination */}
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Destination</Label>
                  <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Where will you go?" className="h-12 rounded-sm border-0 bg-gray-50 focus-visible:ring-primary px-4 font-medium" />
                </div>

                {/* Contact info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Parent Contact</Label>
                    <Input value={form.parent_contact} onChange={(e) => setForm({ ...form, parent_contact: e.target.value })} placeholder="Parent phone number" className="h-12 rounded-sm border-0 bg-gray-50 focus-visible:ring-primary px-4 font-medium" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Your Contact</Label>
                    <Input value={form.contact_during_leave} onChange={(e) => setForm({ ...form, contact_during_leave: e.target.value })} placeholder="Your active phone" className="h-12 rounded-sm border-0 bg-gray-50 focus-visible:ring-primary px-4 font-medium" />
                  </div>
                </div>

                {/* Parent Informed */}
                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <input
                    type="checkbox"
                    id="parent_informed"
                    checked={form.parent_informed}
                    onChange={(e) => setForm({ ...form, parent_informed: e.target.checked })}
                    className="h-5 w-5 rounded-sm border-primary accent-primary"
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
                    !form.parent_informed ||
                    createMutation.isPending
                  }
                  onClick={() => createMutation.mutate(form)}
                  className="w-full h-14 primary-gradient text-white font-black text-lg uppercase tracking-wider rounded-xl shadow-none active:scale-95 transition-all"
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
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
          <Card className="border border-slate-200 bg-primary/5 rounded-xl shadow-none">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{stats.total}</p>
              <p className="text-xs text-primary/70 font-semibold">Total</p>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 bg-accent/20 rounded-xl shadow-none">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
              <p className="text-xs text-amber-700/80 font-semibold">Pending</p>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 bg-emerald-50 rounded-xl shadow-none">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              <p className="text-xs text-green-700/80 font-semibold">Approved</p>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 bg-rose-50 rounded-xl shadow-none">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              <p className="text-xs text-red-700/80 font-semibold">Rejected</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1 border border-slate-200 bg-sky-50 rounded-xl shadow-none">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.currently_on_leave}</p>
              <p className="text-xs text-blue-700/80 font-semibold">On Leave Now</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search + Tabs */}
      <div className="page-align-controls">
        <Input
          placeholder="Search by name, reason, type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs border-primary/25 bg-white focus-visible:ring-primary"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="w-full overflow-x-auto pb-2 hide-scrollbar">
          <TabsList className="inline-flex w-max min-w-full sm:min-w-0">
            <TabsTrigger value="all" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-none">All</TabsTrigger>
            <TabsTrigger value="pending" className="rounded-lg font-bold data-[state=active]:bg-accent/30 data-[state=active]:text-amber-700 data-[state=active]:shadow-none">Pending</TabsTrigger>
            <TabsTrigger value="approved" className="rounded-lg font-bold data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 data-[state=active]:shadow-none">Approved</TabsTrigger>
            <TabsTrigger value="REJECTED" className="rounded-lg font-bold data-[state=active]:bg-rose-100 data-[state=active]:text-rose-700 data-[state=active]:shadow-none">Rejected</TabsTrigger>
            <TabsTrigger value="ACTIVE" className="rounded-lg font-bold data-[state=active]:bg-sky-100 data-[state=active]:text-sky-700 data-[state=active]:shadow-none">Active Now</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <ListSkeleton rows={6} />
          ) : filteredLeaves.length === 0 ? (
            <Card className="border border-slate-200 bg-gradient-to-b from-primary/5 to-white rounded-xl shadow-none">
              <CardContent className="py-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-primary/55" />
                <p className="mt-4 text-primary/75 font-medium">No leave applications found</p>
                {role === 'student' && (
                  <Button className="mt-4 bg-primary text-white hover:bg-primary/90 border border-primary/30 rounded-xl shadow-none" onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Apply Now
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredLeaves.map((leave) => {
                const cfg = STATUS_CONFIG[leave.status] || STATUS_CONFIG.PENDING_APPROVAL;
                const StatusIcon = cfg.icon;
                return (
                  <Card
                    key={leave.id}
                    className="cursor-pointer rounded-xl border border-slate-200 shadow-none transition-colors hover:border-primary/30"
                    onClick={() => setDetailLeave(leave)}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="capitalize text-xs">
                              {leave.leave_type.replace('_', ' ')}
                            </Badge>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium ${cfg.color}`}>
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
        <DialogContent className="max-w-md rounded-xl p-0 overflow-hidden border border-slate-200 shadow-none animate-in fade-in zoom-in duration-300">
          {detailLeave && (() => {
            const cfg = STATUS_CONFIG[detailLeave.status] || STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            const isPending = detailLeave.status === 'pending' || detailLeave.status === 'PENDING_APPROVAL';
            const isApproved = detailLeave.status === 'approved' || detailLeave.status === 'APPROVED';
            return (
              <>
                {/* Header */}
                <div className="bg-primary/10 p-6 border-b border-primary/20">
                  <DialogTitle className="text-xl font-black text-primary">
                    {isStaffUser && isPending ? 'Leave Review' : 'Leave Details'}
                  </DialogTitle>
                  <DialogDescription className="text-xs font-semibold text-primary/60 uppercase tracking-tighter mt-0.5">
                    {isStaffUser && isPending ? 'Pending Approval Request' : (
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-semibold', cfg.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    )}
                  </DialogDescription>
                </div>

                <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto stylish-scrollbar focus:outline-none">

                  {/* Student info — staff only */}
                  {isStaffUser && (
                    <div className="bg-muted/30 p-5 rounded-sm border border-border space-y-3">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.1em]">Student Information</p>
                      <h3 className="font-black text-lg text-slate-900 leading-tight">{getStudentName(detailLeave)}</h3>
                      {detailLeave.student_details?.registration_number && (
                        <p className="text-xs font-bold text-primary">{detailLeave.student_details.registration_number}</p>
                      )}
                      {(detailLeave.parent_contact || detailLeave.contact_during_leave) && (
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed">
                          {detailLeave.parent_contact && (
                            <div>
                              <p className="text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Parent Contact</p>
                              <p className="text-xs font-bold text-slate-700">{detailLeave.parent_contact}</p>
                            </div>
                          )}
                          {detailLeave.contact_during_leave && (
                            <div>
                              <p className="text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Student Contact</p>
                              <p className="text-xs font-bold text-slate-700">{detailLeave.contact_during_leave}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Leave period */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-orange-50/50 rounded-sm border border-orange-100">
                      <p className="text-[8px] font-black text-orange-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <CalendarDays className="h-3 w-3" /> From
                      </p>
                      <p className="text-xs font-black text-orange-950">{format(new Date(detailLeave.start_date), 'dd MMM yyyy')}</p>
                    </div>
                    <div className="p-4 bg-emerald-50/50 rounded-sm border border-emerald-100">
                      <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <CalendarDays className="h-3 w-3" /> Until
                      </p>
                      <p className="text-xs font-black text-emerald-950">{format(new Date(detailLeave.end_date), 'dd MMM yyyy')}</p>
                    </div>
                  </div>

                  {/* Leave type + duration */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted/20 rounded-sm border border-border">
                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Leave Type</p>
                      <p className="text-xs font-bold text-slate-700 capitalize">{detailLeave.leave_type.replace('_', ' ')}</p>
                    </div>
                    <div className="p-3 bg-muted/20 rounded-sm border border-border">
                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Duration</p>
                      <p className="text-xs font-bold text-slate-700">{detailLeave.duration_days} day{detailLeave.duration_days !== 1 ? 's' : ''}</p>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="p-4 bg-slate-50 rounded-sm border border-slate-100">
                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-1">Reason</p>
                    <p className="text-sm font-medium text-slate-700">{detailLeave.reason}</p>
                  </div>

                  {/* Destination */}
                  {detailLeave.destination && (
                    <div className="p-3 bg-muted/20 rounded-sm border border-border">
                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Destination</p>
                      <p className="text-xs font-bold text-slate-700">{detailLeave.destination}</p>
                    </div>
                  )}

                  {/* Parent informed toggle (read-only view) */}
                  <div className={cn(
                    'flex items-center gap-3 p-4 rounded-sm border',
                    detailLeave.parent_informed ? 'bg-blue-50/50 border-blue-100' : 'bg-muted/20 border-border',
                  )}>
                    <div className={cn(
                      'h-5 w-5 rounded-sm border-2 flex items-center justify-center',
                      detailLeave.parent_informed ? 'bg-primary border-primary' : 'bg-white border-slate-300',
                    )}>
                      {detailLeave.parent_informed && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                    </div>
                    <span className="text-xs font-black text-blue-900 uppercase tracking-tight">
                      {detailLeave.parent_informed ? 'Parent / Guardian Informed' : 'Parent / Guardian Not Yet Informed'}
                    </span>
                  </div>

                  {/* Rejection reason */}
                  {detailLeave.rejection_reason && (
                    <div className="p-4 bg-rose-50 rounded-sm border border-rose-100">
                      <p className="text-[8px] font-black text-rose-600 uppercase tracking-wider mb-1">Rejection Reason</p>
                      <p className="text-sm font-medium text-rose-700">{detailLeave.rejection_reason}</p>
                    </div>
                  )}

                  {/* Approval info */}
                  {detailLeave.approved_by_name && (
                    <div className="p-4 bg-emerald-50 rounded-sm border border-emerald-100">
                      <p className="text-[8px] font-black text-emerald-600 uppercase tracking-wider mb-1">
                        {isApproved ? 'Approved By' : 'Reviewed By'}
                      </p>
                      <p className="text-xs font-bold text-emerald-900">{detailLeave.approved_by_name}</p>
                      {detailLeave.approved_at && (
                        <p className="text-[10px] text-emerald-700/70 mt-0.5">
                          on {format(new Date(detailLeave.approved_at), 'dd MMM yyyy, hh:mm a')}
                        </p>
                      )}
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground text-center">
                    Applied on {format(new Date(detailLeave.created_at), 'dd MMM yyyy, hh:mm a')}
                  </p>

                  {/* Staff approval actions */}
                  {isStaffUser && isPending && (
                    <div className="space-y-4 pt-2 border-t border-dashed">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                          Rejection Reason <span className="text-rose-400">(required to reject)</span>
                        </Label>
                        <Textarea
                          placeholder="Enter reason for rejection..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="rounded-sm border-2 border-slate-100 bg-slate-50 min-h-[90px] focus:ring-primary p-4 font-bold text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Button
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          className="h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-sm shadow-sm shadow-emerald-500/20 text-sm"
                          onClick={() => approveMutation.mutate(detailLeave.id)}
                        >
                          {approveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                          APPROVE
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!rejectReason.trim() || approveMutation.isPending || rejectMutation.isPending}
                          className="h-14 border-2 border-rose-100 hover:bg-rose-50 text-rose-600 font-black rounded-sm text-sm transition-all"
                          onClick={() => rejectMutation.mutate({ id: detailLeave.id, reason: rejectReason })}
                        >
                          {rejectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                          REJECT
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Student: cancel */}
                  {role === 'student' && (isPending || isApproved) && (
                    <div className="pt-2 border-t border-dashed">
                      <Button
                        variant="outline"
                        className="w-full h-12 border-2 border-rose-100 hover:bg-rose-50 text-rose-600 font-black rounded-sm text-sm"
                        disabled={cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate(detailLeave.id)}
                      >
                        {cancelMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
                        CANCEL LEAVE
                      </Button>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
