
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Filter, Search, QrCode, AlertCircle, Calendar as CalendarIcon, Clock,
  Check, X, Play, Pause, ShieldCheck } from 'lucide-react';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api, downloadFile } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { getApiErrorMessage, cn } from '@/lib/utils';
import { validateGatePassForm, sanitizeInput, GatePassFormData } from '@/lib/validation';
import { SEO } from '@/components/common/SEO';

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
  student_profile_picture?: string;
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
  const [selectedQR, setSelectedQR] = useState<GatePass | null>(null);
  const [protocolPass, setProtocolPass] = useState<GatePass | null>(null);
  const [selectedGate, setSelectedGate] = useState('Main Gate');

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
  useRealtimeQuery('gatepass_approved', 'gate-passes');
  useRealtimeQuery('gatepass_rejected', 'gate-passes');
  useRealtimeQuery('gate_scan_logged', 'gate-passes');
  useRealtimeQuery('gatepass_parent_informed', 'gate-passes');
  useRealtimeQuery('gatepass_updated', 'gate-passes');

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
    mutationFn: async ({ id, action, location }: { id: number; action: 'check_out' | 'check_in' | 'deny_exit'; location?: string }) => {
      await api.post(`/gate-passes/${id}/verify/`, { action, location });
    },
    onSuccess: () => {
      toast.success('Pass verified successfully');
      if ('vibrate' in navigator) {
          navigator.vibrate(100);
      }
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Verification failed'));
    },
  });

  const markInformedMutation = useMutation({
    mutationFn: async (id: number) => {
      const resp = await api.post(`/gate-passes/${id}/mark_informed/`);
      return resp.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
      // Instantly unblock UI state within the open Modal to avoid glitchy re-renders
      if (protocolPass?.id === variables) {
        setProtocolPass({
          ...protocolPass,
          parent_informed: true,
          parent_informed_at: data.parent_informed_at || new Date().toISOString()
        });
      }
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
        return <Badge className="bg-orange-50 text-orange-600 border-orange-200 shadow-none font-black uppercase text-[10px] tracking-widest px-2.5 py-1">Pending Review</Badge>;
      case 'approved':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 shadow-none font-black uppercase text-[10px] tracking-widest px-3 py-1">✅ Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-rose-50 text-rose-600 border-rose-100 shadow-none font-black uppercase text-[10px] tracking-widest px-3 py-1">❌ Rejected</Badge>;
      case 'used':
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200 shadow-none font-black uppercase text-[10px] tracking-widest px-3 py-1">Used Pass</Badge>;
      case 'expired':
        return <Badge className="bg-slate-50 text-slate-400 border-slate-100 shadow-none font-black uppercase text-[10px] tracking-widest px-3 py-1">Expired</Badge>;
      case 'returned':
        return <Badge className="bg-slate-800 text-white border-0 font-black uppercase text-[10px] tracking-widest px-2.5 py-1">Returned Safe</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 sm:p-6 shadow-md border-b border-blue-400/30 relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-xl" />
                    <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                    <DialogTitle className="text-lg sm:text-2xl font-black text-white flex items-center gap-3 relative z-10">
                        <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                          <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                        Approval Protocol
                    </DialogTitle>
                    <DialogDescription className="text-blue-100 font-medium mt-1 text-xs sm:text-sm relative z-10">
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
                        <Badge className="h-fit py-1.5 px-3 bg-primary/10 text-primary border-primary/20 font-black text-[10px] whitespace-nowrap rounded-xl">
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
                        <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 space-y-2">
                             <Label className="text-[10px] font-black uppercase text-primary tracking-widest">🎤 Voice Reason Brief</Label>
                             <AudioPlayer url={pass.audio_brief} />
                        </div>
                    )}

                    {/* STEP 1: Call — Show ALL phone numbers */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-[10px] font-black">1</div>
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
                                pass.parent_informed ? "bg-emerald-500 text-white" : "bg-gray-300 text-white"
                            )}>2</div>
                            <Label className="text-xs font-black uppercase tracking-wider text-gray-700">
                                Have you informed parents?
                            </Label>
                        </div>
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-2">
                            <button 
                                type="button"
                                className={cn(
                                    "flex-1 rounded-xl h-11 font-black transition-all flex items-center justify-center gap-2 text-xs",
                                    !pass.parent_informed 
                                        ? "bg-white text-rose-400 shadow-sm border border-rose-100" 
                                        : "text-slate-400 bg-transparent"
                                )}
                                onClick={() => setProtocolPass(null)} 
                            >
                                <X className="h-4 w-4" />
                                NOT YET
                            </button>
                            <button 
                                type="button"
                                className={cn(
                                    "flex-1 rounded-xl h-11 font-black transition-all flex items-center justify-center gap-2 text-xs",
                                    pass.parent_informed 
                                        ? "bg-sky-100 text-sky-700 ring-1 ring-sky-200" 
                                        : "bg-white text-slate-400 hover:text-sky-600 hover:shadow-sm"
                                )}
                                onClick={() => !pass.parent_informed && !markInformedMutation.isPending && markInformedMutation.mutate(pass.id)}
                            >
                                {markInformedMutation.isPending ? (
                                    <Clock className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <Check className="h-5 w-5" />
                                        YES, CALLED
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
                        "border-t border-gray-100 transition-all duration-300",
                        pass.parent_informed ? "pt-3 opacity-100" : "opacity-0 h-0 overflow-hidden pt-0 border-0"
                    )}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="h-6 w-6 bg-green-500 rounded-full flex items-center justify-center text-white text-[10px] font-black">3</div>
                            <Label className="text-xs font-black uppercase tracking-wider text-gray-700">Take Action</Label>
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                className="flex-[2] rounded-2xl h-12 font-black text-xs bg-sky-100 text-sky-700 hover:bg-sky-200 border-0 shadow-sm active:scale-[0.97] transition-all"
                                disabled={approveMutation.isPending}
                                onClick={() => {
                                    approveMutation.mutate(pass.id);
                                    setProtocolPass(null);
                                }}
                            >
                                {approveMutation.isPending ? 'Verifying...' : 'APPROVE EXIT'}
                            </Button>
                            <Button 
                                className="flex-1 rounded-2xl h-12 font-black text-xs bg-rose-50 text-rose-500 hover:bg-rose-100 border-0 shadow-sm active:scale-[0.97] transition-all"
                                disabled={rejectMutation.isPending}
                                onClick={() => {
                                    rejectMutation.mutate(pass.id);
                                    setProtocolPass(null);
                                }}
                            >
                                {rejectMutation.isPending ? '...' : 'REJECT'}
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

  const isCurrentlyOut = gatePasses.some(gp => gp.status === 'used');

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      <SEO 
        title="Gate Passes" 
        description="Submit and manage student gate pass requests. Streamlined approval workflow for hostel authorities and security."
      />
      {/* ── Premium Header Banner ── */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-primary/10 border border-primary/20 p-5 sm:p-7 shadow-sm">
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black flex items-center gap-3 tracking-tight text-primary">
              <div className="p-2.5 bg-primary/20 rounded-2xl">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              Gate Passes
            </h1>
            <p className="text-primary/60 text-xs sm:text-sm font-medium mt-1.5 ml-1">Manage & track student exit requests</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {canCreate && (
              <Button 
                onClick={() => {
                   if (isCurrentlyOut) {
                      toast.error("You are currently marked as OUT. Please check-in (Return Safe) before raising a new pass.", {
                         icon: <AlertCircle className="h-5 w-5 text-red-500" />
                      });
                      return;
                   }
                   setCreateDialogOpen(true);
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-md rounded-2xl text-sm sm:text-base h-11 sm:h-auto px-5 sm:px-6 active:scale-95 transition-all outline-none border-0"
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
                    className="border-primary/20 bg-background text-primary hover:bg-primary/5 font-semibold text-sm sm:text-base rounded-xl"
                 >
                    <FileText className="h-4 w-4 mr-2" />
                    Export
                 </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Filter & Search Card ── */}
      <Card className="border-0 bg-white rounded-2xl sm:rounded-3xl shadow-lg shadow-slate-200/50 overflow-hidden">
        <CardHeader className="pb-2 sm:pb-3 border-b border-primary/10 px-4 sm:px-6 py-3 sm:py-4 bg-primary/5">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base font-black text-slate-800">
            <div className="p-1.5 bg-primary/20 rounded-lg">
              <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
            </div>
            Filter & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3 sm:gap-4 p-4 sm:p-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-primary/40" />
            <Input
              placeholder="Search by Hall Ticket..."
              value={searchTicket}
              onChange={(e) => setSearchTicket(e.target.value)}
              className="pl-10 bg-slate-50 border-slate-200/60 focus:border-primary/50 focus:ring-primary/20 rounded-xl h-10 sm:h-11 shadow-inner"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-64 border-slate-200/60 focus:border-primary/50 rounded-xl bg-slate-50 h-10 sm:h-11 shadow-inner">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-slate-100 shadow-2xl">
              <SelectItem value="all">🔵 All Status</SelectItem>
              <SelectItem value="pending" className="font-semibold">⏳ Pending</SelectItem>
              <SelectItem value="approved" className="font-semibold text-emerald-600">✅ Approved</SelectItem>
              <SelectItem value="rejected" className="font-semibold text-red-600">❌ Rejected</SelectItem>
              <SelectItem value="used" className="font-semibold">📍 Out/Used</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* ── Gate Passes Container ── */}
      <Card className="border-0 shadow-lg shadow-slate-200/50 rounded-2xl sm:rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                  <div className="h-9 w-9 rounded-xl bg-slate-100 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-36 rounded-lg" />
                    <Skeleton className="h-3 w-24 rounded-lg" />
                  </div>
                  <Skeleton className="h-3 w-28 rounded-lg" />
                  <Skeleton className="h-3 w-20 rounded-lg" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-8 w-20 rounded-xl" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="p-6 m-4 bg-red-50 border border-red-200 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-100 rounded-xl">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="font-black text-red-600 text-base">Failed to load gate passes</p>
                  <p className="text-sm text-red-400 mt-1 font-medium">Please try again later or contact support</p>
                </div>
              </div>
            </div>
          ) : gatePasses && gatePasses.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow className="bg-muted/50 border-b border-border/20">
                      <TableHead className="font-black text-[11px] text-slate-500 uppercase tracking-wider py-3.5">Student</TableHead>
                      <TableHead className="font-black text-[11px] text-slate-500 uppercase tracking-wider py-3.5">Hall Ticket</TableHead>
                      <TableHead className="font-black text-[11px] text-slate-500 uppercase tracking-wider py-3.5">Destination</TableHead>
                      <TableHead className="font-black text-[11px] text-slate-500 uppercase tracking-wider py-3.5">Purpose</TableHead>
                      <TableHead className="font-black text-[11px] text-slate-500 uppercase tracking-wider py-3.5">Date & Time</TableHead>
                      <TableHead className="font-black text-[11px] text-slate-500 uppercase tracking-wider py-3.5">Exit/Return</TableHead>
                      <TableHead className="font-black text-[11px] text-slate-500 uppercase tracking-wider py-3.5">Status</TableHead>
                      <TableHead className="font-black text-[11px] text-slate-500 uppercase tracking-wider py-3.5 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                    <TableBody>
                    {gatePasses.map((gatePass, index) => (
                      <TableRow key={gatePass.id} className={cn(
                        "py-2 transition-all border-b border-slate-50 relative",
                        index % 2 === 0 ? "bg-white" : "bg-slate-50/30",
                        "hover:bg-slate-50/80",
                        ((isAuthority && gatePass.status === 'pending') || (isSecurity && (gatePass.status === 'approved' || gatePass.status === 'used'))) ? "cursor-pointer hover:bg-primary/5 hover:scale-[1.01] hover:shadow-lg hover:z-10 bg-white" : ""
                      )}
                      onClick={() => {
                          if (isAuthority && gatePass.status === 'pending') {
                              setProtocolPass(gatePass);
                          } else if (isSecurity && (gatePass.status === 'approved' || gatePass.status === 'used')) {
                              setSelectedQR(gatePass);
                          }
                      }}>
                        <TableCell 
                          className="py-3.5 text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-black text-xs border border-primary/20 flex-shrink-0">
                              {gatePass.student_name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900 truncate">{gatePass.student_name}</div>
                              <div className="text-[10px] text-gray-400 font-mono">{gatePass.student_hall_ticket}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5 text-xs font-mono text-gray-600">{gatePass.student_hall_ticket || '—'}</TableCell>
                        <TableCell className="py-3.5 text-xs truncate max-w-xs font-medium text-gray-700">{gatePass.destination || '—'}</TableCell>
                        <TableCell className="py-3.5 text-xs truncate max-w-xs text-gray-400 italic">{gatePass.purpose || '—'}</TableCell>
                        <TableCell className="py-3.5 text-xs">
                          <div className="font-semibold text-gray-700">{new Date(gatePass.exit_date || new Date()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                          <div className="text-gray-400 text-[10px]">{gatePass.exit_time || '—'}</div>
                        </TableCell>
                        <TableCell className="py-3.5 text-xs">
                          {gatePass.exit_date && (
                            <div className="text-gray-600"><strong className="text-gray-800">Exit:</strong> {new Date(gatePass.exit_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} {gatePass.exit_time || '—'}</div>
                          )}
                          {gatePass.expected_return_date && (
                            <div className="text-gray-600"><strong className="text-gray-800">Ret:</strong> {new Date(gatePass.expected_return_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} {gatePass.expected_return_time || '—'}</div>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5">{getStatusBadge(gatePass.status)}</TableCell>
                        <TableCell className="py-3.5 text-right">
                          <div className="flex gap-1.5 justify-end flex-wrap">
                              {gatePass.status === 'approved' && !isAuthority && !isSecurity && (
                                <Button
                                  size="sm"
                                  className="h-8 bg-gray-900 hover:bg-gray-800 text-white shadow-md shadow-gray-300/50 transition-all text-xs rounded-xl"
                                  onClick={(e) => { e.stopPropagation(); setSelectedQR(gatePass); }}
                                >
                                  <QrCode className="h-3 w-3 mr-1" />
                                  QR
                                </Button>
                              )}
                            {isAuthority && gatePass.status === 'pending' && (
                               <Badge className="bg-primary/10 text-primary border border-primary/20 pointer-events-none shadow-sm rounded-lg font-bold py-1.5 px-3">
                                 Review Protocol ↗
                               </Badge>
                            )}
                            {isSecurity && (gatePass.status === 'approved' || gatePass.status === 'used') && (
                               <Badge className="bg-primary/10 text-primary border border-primary/20 pointer-events-none shadow-sm rounded-lg font-bold py-1.5 px-3">
                                 Verify Card ↗
                               </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List View */}
              <div className="lg:hidden space-y-5 p-2 sm:p-4">
                {gatePasses.map((gatePass) => (
                  <Card key={gatePass.id} className={cn(
                    "overflow-hidden border border-slate-100 shadow-xl rounded-[2.5rem] transition-all bouncy-hover relative",
                    gatePass.status === 'pending' ? "glass-card ring-1 ring-primary/20" : "bg-white",
                    gatePass.status === 'approved' ? "ring-4 ring-emerald-500/10 bg-emerald-50/30" : "",
                    gatePass.status === 'rejected' ? "ring-4 ring-red-500/10 bg-red-50/20" : "",
                    gatePass.status === 'used' ? "ring-4 ring-slate-900/5 bg-slate-50" : ""
                  )}>
                    {/* Header Pass Effect */}
                    <div className={cn(
                      "h-1.5 w-full absolute top-0 left-0",
                      gatePass.status === 'pending' ? "bg-orange-100" : 
                      gatePass.status === 'approved' ? "bg-emerald-100" :
                      gatePass.status === 'rejected' ? "bg-rose-100" :
                      gatePass.status === 'used' ? "bg-slate-200" : "bg-slate-100"
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
                          ((isAuthority && gatePass.status === 'pending') || (isSecurity && (gatePass.status === 'approved' || gatePass.status === 'used'))) && "cursor-pointer hover:bg-primary/5 active:scale-[0.98] transition-all"
                        )}
                        onClick={() => {
                            if (isAuthority && gatePass.status === 'pending') setProtocolPass(gatePass);
                            else if (isSecurity && (gatePass.status === 'approved' || gatePass.status === 'used')) setSelectedQR(gatePass);
                        }}
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
                        {isSecurity && (gatePass.status === 'approved' || gatePass.status === 'used') && (
                          <div className="mt-1 flex items-center justify-end text-[8px] text-primary/70 font-bold uppercase">
                            Open Card ↗
                          </div>
                        )}
                      </div>
                      
                      {gatePass.status === 'approved' && !isAuthority && !isSecurity && (
                            <Button
                               className="w-full mt-2 rounded-lg bg-primary text-primary-foreground font-semibold h-9 hover:bg-primary/90 shadow-sm transition-all text-xs"
                               onClick={(e) => { e.stopPropagation(); setSelectedQR(gatePass); }}
                             >
                              <QrCode className="h-4 w-4 mr-2" />
                              Show QR Code
                            </Button>
                        )}

                      {/* Inline Authority Actions Removed - Enforced through Modal only */}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-gradient-to-b from-slate-50/50 to-white rounded-2xl m-4 border border-dashed border-slate-200">
              <div className="p-4 bg-primary/5 rounded-2xl mb-4">
                <FileText className="h-10 w-10 text-primary" />
              </div>
              <p className="text-gray-800 font-black text-lg mb-1">No gate passes yet</p>
              <p className="text-sm text-gray-400 font-medium text-center max-w-xs">
                {canCreate 
                  ? "Create your first gate pass to request exit from the hostel" 
                  : "No gate passes match your search criteria"}
              </p>
            </div>
          )}
        </CardContent>
        
        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-border/60 bg-muted/30">
            <div className="text-xs sm:text-sm font-black text-gray-600">
                Page {page} • <span className="text-primary">{totalCount || 0} items</span>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || isLoading}
                    className="h-9 sm:h-8 px-4 text-xs flex-1 sm:flex-initial rounded-xl border-border hover:bg-muted font-semibold"
                >
                    Prev
                </Button>
                <div className="flex items-center justify-center px-3 sm:px-3 min-w-[2.5rem] text-sm font-black text-primary bg-white border border-border rounded-xl h-9 sm:h-8 shadow-sm">
                    {page}
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => p + 1)}
                    disabled={!hasNextPage || isLoading}
                    className="h-9 sm:h-8 px-4 text-xs flex-1 sm:flex-initial rounded-xl border-border hover:bg-muted font-semibold"
                >
                    Next
                </Button>
            </div>
        </div>
      </Card>

      {/* Create Gate Pass Dialog */}
      {canCreate && (
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[85vh] sm:max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-2xl sm:rounded-3xl shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 sm:px-6 py-4 sm:py-5 rounded-t-2xl sm:rounded-t-3xl text-left">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3 text-slate-900">
                <div className="p-2 bg-primary rounded-xl shadow-sm">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                New Gate Pass
              </DialogTitle>
              <DialogDescription className="font-medium text-slate-500">
                Submit an exit request for warden authorization.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Pass Type Selector */}
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Type of Exit *</Label>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
                        ? "border-primary bg-primary/10 shadow-lg shadow-primary/10 scale-[1.02]"
                        : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50"
                    )}
                  >
                    {formData.pass_type === type && (
                       <div className="absolute top-2 right-2 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <div className="text-xl mb-1">{icon}</div>
                    <div className={cn(
                      "text-xs font-black uppercase tracking-wider",
                        formData.pass_type === type ? "text-primary" : "text-gray-700"
                    )}>{label}</div>
                    <div className="text-[10px] text-gray-400 font-medium mt-0.5">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Destination & Purpose */}
            <div className="bg-gray-50/80 rounded-2xl p-3 sm:p-4 space-y-3 sm:space-y-4 border border-gray-100">
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="destination" className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1 flex items-center gap-2">
                  📍 Destination *
                </Label>
                <Input
                  id="destination"
                  placeholder="Where are you going?"
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  className={cn(
                    "rounded-xl border-0 bg-white h-12 focus-visible:ring-primary px-4 font-medium shadow-sm",
                    formErrors.destination && "ring-2 ring-destructive"
                  )}
                />
                {formErrors.destination && <p className="text-[10px] text-destructive font-bold ml-1">{formErrors.destination}</p>}
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="purpose" className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 ml-1 flex items-center gap-2">
                  📋 Purpose *
                </Label>
                <Input
                  id="purpose"
                  placeholder="Why are you going?"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className={cn(
                    "rounded-xl border-0 bg-white h-12 focus-visible:ring-primary px-4 font-medium shadow-sm",
                    formErrors.purpose && "ring-2 ring-destructive"
                  )}
                />
                {formErrors.purpose && <p className="text-[10px] text-destructive font-bold ml-1">{formErrors.purpose}</p>}
              </div>
            </div>

            {/* Date & Time Section */}
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 ml-1 flex items-center gap-2">
                🕐 Schedule
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Exit Date/Time */}
                <div className="bg-primary/5 rounded-2xl p-3 sm:p-4 border border-primary/10 space-y-2 sm:space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 bg-primary rounded-lg flex items-center justify-center">
                      <CalendarIcon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="text-xs font-bold text-primary">Exit</p>
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
            <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10 space-y-3">
              <Label className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <div className="h-5 w-5 bg-primary rounded-lg flex items-center justify-center">
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
              <p className="text-[10px] font-medium text-center text-primary/60">Help wardens understand your request faster with a quick voice note.</p>
            </div>

            {/* Remarks */}
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="remarks" className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Additional Remarks</Label>
              <Textarea
                id="remarks"
                placeholder="Any other details the warden should know..."
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="rounded-xl border-0 bg-gray-50 min-h-[60px] sm:min-h-[80px] focus-visible:ring-primary p-3 sm:p-4 font-medium"
              />
            </div>

            {/* Submit */}
            <div className="sticky bottom-0 z-10 bg-white/90 backdrop-blur-md pt-3 sm:pt-4 -mx-4 sm:-mx-6 px-4 sm:px-6 -mb-4 sm:-mb-6 pb-4 sm:pb-6 border-t border-gray-100 flex flex-col gap-2 sm:gap-3">
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="w-full h-12 sm:h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm sm:text-base uppercase tracking-wider rounded-xl sm:rounded-2xl shadow-lg shadow-primary/10 active:scale-[0.98] transition-all"
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
      {/* QR Code Viewer Dialog - Redesigned as Digital Card */}
      <Dialog open={!!selectedQR} onOpenChange={(open) => !open && setSelectedQR(null)}>
        <DialogContent className="max-w-sm w-[95vw] p-0 border-none bg-transparent shadow-none">
          <div className="perspective-1000">
            <div className="relative transform transition-all duration-500">
              <Card className="w-full aspect-[3/4.5] rounded-3xl overflow-hidden border-2 border-emerald-500/50 shadow-2xl relative bg-white text-black">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5 pointer-events-none" 
                     style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)', backgroundSize: '24px 24px' }}>
                </div>

                {/* Header Stripe */}
                <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-green-400 to-teal-500"></div>

                <CardContent className="flex flex-col items-center p-6 relative z-10 gap-7">
                  {/* Header Row */}
                  <div className="w-full flex justify-between items-center h-10 px-0.5">
                    <div className="flex flex-col">
                        <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em] leading-none mb-1.5">Security Token</p>
                        <p className="font-black text-sm tracking-tight flex items-center gap-1.5 text-emerald-700">
                            <ShieldCheck className="h-4 w-4" />
                            APPROVED PASS
                        </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em] leading-none mb-1.5">Pass ID</p>
                      <p className="font-mono font-black text-sm text-slate-900 leading-none">GP#{selectedQR?.id}</p>
                    </div>
                  </div>

                  {/* Student Identity Card Content */}
                  <div className="flex flex-col items-center w-full">
                    {/* Main Profile Image Focus */}
                    <div className="relative">
                      <div className="w-44 h-44 rounded-[2.5rem] bg-emerald-50 p-1 border-4 border-emerald-500/10 shadow-xl overflow-hidden relative">
                        <img 
                          src={selectedQR?.student_profile_picture || `https://ui-avatars.com/api/?name=${selectedQR?.student_name}&background=ecfdf5&color=047857&bold=true&size=512&font-size=0.35`} 
                          alt={selectedQR?.student_name}
                          className="w-full h-full object-cover rounded-[2.2rem]"
                          onError={(e) => {
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${selectedQR?.student_name}&background=ecfdf5&color=047857&bold=true&size=512&font-size=0.35`;
                          }}
                        />
                      </div>
                      
                      {/* Subordinate QR code */}
                      <div className="absolute -bottom-1 -right-1 p-1.5 bg-white rounded-2xl shadow-2xl border border-emerald-100 w-16 h-16 flex items-center justify-center overflow-hidden transition-transform hover:scale-105">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${selectedQR?.qr_code}`}
                          alt="Small QR"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>

                    <div className="text-center mt-6">
                      <h2 className="text-2xl font-black tracking-tight text-slate-900 leading-tight">{selectedQR?.student_name}</h2>
                      <p className="text-[11px] font-mono font-bold text-slate-400 tracking-widest uppercase mt-0.5">{selectedQR?.student_hall_ticket}</p>
                    </div>

                    <div className="mt-5 bg-emerald-600 text-white px-6 py-2 rounded-full flex items-center gap-2 shadow-lg shadow-emerald-200/50">
                        <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] pt-0.5">Verified Identity</p>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="w-full grid grid-cols-2 gap-3.5">
                    <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100/80">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2">Exit Point</p>
                      <div className="flex items-center gap-2 text-slate-900">
                        <CalendarIcon className="h-3.5 w-3.5 text-emerald-600" />
                        <p className="text-[13px] font-black">{selectedQR?.exit_date ? new Date(selectedQR.exit_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</p>
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 ml-[1.375rem] mt-0.5">{selectedQR?.exit_time || '—'}</p>
                    </div>
                    <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100/80">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2">Return Point</p>
                      <div className="flex items-center gap-2 text-slate-900">
                        <CalendarIcon className="h-3.5 w-3.5 text-emerald-600" />
                        <p className="text-[13px] font-black">{selectedQR?.expected_return_date ? new Date(selectedQR.expected_return_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</p>
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 ml-[1.375rem] mt-0.5">{selectedQR?.expected_return_time || '—'}</p>
                    </div>
                  </div>

                  {/* Security Warning Footer */}
                  <div className="w-full text-center mt-2 border-t border-dashed border-slate-200 pt-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">
                        Valid only for Main Gate Authorization • ID Required for Entry
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          
          <div className="mt-6 flex flex-col gap-3 w-full max-w-sm mx-auto items-center px-4">
             {isSecurity && (selectedQR?.status === 'approved' || selectedQR?.status === 'used') && (
               <div className="w-full mb-2">
                 <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Operating Gate Location</Label>
                 <Select value={selectedGate} onValueChange={setSelectedGate}>
                   <SelectTrigger className="rounded-2xl border-0 bg-slate-50 h-10 font-bold text-xs ring-1 ring-slate-200">
                     <SelectValue placeholder="Select Gate" />
                   </SelectTrigger>
                   <SelectContent className="rounded-2xl border-slate-200 shadow-2xl">
                     <SelectItem value="Main Gate" className="font-bold text-xs rounded-xl my-1">Main Entry Gate (North)</SelectItem>
                     <SelectItem value="Back Gate" className="font-bold text-xs rounded-xl my-1">Back Gate (Service)</SelectItem>
                     <SelectItem value="Side Gate" className="font-bold text-xs rounded-xl my-1">Side Pedestrian Gate</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
             )}

             {isSecurity && selectedQR?.status === 'approved' && (
                <div className="flex gap-3 w-full justify-center">
                    <Button 
                      className="flex-1 rounded-2xl bg-sky-100 text-sky-700 hover:bg-sky-200 h-14 font-black text-xs border-0 shadow-md active:scale-95 transition-all outline-none"
                      onClick={() => {
                          verifyMutation.mutate({ id: selectedQR.id, action: 'check_out', location: selectedGate });
                          setSelectedQR(null);
                      }}
                      disabled={verifyMutation.isPending}
                    >
                      📤 REGISTER EXIT
                    </Button>
                    <Button 
                      className="w-14 rounded-2xl bg-rose-50 text-rose-500 border-0 hover:bg-rose-100 h-14 font-black shadow-md active:scale-95 transition-all outline-none"
                      onClick={() => {
                          verifyMutation.mutate({ id: selectedQR.id, action: 'deny_exit', location: selectedGate });
                          setSelectedQR(null);
                      }}
                       disabled={verifyMutation.isPending}
                    >
                      ✕
                    </Button>
                </div>
             )}

             {isSecurity && selectedQR?.status === 'used' && (
                <Button 
                  className="w-full rounded-2xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-0 h-14 font-black text-xs shadow-md active:scale-95 transition-all outline-none"
                  onClick={() => {
                      verifyMutation.mutate({ id: selectedQR.id, action: 'check_in', location: selectedGate });
                      setSelectedQR(null);
                  }}
                  disabled={verifyMutation.isPending}
                >
                  📥 COMPLETE RETURN
                </Button>
            )}

            <Button 
              className={cn(
                  "rounded-full bg-black text-white hover:bg-slate-900 border-0 h-12 font-black shadow-xl active:scale-95 transition-all outline-none mx-auto",
                  isSecurity && (selectedQR?.status === 'approved' || selectedQR?.status === 'used') 
                    ? "w-3/4 opacity-70 text-xs mt-1" 
                    : "px-8 text-sm"
              )}
              onClick={() => setSelectedQR(null)}
            >
              DISMISS CARD
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ProtocolModal pass={protocolPass} />
    </div>
  );
}
