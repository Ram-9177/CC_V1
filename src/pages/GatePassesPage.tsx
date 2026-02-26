
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Filter, Search, QrCode, AlertCircle, Calendar as CalendarIcon, Clock,
  Check, X, Play, Pause } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { format } from 'date-fns';
import { AudioRecorder } from '@/components/AudioRecorder';
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
import { api, downloadFile } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { getApiErrorMessage, cn } from '@/lib/utils';
import { validateGatePassForm, sanitizeInput, GatePassFormData } from '@/lib/validation';

interface GatePass {
  id: number;
  student_id: number;
  student_name: string;
  student_hall_ticket: string;
  student_room?: string;
  pass_type?: 'day' | 'overnight' | 'weekend' | 'emergency';
  purpose: string;
  destination: string;
  exit_date: string | null;
  exit_time: string | null;
  expected_return_date: string | null;
  expected_return_time: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'used' | 'expired';
  approved_by?: string;
  created_at: string;
  remarks?: string;
  qr_code?: string;
  parent_informed: boolean;
  parent_informed_at?: string;
  parent_name?: string;
  parent_phone?: string;
  father_name?: string;
  father_phone?: string;
  mother_name?: string;
  mother_phone?: string;
  guardian_name?: string;
  guardian_phone?: string;
  student_phone?: string;
  audio_brief?: string;
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
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [selectedQR, setSelectedQR] = useState<{ id: number; code: string } | null>(null);
  const [protocolPass, setProtocolPass] = useState<GatePass | null>(null);

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
  useRealtimeQuery('gate_scan_logged', 'gate-passes');

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      await api.post('/gate-passes/', data, {
        headers: {
            'Content-Type': 'multipart/form-data',
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
      toast.success('Gate pass created successfully');
      setCreateDialogOpen(false);
      setAudioBlob(null);
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
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to create gate pass'));
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/gate-passes/${id}/approve/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Gate pass approved — student notified');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to approve gate pass'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/gate-passes/${id}/reject/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Gate pass rejected — student notified');
    },
    onError: (error: unknown) => {
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
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Verification failed'));
    },
  });

  const markInformedMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/gate-passes/${id}/mark_informed/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
      toast.success('Parents marked as informed');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to mark parents as informed'));
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

    const formDataObj = new FormData();
    Object.entries(sanitizedData).forEach(([key, value]) => {
        if (value) formDataObj.append(key, value as string);
    });

    if (audioBlob) {
        formDataObj.append('audio_brief', audioBlob, 'reason.webm');
    }
    
    createMutation.mutate(formDataObj);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-200/50 shadow-sm shadow-orange-500/5 font-black uppercase text-[10px] tracking-widest px-2.5 py-1">Pending Review</Badge>;
      case 'approved':
        return <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-lg shadow-green-200 font-black uppercase text-[10px] tracking-widest px-3 py-1">✅ Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-gradient-to-r from-red-500 to-rose-500 text-white border-0 shadow-lg shadow-red-200 font-black uppercase text-[10px] tracking-widest px-3 py-1">❌ Rejected</Badge>;
      case 'used':
        return <Badge className="bg-black text-white border-0 shadow-lg shadow-black/20 font-black uppercase text-[10px] tracking-widest px-2.5 py-1 flex items-center gap-1.5 ring-1 ring-white/10">
          <div className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse"></div>
          Currently Out
        </Badge>;
      case 'expired':
        return <Badge className="bg-slate-200 text-slate-500 border-0 font-black uppercase text-[10px] tracking-widest px-2.5 py-1">Expired</Badge>;
      case 'returned':
        return <Badge className="bg-slate-800 text-white border-0 shadow-lg shadow-black/10 font-black uppercase text-[10px] tracking-widest px-2.5 py-1">Returned Safe</Badge>;
      default:
        return <Badge className="bg-muted text-foreground border-0 font-bold tracking-tight uppercase px-3">{status}</Badge>;
    }
  };

  const AudioPlayer = ({ url }: { url?: string }) => {
    const [playing, setPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    if (!url) return null;

    // Fix relative URLs from backend
    const apiBase = import.meta.env.VITE_API_URL || '';
    const origin = apiBase.replace(/\/api\/?$/, '');
    const audioUrl = url.startsWith('http') ? url : `${origin}${url}`;

    return (
        <div className="flex items-center gap-2" role="group" aria-label="Audio reason player">
            <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 rounded-full border-primary/20 text-primary hover:bg-primary/5 p-0"
                aria-label={playing ? "Pause reason" : "Play reason"}
                onClick={(e) => {
                    e.stopPropagation();
                    if (audioRef.current) {
                        try {
                            if (playing) audioRef.current.pause();
                            else audioRef.current.play().catch(err => {
                                console.error("Audio playback failed:", err);
                                toast.error("Could not play audio reason");
                            });
                            setPlaying(!playing);
                        } catch (err) {
                            console.error("Audio interaction failed:", err);
                        }
                    }
                }}
            >
                {playing ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current ml-0.5" />}
            </Button>
            <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">Audio Reason</span>
            <audio 
                ref={audioRef} 
                src={audioUrl} 
                onEnded={() => setPlaying(false)}
                className="hidden" 
                preload="none"
            />
        </div>
    );
  };

  const ProtocolModal = ({ pass }: { pass: GatePass | null }) => {
    if (!pass) return null;

    // Build ALL contacts — show every number the student has
    const contacts = [
        { label: 'Student', name: pass.student_name, phone: pass.student_phone, icon: '👤' },
        { label: 'Father', name: pass.father_name, phone: pass.father_phone, icon: '👨‍💼' },
        { label: 'Mother', name: pass.mother_name, phone: pass.mother_phone, icon: '👩‍💼' },
        { label: 'Guardian', name: pass.guardian_name, phone: pass.guardian_phone, icon: '🛡️' },
    ].filter(c => !!c.phone);

    return (
        <Dialog open={!!pass} onOpenChange={(open) => !open && setProtocolPass(null)}>
            <DialogContent className="max-w-sm sm:max-w-md rounded-3xl border-0 shadow-2xl overflow-hidden p-0">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 sm:p-6">
                    <DialogTitle className="text-lg sm:text-2xl font-black text-white flex items-center gap-3">
                        <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                          <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                        Approval Protocol
                    </DialogTitle>
                    <DialogDescription className="text-white/80 font-medium mt-1 text-xs sm:text-sm">
                        Verify student exit with parents before approval.
                    </DialogDescription>
                </div>
                
                <div className="p-4 sm:p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                    {/* Student Info Summary */}
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-start gap-3">
                        <div className="min-w-0">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Requesting Exit</p>
                            <p className="font-black text-base sm:text-lg truncate text-gray-900 mt-0.5">{pass.student_name}</p>
                            <p className="text-[11px] sm:text-xs text-gray-500 truncate">{pass.student_hall_ticket} • Rm {pass.student_room}</p>
                        </div>
                        <Badge className="h-fit py-1.5 px-3 bg-orange-50 text-orange-600 border-orange-200 font-black text-[10px] whitespace-nowrap rounded-xl">
                            {pass.pass_type?.toUpperCase()}
                        </Badge>
                    </div>

                    {/* Destination & Purpose */}
                    <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">📍 Destination & Purpose</p>
                        <p className="text-sm font-bold text-gray-900">{pass.destination}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{pass.purpose}</p>
                    </div>

                    {/* Audio Reason Section */}
                    {pass.audio_brief && (
                        <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 space-y-2">
                             <Label className="text-[10px] font-black uppercase text-orange-600 tracking-widest">🎤 Voice Reason Brief</Label>
                             <AudioPlayer url={pass.audio_brief} />
                        </div>
                    )}

                    {/* STEP 1: Call — Show ALL phone numbers */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-[10px] font-black">1</div>
                            <Label className="text-xs font-black uppercase tracking-wider text-gray-700">Call & Verify</Label>
                        </div>
                        <div className="grid gap-2">
                            {contacts.length > 0 ? contacts.map((contact, i) => (
                                <a 
                                    key={i}
                                    href={`tel:${contact.phone}`}
                                    className="flex items-center justify-between p-3 rounded-2xl bg-white border-2 border-gray-100 hover:border-green-400 hover:bg-green-50 transition-all group active:scale-[0.97]"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="text-lg h-10 w-10 bg-gray-100 group-hover:bg-green-100 rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
                                            {contact.icon}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-0.5">{contact.label}</p>
                                            {contact.name && <p className="text-[11px] font-bold text-gray-600 truncate">{contact.name}</p>}
                                            <p className="font-black text-gray-900 text-sm truncate">{contact.phone}</p>
                                        </div>
                                    </div>
                                    <div className="h-9 px-3 rounded-xl bg-green-500 group-hover:bg-green-600 text-white flex items-center justify-center gap-1.5 font-black text-[11px] shadow-md shadow-green-200 transition-all flex-shrink-0">
                                        📞 CALL
                                    </div>
                                </a>
                            )) : (
                                <div className="p-4 text-center text-xs text-gray-500 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                    No contact numbers found in student profile.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* STEP 2: Confirm Informed */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className={cn(
                                "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors",
                                pass.parent_informed ? "bg-green-500 text-white" : "bg-gray-300 text-white"
                            )}>2</div>
                            <Label className="text-xs font-black uppercase tracking-wider text-gray-700">
                                Have you informed parents?
                            </Label>
                        </div>
                        <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-2">
                            <button 
                                type="button"
                                className={cn(
                                    "flex-1 rounded-xl h-12 font-black transition-all flex items-center justify-center gap-2 text-sm",
                                    !pass.parent_informed 
                                        ? "bg-white text-red-500 shadow-lg border border-red-100" 
                                        : "text-gray-400"
                                )}
                                onClick={() => {}} 
                            >
                                <X className="h-4 w-4" />
                                NO
                            </button>
                            <button 
                                type="button"
                                className={cn(
                                    "flex-1 rounded-xl h-12 font-black transition-all flex items-center justify-center gap-2 text-sm",
                                    pass.parent_informed 
                                        ? "bg-green-500 text-white shadow-lg shadow-green-200 ring-2 ring-green-300" 
                                        : "text-gray-400 hover:text-green-600 hover:bg-white/80"
                                )}
                                onClick={() => !pass.parent_informed && !markInformedMutation.isPending && markInformedMutation.mutate(pass.id)}
                            >
                                {markInformedMutation.isPending ? (
                                    <Clock className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <Check className="h-5 w-5" />
                                        YES
                                    </>
                                )}
                            </button>
                        </div>
                        <p className="text-[9px] sm:text-[10px] text-center font-bold uppercase tracking-tight text-gray-400">
                            {pass.parent_informed 
                                ? `✅ Protocol verified at ${new Date(pass.parent_informed_at || '').toLocaleTimeString()}` 
                                : `Call parent first, then select YES to unlock`}
                        </p>
                    </div>

                    {/* STEP 3: Approve or Reject — only visible after YES */}
                    <div className={cn(
                        "pt-3 border-t border-gray-100 transition-all duration-300",
                        pass.parent_informed ? "opacity-100" : "opacity-0 h-0 overflow-hidden pt-0 border-0"
                    )}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="h-6 w-6 bg-green-500 rounded-full flex items-center justify-center text-white text-[10px] font-black">3</div>
                            <Label className="text-xs font-black uppercase tracking-wider text-gray-700">Take Action</Label>
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                className="flex-[2] rounded-2xl h-12 font-black text-sm bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-200 hover:shadow-xl active:scale-[0.97] transition-all"
                                disabled={approveMutation.isPending}
                                onClick={() => {
                                    approveMutation.mutate(pass.id);
                                    setProtocolPass(null);
                                }}
                            >
                                {approveMutation.isPending ? 'Approving...' : '✅ Approve'}
                            </Button>
                            <Button 
                                className="flex-1 rounded-2xl h-12 font-black text-sm bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-lg shadow-red-200 hover:shadow-xl active:scale-[0.97] transition-all"
                                disabled={rejectMutation.isPending}
                                onClick={() => {
                                    rejectMutation.mutate(pass.id);
                                    setProtocolPass(null);
                                }}
                            >
                                {rejectMutation.isPending ? '...' : '❌ Reject'}
                            </Button>
                        </div>
                    </div>

                    {/* Back button — always visible */}
                    <div className={cn(!pass.parent_informed && "pt-3 border-t border-gray-100")}>
                        <Button 
                            variant="ghost" 
                            className="w-full rounded-2xl h-11 font-bold hover:bg-gray-100 text-gray-500 text-sm"
                            onClick={() => setProtocolPass(null)}
                        >
                            ← Back
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:gap-4 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg sm:text-2xl md:text-3xl font-black flex items-center gap-2 sm:gap-3 tracking-tight">
            <div className="p-2 sm:p-2.5 bg-orange-50 text-orange-600 rounded-2xl">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            Gate Passes
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium ml-1">Manage & track student exit requests</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          {canCreate && (
            <Button 
              onClick={() => setCreateDialogOpen(true)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-300 rounded-2xl text-sm sm:text-base h-11 sm:h-auto px-5 sm:px-6 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Pass
            </Button>
          )}
          {isAuthority && (
               <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                       toast.info('Downloading CSV...');
                       await downloadFile('/gate-passes/export_csv/', 'gate_passes.csv');
                       toast.success('Download complete');
                    } catch (e) {
                        toast.error('Failed to download CSV');
                    }
                  }}
                  className="border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold text-sm sm:text-base rounded-xl"
               >
                  <FileText className="h-4 w-4 mr-2" />
                  Export
               </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="pb-2 sm:pb-3 border-b border-border px-3 sm:px-6 py-3 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base text-foreground">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
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
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-bold text-xs py-3">Student</TableHead>
                      <TableHead className="font-bold text-xs py-3">Hall Ticket</TableHead>
                      <TableHead className="font-bold text-xs py-3">Destination</TableHead>
                      <TableHead className="font-bold text-xs py-3">Purpose</TableHead>
                      <TableHead className="font-bold text-xs py-3">Date & Time</TableHead>
                      <TableHead className="font-bold text-xs py-3">Exit/Return</TableHead>
                      <TableHead className="font-bold text-xs py-3">Status</TableHead>
                      <TableHead className="font-bold text-xs py-3 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                    <TableBody>
                    {gatePasses.map((gatePass) => (
                      <TableRow key={gatePass.id} className="py-2 hover:bg-muted/30">
                        <TableCell 
                          className={cn("py-3 text-xs", isAuthority && gatePass.status === 'pending' && "cursor-pointer hover:bg-slate-50 transition-colors")}
                          onClick={() => isAuthority && gatePass.status === 'pending' && setProtocolPass(gatePass)}
                        >
                          <div className="font-semibold text-foreground truncate">{gatePass.student_name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{gatePass.student_hall_ticket}</div>
                        </TableCell>
                        <TableCell className="py-3 text-xs font-mono">{gatePass.student_hall_ticket || '—'}</TableCell>
                        <TableCell className="py-3 text-xs truncate max-w-xs">{gatePass.destination || '—'}</TableCell>
                        <TableCell className="py-3 text-xs truncate max-w-xs text-muted-foreground italic">{gatePass.purpose || '—'}</TableCell>
                        <TableCell className="py-3 text-xs">
                          <div>{new Date(gatePass.exit_date || new Date()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                          <div className="text-muted-foreground text-[10px]">{gatePass.exit_time || '—'}</div>
                        </TableCell>
                        <TableCell className="py-3 text-xs">
                          {gatePass.exit_date && (
                            <div><strong>Exit:</strong> {new Date(gatePass.exit_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} {gatePass.exit_time || '—'}</div>
                          )}
                          {gatePass.expected_return_date && (
                            <div><strong>Ret:</strong> {new Date(gatePass.expected_return_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} {gatePass.expected_return_time || '—'}</div>
                          )}
                        </TableCell>
                        <TableCell className="py-3">{getStatusBadge(gatePass.status)}</TableCell>
                        <TableCell className="py-3 text-right">
                          <div className="flex gap-1 justify-end flex-wrap">
                             {gatePass.status === 'approved' && !isAuthority && !isSecurity && (
                                <Button
                                  size="sm"
                                  className="h-8 bg-black hover:bg-black/90 text-white shadow-sm transition-all text-xs"
                                  onClick={() => setSelectedQR({ id: gatePass.id, code: gatePass.qr_code || '' })}
                                >
                                  <QrCode className="h-3 w-3 mr-1" />
                                  QR
                                </Button>
                              )}
                            {isAuthority && gatePass.status === 'pending' && (
                              <Button
                                size="sm"
                                className="h-8 px-2 text-[10px] font-black bg-primary hover:bg-primary/90 text-foreground shadow-sm transition-all"
                                onClick={() => gatePass.parent_informed && approveMutation.mutate(gatePass.id)}
                                disabled={approveMutation.isPending || !gatePass.parent_informed}
                                title={!gatePass.parent_informed ? "Mark parent as informed first" : "Approve pass"}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                APR
                              </Button>
                            )}
                            {isAuthority && gatePass.status === 'pending' && (
                              <Button
                                size="sm"
                                className="h-8 w-8 p-0 bg-black hover:bg-black/90 text-white shadow-sm transition-all"
                                onClick={() => rejectMutation.mutate(gatePass.id)}
                                disabled={rejectMutation.isPending}
                                title="Reject pass"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {isSecurity && gatePass.status === 'approved' && (
                               <Button
                                 size="sm"
                                 className="h-8 px-2 text-[10px] font-black bg-primary hover:bg-primary/90 text-foreground shadow-sm transition-all"
                                 onClick={() => verifyMutation.mutate({ id: gatePass.id, action: 'check_out' })}
                                 disabled={verifyMutation.isPending}
                               >
                                 OUT
                               </Button>
                            )}
                            {isSecurity && gatePass.status === 'used' && (
                               <Button
                                 size="sm"
                                 className="h-8 px-2 text-[10px] font-black bg-black hover:bg-black/90 text-white shadow-sm transition-all"
                                 onClick={() => verifyMutation.mutate({ id: gatePass.id, action: 'check_in' })}
                                 disabled={verifyMutation.isPending}
                               >
                                 IN
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
                  <Card key={gatePass.id} className={cn(
                    "overflow-hidden border-0 shadow-2xl rounded-3xl transition-all bouncy-hover relative",
                    gatePass.status === 'pending' ? "glass-card ring-1 ring-orange-200" : "bg-white",
                    gatePass.status === 'approved' ? "ring-2 ring-green-300 bg-green-50/30" : "",
                    gatePass.status === 'rejected' ? "ring-2 ring-red-200 bg-red-50/20" : "",
                    gatePass.status === 'used' ? "ring-2 ring-black bg-slate-50" : ""
                  )}>
                    {/* Header Pass Effect */}
                    <div className={cn(
                      "h-1.5 w-full absolute top-0 left-0",
                      gatePass.status === 'pending' ? "bg-gradient-to-r from-orange-500 to-amber-500" : 
                      gatePass.status === 'approved' ? "bg-gradient-to-r from-green-500 to-emerald-500" :
                      gatePass.status === 'rejected' ? "bg-gradient-to-r from-red-500 to-rose-500" :
                      gatePass.status === 'used' ? "bg-black" : "bg-slate-200"
                    )}></div>

                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex gap-3 items-center">
                          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black shrink-0 border border-primary/10 shadow-inner">
                            {gatePass.student_name?.[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-sm text-foreground truncate tracking-tight">{gatePass.student_name}</div>
                            <div className="text-[10px] text-foreground font-black uppercase tracking-widest mt-0.5">{gatePass.student_hall_ticket}</div>
                          </div>
                        </div>
                        {getStatusBadge(gatePass.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-4">
                      {/* Pass ID Stripe */}
                      <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-muted/30 border border-dashed border-muted-foreground/40">
                        <div className="text-[9px] font-black text-foreground uppercase tracking-widest">GATE PASS ID</div>
                        <div className="text-[9px] font-black text-foreground font-mono">#{gatePass.id}</div>
                      </div>
                      {/* Exit & Return Row */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-muted/50 p-2.5 rounded-lg border border-border">
                          <p className="text-[9px] font-bold text-muted-foreground mb-1">EXIT</p>
                          <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                            {gatePass.exit_date ? new Date(gatePass.exit_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{gatePass.exit_time || '—'}</div>
                        </div>
                        <div className="bg-muted/50 p-2.5 rounded-lg border border-border">
                          <p className="text-[9px] font-bold text-muted-foreground mb-1">RETURN</p>
                          <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                            {gatePass.expected_return_date ? new Date(gatePass.expected_return_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                          </div>
                          <div className="text-xs text-black font-semibold mt-0.5">{gatePass.expected_return_time || '—'}</div>
                        </div>
                      </div>
                      
                      {/* Purpose */}
                      <div 
                        className={cn(
                          "bg-muted/50 p-2.5 rounded-lg border border-border",
                          isAuthority && gatePass.status === 'pending' && "cursor-pointer hover:bg-primary/5 active:scale-[0.98] transition-all"
                        )}
                        onClick={() => isAuthority && gatePass.status === 'pending' && setProtocolPass(gatePass)}
                      >
                        <p className="text-[9px] font-bold text-foreground mb-1">DESTINATION & PURPOSE</p>
                        <p className="text-xs text-foreground font-semibold">{gatePass.destination}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{gatePass.purpose}</p>
                        <AudioPlayer url={gatePass.audio_brief} />
                        {isAuthority && gatePass.status === 'pending' && (
                          <div className="mt-1 flex items-center justify-end text-[8px] text-primary/70 font-bold uppercase">
                            Verify ↗
                          </div>
                        )}
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

                      {/* Authority Actions: Informed Toggle & Approval */}
                      {isAuthority && gatePass.status === 'pending' && (
                        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 mt-2">
                            <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Parental Approval Protocol</Label>
                            
                            {gatePass.parent_phone && (
                               <a 
                                  href={`tel:${gatePass.parent_phone}`}
                                  className="w-full h-9 flex items-center justify-center gap-2 rounded-lg bg-primary/5 text-primary-dark font-black text-xs border border-primary/20 hover:bg-primary/10 transition-all"
                                >
                                  📞 CALL {gatePass.parent_name || 'PARENT'} ({gatePass.parent_phone})
                                </a>
                            )}

                            <div className="flex gap-2">
                                <div className="flex-1 flex bg-slate-200 p-1 rounded-lg border border-black/10">
                                    <button 
                                        type="button"
                                        className={cn(
                                            "flex-1 py-1.5 text-[10px] font-black rounded-md transition-all",
                                            !gatePass.parent_informed ? "bg-white text-destructive shadow-sm scale-105" : "text-black/40"
                                        )}
                                        onClick={() => {}}
                                    >NO</button>
                                    <button 
                                        type="button"
                                        className={cn(
                                            "flex-1 py-1.5 text-[10px] font-black rounded-md transition-all",
                                            gatePass.parent_informed 
                                                ? "bg-success text-white shadow-sm scale-105" 
                                                : "text-black/40 hover:text-success"
                                        )}
                                        onClick={() => !gatePass.parent_informed && markInformedMutation.mutate(gatePass.id)}
                                        disabled={markInformedMutation.isPending}
                                    >
                                        {markInformedMutation.isPending ? "..." : "YES"}
                                    </button>
                                </div>

                                <Button
                                  className={cn(
                                      "flex-[1.5] rounded-lg font-black h-9 text-[10px] shadow-sm transition-all",
                                      gatePass.parent_informed 
                                          ? "primary-gradient text-white" 
                                          : "bg-muted text-black opacity-50 cursor-not-allowed"
                                  )}
                                  onClick={() => gatePass.parent_informed && approveMutation.mutate(gatePass.id)}
                                  disabled={approveMutation.isPending || !gatePass.parent_informed}
                                >
                                  {approveMutation.isPending ? "..." : "✓ APPROVE"}
                                </Button>
                                
                                <Button
                                  variant="outline"
                                  className="w-10 rounded-lg bg-black text-white border-black font-black h-9 text-xs hover:bg-black/80"
                                  onClick={() => rejectMutation.mutate(gatePass.id)}
                                  disabled={rejectMutation.isPending}
                                >
                                  ✕
                                </Button>
                            </div>
                            
                            <p className="text-[8px] text-center font-bold text-black uppercase tracking-tighter">
                                {gatePass.parent_informed ? "Protocol Verified - Approval Unlocked" : "Step 1: Call Parent → Step 2: Select YES → Step 3: Approve"}
                            </p>
                        </div>
                      )}

                        {isSecurity && gatePass.status === 'approved' && (
                           <Button
                              className="w-full mt-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/30 hover:shadow-md smooth-transition transition-all active:scale-95"
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
                              className="w-full mt-2 rounded-lg bg-black text-white font-bold h-9 hover:bg-black/90 shadow-md hover:shadow-lg transition-all"
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
              <FileText className="h-14 w-14 text-black mb-4" />
              <p className="text-foreground font-semibold text-lg mb-2">No gate passes yet</p>
              <p className="text-sm text-black font-medium text-center max-w-xs">
                {canCreate 
                  ? "Create your first gate pass to request exit from the hostel" 
                  : "No gate passes match your search criteria"}
              </p>
            </div>
          )}
        </CardContent>
        
        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-6 py-4 border-t border-black/10 bg-black/5">
            <div className="text-xs sm:text-sm font-black text-black">
                Page {page} • {totalCount || 0} items
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || isLoading}
                    className="h-9 sm:h-8 px-3 text-xs flex-1 sm:flex-initial"
                >
                    Prev
                </Button>
                <div className="flex items-center justify-center px-3 sm:px-2 min-w-[2.5rem] text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded h-9 sm:h-8">
                    {page}
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => p + 1)}
                    disabled={!hasNextPage || isLoading}
                    className="h-9 sm:h-8 px-3 text-xs flex-1 sm:flex-initial"
                >
                    Next
                </Button>
            </div>
        </div>
      </Card>

      {/* Create Gate Pass Dialog */}
      {canCreate && (
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-3xl shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-5 rounded-t-3xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3 text-white">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                New Gate Pass
              </DialogTitle>
              <DialogDescription className="font-medium text-white/80">
                Submit an exit request for warden authorization.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Pass Type Selector */}
            <div className="space-y-3">
              <Label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Type of Exit *</Label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { type: 'day' as const, icon: '☀️', label: 'Day Pass', desc: 'Same day return' },
                  { type: 'overnight' as const, icon: '🌙', label: 'Overnight', desc: 'Next day return' },
                  { type: 'weekend' as const, icon: '🏠', label: 'Weekend', desc: 'Multi-day leave' },
                  { type: 'emergency' as const, icon: '🚨', label: 'Emergency', desc: 'Urgent exit' },
                ]).map(({ type, icon, label, desc }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, pass_type: type })}
                    className={cn(
                      "relative p-4 rounded-2xl text-left transition-all duration-200 border-2",
                      formData.pass_type === type
                        ? "border-orange-500 bg-orange-50 shadow-lg shadow-orange-100 scale-[1.02]"
                        : "border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    {formData.pass_type === type && (
                      <div className="absolute top-2 right-2 h-5 w-5 bg-orange-500 rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <div className="text-xl mb-1">{icon}</div>
                    <div className={cn(
                      "text-xs font-black uppercase tracking-wider",
                      formData.pass_type === type ? "text-orange-700" : "text-gray-700"
                    )}>{label}</div>
                    <div className="text-[10px] text-gray-400 font-medium mt-0.5">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Destination & Purpose */}
            <div className="bg-gray-50/80 rounded-2xl p-4 space-y-4 border border-gray-100">
              <div className="space-y-2">
                <Label htmlFor="destination" className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1 flex items-center gap-2">
                  📍 Destination *
                </Label>
                <Input
                  id="destination"
                  placeholder="Where are you going?"
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  className={cn(
                    "rounded-xl border-0 bg-white h-12 focus-visible:ring-orange-500 px-4 font-medium shadow-sm",
                    formErrors.destination && "ring-2 ring-destructive"
                  )}
                />
                {formErrors.destination && <p className="text-[10px] text-destructive font-bold ml-1">{formErrors.destination}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose" className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1 flex items-center gap-2">
                  📋 Purpose *
                </Label>
                <Input
                  id="purpose"
                  placeholder="Why are you going?"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className={cn(
                    "rounded-xl border-0 bg-white h-12 focus-visible:ring-orange-500 px-4 font-medium shadow-sm",
                    formErrors.purpose && "ring-2 ring-destructive"
                  )}
                />
                {formErrors.purpose && <p className="text-[10px] text-destructive font-bold ml-1">{formErrors.purpose}</p>}
              </div>
            </div>

            {/* Date & Time Section */}
            <div className="space-y-3">
              <Label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1 flex items-center gap-2">
                🕐 Schedule
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Exit Date/Time */}
                <div className="bg-orange-50/50 rounded-2xl p-4 border border-orange-100 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 bg-orange-500 rounded-lg flex items-center justify-center">
                      <CalendarIcon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="text-xs font-bold text-orange-800">Exit</p>
                  </div>
                  <DatePicker
                    date={formData.exit_date ? new Date(formData.exit_date) : undefined}
                    onSelect={(date) => setFormData({ ...formData, exit_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                    className="w-full rounded-xl border-0 bg-white shadow-sm h-11 font-medium"
                    placeholder="Pick date"
                  />
                  <TimePicker
                    value={formData.exit_time}
                    onChange={(e) => setFormData({ ...formData, exit_time: e.target.value })}
                    className="w-full rounded-xl border-0 bg-white shadow-sm h-11 font-medium px-4"
                  />
                </div>

                {/* Return Date/Time */}
                <div className="bg-green-50/50 rounded-2xl p-4 border border-green-100 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 bg-green-600 rounded-lg flex items-center justify-center">
                      <CalendarIcon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="text-xs font-bold text-green-800">Return</p>
                  </div>
                  <DatePicker
                    date={formData.expected_return_date ? new Date(formData.expected_return_date) : undefined}
                    onSelect={(date) => setFormData({ ...formData, expected_return_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                    className="w-full rounded-xl border-0 bg-white shadow-sm h-11 font-medium"
                    placeholder="Pick date"
                  />
                  <TimePicker
                    value={formData.expected_return_time}
                    onChange={(e) => setFormData({ ...formData, expected_return_time: e.target.value })}
                    className="w-full rounded-xl border-0 bg-white shadow-sm h-11 font-medium px-4"
                  />
                </div>
              </div>
            </div>

            {/* Voice Explanation */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-5 rounded-2xl border border-orange-100 space-y-3">
              <Label className="text-xs font-black uppercase tracking-widest text-orange-600 flex items-center gap-2">
                <div className="h-5 w-5 bg-orange-500 rounded-lg flex items-center justify-center">
                  <Play className="h-2.5 w-2.5 fill-current text-white" />
                </div>
                Voice Explanation (Optional)
              </Label>
              <div className="flex justify-center py-2">
                <AudioRecorder 
                  onRecordingComplete={(blob) => setAudioBlob(blob)} 
                  onClear={() => setAudioBlob(null)}
                />
              </div>
              <p className="text-[10px] font-medium text-center text-orange-500/70">Help wardens understand your request faster with a quick voice note.</p>
            </div>

            {/* Remarks */}
            <div className="space-y-2">
              <Label htmlFor="remarks" className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Additional Remarks</Label>
              <Textarea
                id="remarks"
                placeholder="Any other details the warden should know..."
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="rounded-xl border-0 bg-gray-50 min-h-[80px] focus-visible:ring-orange-500 p-4 font-medium"
              />
            </div>

            {/* Submit */}
            <div className="sticky bottom-0 z-10 bg-white/90 backdrop-blur-md pt-4 -mx-6 px-6 -mb-6 pb-6 border-t border-gray-100 flex flex-col gap-3">
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="w-full h-14 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-base uppercase tracking-wider rounded-2xl shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-300 active:scale-[0.98] transition-all"
              >
                {createMutation.isPending ? 'Submitting...' : '✓ Request Gate Pass'}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setCreateDialogOpen(false)}
                className="w-full h-10 font-bold text-gray-400 uppercase tracking-widest text-[10px] rounded-xl hover:bg-gray-50"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      )}

      {/* QR Code Viewer Dialog */}
      <Dialog open={!!selectedQR} onOpenChange={(open) => !open && setSelectedQR(null)}>
        <DialogContent className="max-w-sm sm:max-w-md rounded-xl bg-card border border-border shadow-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-center text-lg sm:text-xl font-bold text-primary">Gate Pass QR Code</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground text-xs sm:text-sm">
              Show this to security for scanning at the gate
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-4 sm:py-6 space-y-3 sm:space-y-4">
            <div className="relative p-4 sm:p-6 bg-white rounded-lg border-2 border-border shadow-md">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${selectedQR?.code}`}
                alt="Gate Pass QR"
                className="w-40 h-40 sm:w-48 sm:h-48"
                />
              </div>
            <div className="text-center space-y-2 w-full px-2">
              <p className="text-[10px] sm:text-xs font-mono text-muted-foreground uppercase tracking-wide">Pass Token</p>
              <p className="font-semibold text-xs sm:text-sm text-foreground break-all font-mono">{selectedQR?.code}</p>
            </div>
              <Badge className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0 text-[10px] sm:text-xs font-semibold shadow-md">
                ✓ Valid for Scanning
              </Badge>
          </div>
          <DialogFooter>
            <Button className="w-full rounded-lg sm:rounded-2xl h-10 sm:h-12 font-bold bg-primary text-primary-foreground hover:shadow-lg transition-all text-sm sm:text-base" onClick={() => setSelectedQR(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ProtocolModal pass={protocolPass} />
    </div>
  );
}
