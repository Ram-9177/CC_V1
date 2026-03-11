
import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, QrCode, AlertCircle, Calendar as CalendarIcon, Clock,
  X, Play, Pause, MapPin, Info, CheckCircle2, ChevronDown, User as UserIcon } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { format, formatDistanceToNow } from 'date-fns';
import { BrandedLoading } from '@/components/common/BrandedLoading';
import { AudioRecorder } from '@/components/AudioRecorder';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
  DialogTitle,
} from '@/components/ui/dialog';
import { api, downloadFile } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { GatePass } from '@/types';
import { toast } from 'sonner';
import { getApiErrorMessage, cn } from '@/lib/utils';
import { validateGatePassForm, sanitizeInput, GatePassFormData } from '@/lib/validation';
import { SEO } from '@/components/common/SEO';
import { DigitalCard } from '@/components/profile/DigitalCard';



export default function GatePassesPage() {
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [searchTicket, setSearchTicket] = useState(searchParams.get('hall_ticket') || '');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
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
  const [isFlipped, setIsFlipped] = useState(false);
  const [protocolPass, setProtocolPass] = useState<GatePass | null>(null);
  const [selectedPass, setSelectedPass] = useState<GatePass | null>(null);
  const [selectedGate] = useState('Main Gate');
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<GatePass | null>(null);
  const [informedConfirmPass, setInformedConfirmPass] = useState<GatePass | null>(null);

  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const isAuthority = ['admin', 'super_admin', 'warden', 'head_warden'].includes(user?.role || '');
  const isSecurity = ['gate_security', 'security_head'].includes(user?.role || '');
  const isStudent = user?.role === 'student';
  const canCreate = isStudent;

  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<GatePass[]>([]);

  const { data: queryData, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['gate-passes', statusFilter, searchTicket, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchTicket) params.append('hall_ticket', searchTicket);

      const response = await api.get(`/gate-passes/?${params.toString()}`);
      return response.data;
    },
    placeholderData: (previousData) => previousData,
    staleTime: 30 * 1000,
  });

  // Infinite scroll logic / Lazy loading
  useEffect(() => {
    if (queryData?.results) {
        if (page === 1) {
            setHistory(queryData.results);
        } else {
            setHistory(prev => {
                const newResults = queryData.results.filter(
                    (r: GatePass) => !prev.some(p => p.id === r.id)
                );
                return [...prev, ...newResults];
            });
        }
    }
  }, [queryData, page]);

  const gatePasses = history;
  const hasNextPage = !!queryData?.next;

  // Real-time updates for gate passes
  useRealtimeQuery('gatepass_created', 'gate-passes');
  useRealtimeQuery('gatepass_approved', 'gate-passes');
  useRealtimeQuery('gatepass_rejected', 'gate-passes');
  useRealtimeQuery('gate_scan_logged', 'gate-passes');
  useRealtimeQuery('gatepass_parent_informed', 'gate-passes');
  useRealtimeQuery('gatepass_updated', 'gate-passes');

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      await api.post('/gate-passes/', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },
    onSuccess: async () => {
      // Direct cache invalidation for instant feedback
      await queryClient.invalidateQueries({ 
        queryKey: ['gate-passes'],
        exact: false,
        refetchType: 'all'
      });
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
      setPage(1);
      // Invalidate dashboard metrics too
      queryClient.invalidateQueries({ queryKey: ['student-bundle'] });
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
      toast.success('Gate pass approved');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to approve'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/gate-passes/${id}/reject/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Gate pass rejected');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to reject'));
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, action, location }: { id: number; action: 'check_out' | 'check_in' | 'deny_exit'; location?: string }) => {
      await api.post(`/gate-passes/${id}/verify/`, { action, location });
    },
    onSuccess: () => {
      toast.success('Applied successfully');
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Operation failed'));
    },
  });

  const markInformedMutation = useMutation({
    mutationFn: async ({ id, approve }: { id: number; approve?: boolean }) => {
      const resp = await api.post(`/gate-passes/${id}/mark_informed/`, { approve });
      return resp.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      
      if (variables.approve) {
        toast.success('Pass Approved after Parental Verification');
      } else {
        toast.success('Parents marked as informed');
      }
      
      if (protocolPass?.id === variables.id) {
        if (variables.approve) {
            setProtocolPass(null);
        } else {
            setProtocolPass({
                ...protocolPass,
                parent_informed: true,
                parent_informed_at: data.parent_informed_at || new Date().toISOString()
            });
        }
      }
      setInformedConfirmPass(null);
    },
    onError: (error) => {
        toast.error(getApiErrorMessage(error, 'Protocol failed'));
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // ── VALIDATION RULES (RUEL 1, 2, 3, 4) ──
    if (isStudent) {
      // 1. Pending Approval Restriction
      // We check the history (which holds the latest passes) for any pending status
      const hasPending = history.some(p => p.status === 'pending');
      if (hasPending) {
        toast.error("You already have a gate pass request waiting for approval. Please wait until it is approved or rejected.");
        return;
      }
      
      // 2. Student Outside Campus Restriction
      // Priority: Check user.student_status from profile
      if (user?.student_status === 'OUTSIDE_HOSTEL') {
        toast.error("You are currently outside the hostel. Gate pass request can only be created after you return to the hostel.");
        return;
      }
    }

    const validation = validateGatePassForm(formData as GatePassFormData);
    if (!validation.isValid) {
      toast.error(validation.errors[0].message);
      return;
    }
    
    const formDataObj = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
        if (value) formDataObj.append(key, sanitizeInput(value as string));
    });
    if (audioBlob) formDataObj.append('audio_brief', audioBlob, 'reason.webm');
    createMutation.mutate(formDataObj);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge className="bg-orange-50 text-orange-600 border-orange-200 uppercase text-[10px] tracking-widest px-2.5">Pending</Badge>;
      case 'approved': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 uppercase text-[10px] tracking-widest px-2.5">Approved</Badge>;
      case 'rejected': return <Badge className="bg-rose-50 text-rose-600 border-rose-100 uppercase text-[10px] tracking-widest px-2.5">Rejected</Badge>;
      case 'used': return <Badge className="bg-slate-100 text-slate-700 border-slate-200 uppercase text-[10px] tracking-widest px-2.5">OUT</Badge>;
      case 'expired': return <Badge className="bg-slate-50 text-slate-400 border-slate-100 uppercase text-[10px] tracking-widest px-2.5">Expired</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const AudioPlayer = ({ url }: { url?: string }) => {
    const [playing, setPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    if (!url) return null;
    const origin = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');
    const audioUrl = url.startsWith('http') ? url : `${origin}${url}`;

    return (
        <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 w-8 rounded-full" onClick={(e) => {
                e.stopPropagation();
                if (audioRef.current) {
                    if (playing) audioRef.current.pause();
                    else audioRef.current.play();
                    setPlaying(!playing);
                }
            }}>
                {playing ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current ml-0.5" />}
            </Button>
            <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">Audio Reason</span>
            <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} className="hidden" />
        </div>
    );
  };

  const ProtocolModal = ({ pass }: { pass: GatePass | null }) => {
    if (!pass) return null;
    const contacts = [
        { label: 'Student', name: pass.student_name, phone: pass.student_phone, icon: '👤' },
        { label: 'Father', name: pass.father_name, phone: pass.father_phone, icon: '👨‍💼' },
        { label: 'Mother', name: pass.mother_name, phone: pass.mother_phone, icon: '👩‍💼' },
        { label: 'Guardian', name: pass.guardian_name, phone: pass.guardian_phone, icon: '🛡️' },
    ].filter(c => !!c.phone);

    return (
        <Dialog open={!!pass} onOpenChange={(open) => !open && setProtocolPass(null)}>
            <DialogContent className="max-w-md rounded-[2rem] p-0 overflow-hidden border-0 shadow-2xl animate-in fade-in zoom-in duration-300">
                <div className="bg-primary/10 p-6 border-b border-primary/20">
                    <DialogTitle className="text-xl font-black text-primary">Security Protocol</DialogTitle>
                    <DialogDescription className="text-xs font-semibold text-primary/60 uppercase tracking-tighter">Phase 1: Direct Verification Call</DialogDescription>
                </div>
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto stylish-scrollbar">
                    <div className="bg-muted/30 p-4 rounded-2xl border border-border group hover:border-primary/50 transition-all">
                        <p className="font-black text-lg group-hover:text-primary transition-colors">{pass.student_name}</p>
                        <p className="text-xs text-muted-foreground">{pass.student_hall_ticket} • Room {pass.student_room}</p>
                    </div>
                    {pass.audio_brief && <AudioPlayer url={pass.audio_brief} />}
                    <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Contact List</p>
                        {contacts.map((c, i) => (
                            <a key={i} href={`tel:${c.phone}`} className="flex items-center justify-between p-4 bg-white border-2 border-slate-50 rounded-2xl hover:border-primary hover:shadow-md transition-all group">
                                <div>
                                    <p className="text-[9px] font-black text-primary uppercase mb-0.5">{c.label}</p>
                                    <p className="text-sm font-black text-slate-700">{c.phone}</p>
                                </div>
                                <Button size="sm" className="rounded-xl h-9 px-4 font-black bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20">CALL NOW</Button>
                            </a>
                        ))}
                    </div>
                    <div className="pt-4 border-t border-dashed space-y-4">
                        <p className="text-xs font-bold text-center text-muted-foreground">Step 2: Parental Confirmation</p>
                        <Button 
                            className={cn(
                                "w-full h-12 rounded-2xl font-black text-sm transition-all shadow-lg text-white", 
                                pass.parent_informed 
                                    ? "bg-emerald-500 shadow-emerald-500/20" 
                                    : "bg-primary shadow-primary/20 hover:scale-[1.02]"
                            )}
                            onClick={() => setInformedConfirmPass(pass)}
                        >
                            {pass.parent_informed ? '✅ PARENTS INFORMED' : 'MARK PARENTS AS INFORMED'}
                        </Button>
                        
                        {pass.parent_informed && (
                            <div className="flex gap-2">
                                <Button className="flex-1 bg-primary text-white font-black rounded-2xl h-11 text-sm shadow-lg shadow-primary/20" onClick={() => { approveMutation.mutate(pass.id); setProtocolPass(null); }}>APPROVE</Button>
                                <Button className="flex-1 bg-rose-500 text-white font-black rounded-2xl h-11 text-sm shadow-lg shadow-rose-500/20" onClick={() => { rejectMutation.mutate(pass.id); setProtocolPass(null); }}>REJECT</Button>
                            </div>
                        )}
                        <Button variant="ghost" className="w-full h-10 rounded-2xl font-bold text-slate-400" onClick={() => setProtocolPass(null)}>Close Protocol</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
  };

  const ParentInformedConfirmModal = ({ pass }: { pass: GatePass | null }) => {
    if (!pass) return null;
    return (
        <Dialog open={!!pass} onOpenChange={(open) => !open && setInformedConfirmPass(null)}>
            <DialogContent className="max-w-sm rounded-[2.5rem] p-8 border-0 shadow-2xl animate-in fade-in zoom-in duration-300">
                <div className="flex flex-col items-center text-center space-y-6">
                    <div className="h-20 w-20 bg-emerald-50 rounded-3xl flex items-center justify-center border-4 border-emerald-100/50">
                        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                    </div>
                    <div className="space-y-2">
                        <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">Parent Informed?</DialogTitle>
                        <DialogDescription className="text-sm font-medium text-slate-500">Confirm if you have verified the outing with parents.</DialogDescription>
                    </div>
                    <div className="w-full grid grid-cols-2 gap-4 pt-4">
                        <Button 
                            disabled={markInformedMutation.isPending || rejectMutation.isPending}
                            className="h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-3xl shadow-xl shadow-emerald-500/20 text-md flex flex-col gap-0.5"
                            onClick={() => markInformedMutation.mutate({ id: pass.id, approve: true })}
                        >
                            {markInformedMutation.isPending ? 'Processing...' : (
                                <>
                                    <span>YES</span>
                                    <span className="text-[10px] opacity-70">Approve Pass</span>
                                </>
                            )}
                        </Button>
                        <Button 
                            variant="outline"
                            disabled={markInformedMutation.isPending || rejectMutation.isPending}
                            className="h-14 border-2 border-rose-100 hover:bg-rose-50 text-rose-600 font-black rounded-3xl text-md flex flex-col gap-0.5 transition-all"
                            onClick={() => {
                                rejectMutation.mutate(pass.id);
                                setInformedConfirmPass(null);
                                setProtocolPass(null);
                            }}
                        >
                            <span>NO</span>
                             <span className="text-[10px] opacity-70">Reject Pass</span>
                        </Button>
                    </div>
                    <Button variant="ghost" className="text-slate-400 font-bold" onClick={() => setInformedConfirmPass(null)}>Go Back</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
  };

  const isCurrentlyOut = gatePasses.some(gp => gp.status === 'used' && gp.student_id === user?.id);

  return (
    <div className="w-full space-y-6 pb-20">
      <SEO title="Gate Passes" description="Manage student gate pass requests and history." />
      
      <div className="bg-primary/10 rounded-3xl p-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
           <div>
              <h1 className="text-2xl font-black text-primary tracking-tight">Gate Passes</h1>
              <p className="text-primary/60 text-sm font-medium">Institutional Movement Management</p>
           </div>
           <div className="flex gap-2 w-full sm:w-auto">
             {canCreate && (
                <Button onClick={() => isCurrentlyOut ? toast.error("You are currently OUT") : setCreateDialogOpen(true)} className="flex-1 sm:flex-none h-10 bg-primary text-white rounded-2xl font-black px-5 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> NEW PASS
                </Button>
             )}
             {isAuthority && (
                <Button variant="outline" onClick={() => downloadFile('/gate-passes/export_csv/', 'gate_passes.csv')} className="h-10 rounded-2xl font-bold px-5 text-xs">
                    EXPORT CSV
                </Button>
             )}
           </div>
        </div>
      </div>

      <Card className="rounded-[2rem] border-0 shadow-lg shadow-slate-200/50">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search hall ticket..." value={searchTicket} onChange={(e) => { setSearchTicket(e.target.value); setPage(1); }} className="pl-10 h-11 rounded-xl bg-muted/30 border-0" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-48 h-11 rounded-xl bg-muted/30 border-0">
                    <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="used">OUT</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
         {isLoading && page === 1 ? (
            <BrandedLoading message="Loading movement logs..." />
         ) : gatePasses.length > 0 ? (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block bg-white rounded-3xl border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead className="font-black text-[10px] uppercase">Student</TableHead>
                            <TableHead className="font-black text-[10px] uppercase">Destination</TableHead>
                            <TableHead className="font-black text-[10px] uppercase">Exit/Return</TableHead>
                            <TableHead className="font-black text-[10px] uppercase">Status</TableHead>
                            <TableHead className="font-black text-[10px] uppercase text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {gatePasses.map(pass => (
                            <TableRow key={pass.id} className="cursor-pointer hover:bg-muted/20" onClick={() => {
                                if (isAuthority && pass.status === 'pending') setProtocolPass(pass);
                                else if (isSecurity && (pass.status === 'approved' || pass.status === 'used')) setSelectedQR(pass);
                                else setSelectedPass(pass);
                            }}>
                                <TableCell onClick={(e) => {
                                    if (isAuthority || isSecurity) {
                                        e.stopPropagation();
                                        setSelectedStudentForCard(pass);
                                    }
                                }}>
                                    <div className={cn("font-bold", (isAuthority || isSecurity) && "hover:text-primary transition-colors hover:underline decoration-dotted")}>
                                        {pass.student_name}
                                    </div>
                                    <div className="text-[10px] font-mono text-muted-foreground">{pass.student_hall_ticket}</div>
                                </TableCell>
                                <TableCell className="text-xs font-semibold">{pass.destination}</TableCell>
                                <TableCell className="text-xs">
                                    <p className="font-bold">Out: {pass.exit_date} {pass.exit_time}</p>
                                    <p className="text-muted-foreground">In: {pass.expected_return_date} {pass.expected_return_time}</p>
                                </TableCell>
                                <TableCell>{getStatusBadge(pass.status)}</TableCell>
                                <TableCell className="text-right">
                                    {(pass.status === 'approved' && isStudent) && (
                                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedQR(pass); }}>
                                            <QrCode className="h-4 w-4" />
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden space-y-4">
                 {gatePasses.map(pass => (
                    <Card key={pass.id} className="rounded-[2rem] border shadow-sm active:scale-[0.98] transition-all cursor-pointer overflow-hidden" onClick={() => {
                        if (isAuthority && pass.status === 'pending') setProtocolPass(pass);
                        else if (isSecurity && (pass.status === 'approved' || pass.status === 'used')) setSelectedQR(pass);
                        else setSelectedPass(pass);
                    }}>
                        <div className={cn("h-1 w-full", pass.status === 'approved' ? 'bg-emerald-500' : pass.status === 'pending' ? 'bg-orange-500' : 'bg-slate-300')} />
                        <CardHeader className="p-4 flex flex-row items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center font-black text-primary hover:bg-primary/20 transition-colors"
                                     onClick={(e) => {
                                         if (isAuthority || isSecurity) {
                                             e.stopPropagation();
                                             setSelectedStudentForCard(pass);
                                         }
                                     }}>
                                    {pass.student_name[0]}
                                </div>
                                <div onClick={(e) => {
                                         if (isAuthority || isSecurity) {
                                             e.stopPropagation();
                                             setSelectedStudentForCard(pass);
                                         }
                                     }}>
                                    <p className={cn("font-black text-sm", (isAuthority || isSecurity) && "hover:text-primary")}>{pass.student_name}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground tracking-widest">{pass.student_hall_ticket}</p>
                                </div>
                            </div>
                            {getStatusBadge(pass.status)}
                        </CardHeader>
                        <CardContent className="p-4 pt-0 grid grid-cols-2 gap-3">
                            <div className="bg-muted/30 p-2 rounded-xl border border-border/50">
                                <p className="text-[8px] font-black text-muted-foreground uppercase">Exit</p>
                                <p className="text-[10px] font-bold leading-tight mt-1">{pass.exit_date} • {pass.exit_time}</p>
                            </div>
                            <div className="bg-muted/30 p-2 rounded-xl border border-border/50">
                                <p className="text-[8px] font-black text-muted-foreground uppercase">Return</p>
                                <p className="text-[10px] font-bold leading-tight mt-1">{pass.expected_return_date} • {pass.expected_return_time}</p>
                            </div>
                        </CardContent>
                    </Card>
                 ))}
              </div>

              {hasNextPage && (
                <div className="flex justify-center pt-4">
                    <Button variant="ghost" className="rounded-2xl font-black text-xs text-primary bg-primary/5 h-12 px-8 flex items-center gap-2" onClick={() => setPage(page + 1)} disabled={isPlaceholderData}>
                        {isPlaceholderData ? 'LOADING...' : <>LOAD MORE HISTORY <ChevronDown className="h-4 w-4" /></>}
                    </Button>
                </div>
              )}
            </>
         ) : (
            <div className="p-10 text-center bg-muted/10 rounded-[3rem] border-2 border-dashed">
                <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="font-black text-lg text-muted-foreground">No records found</p>
            </div>
         )}
      </div>

      {/* PASS DETAIL MODAL (REUSED FROM DASHBOARD) */}
      <Dialog open={!!selectedPass} onOpenChange={(open) => !open && setSelectedPass(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 rounded-[2.5rem] shadow-2xl">
          <div className={cn(
            "p-6 text-white relative",
            selectedPass?.status === 'approved' ? 'bg-emerald-600' :
            selectedPass?.status === 'used' ? 'bg-blue-600' :
            selectedPass?.status === 'pending' ? 'bg-orange-500' : 'bg-slate-800'
          )}>
            <div className="absolute top-4 right-4 h-8 w-8 bg-black/10 rounded-full flex items-center justify-center cursor-pointer hover:bg-black/20" onClick={() => setSelectedPass(null)}>
              <X className="h-5 w-5" />
            </div>
            <div className="flex flex-col gap-4">
               <div className="h-16 w-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                  <QrCode className="h-10 w-10" />
               </div>
               <div>
                  <Badge variant="outline" className="text-white border-white/40 font-black text-[10px] uppercase mb-1">
                    #{selectedPass?.id} • Institutional Gate Pass
                  </Badge>
                  <DialogTitle className="text-2xl font-black text-white tracking-tight">
                    {selectedPass?.status === 'used' ? 'Currently OUT' : 
                     selectedPass?.status === 'approved' ? 'Ready for Exit' : 
                     selectedPass?.status === 'rejected' ? 'Pass Rejected' : 'Pending Review'}
                  </DialogTitle>
               </div>
            </div>
          </div>

          <div className="p-6 space-y-6 bg-white overflow-y-auto max-h-[70vh]">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Planned Exit</p>
                <div className="flex items-center gap-2 font-black text-sm text-black">
                  <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                  {selectedPass?.exit_date || '—'}
                </div>
                <div className="flex items-center gap-2 font-bold text-xs pl-5.5 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {selectedPass?.exit_time || '—'}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Expected Return</p>
                <div className="flex items-center gap-2 font-black text-sm text-black">
                   <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                   {selectedPass?.expected_return_date || '—'}
                </div>
                <div className="flex items-center gap-2 font-bold text-xs pl-5.5 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {selectedPass?.expected_return_time || '—'}
                </div>
              </div>
            </div>

            <div className="space-y-3">
               <div className="p-4 bg-muted/30 rounded-2xl border border-dashed border-border space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-primary mt-1" />
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Destination</p>
                      <p className="text-sm font-bold text-black">{selectedPass?.destination}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Info className="h-4 w-4 text-primary mt-1" />
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Purpose/Reason</p>
                      <p className="text-sm font-medium text-slate-600">{selectedPass?.purpose}</p>
                    </div>
                  </div>
               </div>

               {selectedPass?.status === 'approved' && (
                  <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <div>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Approved At</p>
                      <p className="text-xs font-black text-emerald-900">{selectedPass?.updated_at ? format(new Date(selectedPass.updated_at), 'PPP · p') : '—'}</p>
                    </div>
                    {selectedPass?.approved_by_name && (
                      <div className="text-right">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">By Authority</p>
                        <p className="text-xs font-black text-emerald-900">{selectedPass.approved_by_name}</p>
                      </div>
                    )}
                  </div>
               )}

               {selectedPass?.approval_remarks && (
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Official Remarks</p>
                    <p className="text-xs font-medium text-blue-900 italic">{selectedPass.approval_remarks}</p>
                  </div>
               )}

               {selectedPass?.status === 'used' && selectedPass?.actual_exit_at && (
                  <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-200">
                    <div className="flex justify-between items-center mb-2">
                       <p className="text-[10px] font-black uppercase tracking-widest text-primary">Live Tracking</p>
                       <Badge className="bg-primary/20 text-primary border-primary/20 text-[9px] font-black animate-pulse">MONITORED</Badge>
                    </div>
                    <div className="space-y-3">
                       <div className="flex justify-between items-center text-xs">
                          <span className="font-medium text-slate-400">Exit Logged At</span>
                          <span className="font-black">{format(new Date(selectedPass.actual_exit_at), 'p')}</span>
                       </div>
                       <div className="h-px bg-white/10" />
                       <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-slate-400">Remaining Time</span>
                          <span className="text-lg font-black text-primary">
                            {selectedPass.expected_return_date ? formatDistanceToNow(new Date(selectedPass.expected_return_date + (selectedPass.expected_return_time ? 'T' + selectedPass.expected_return_time : '')), { addSuffix: false }) : '—'}
                          </span>
                       </div>
                    </div>
                  </div>
               )}
            </div>
            
            {(selectedPass?.status === 'approved' && isStudent) && (
                <Button className="w-full h-10 rounded-2xl font-black bg-primary text-primary-foreground mb-2 text-xs" onClick={() => { setSelectedPass(null); setSelectedQR(selectedPass); }}>
                    SHOW QR CARD
                </Button>
            )}

            <Button className="w-full h-10 rounded-2xl font-black bg-slate-100 text-slate-900 border-0 text-xs" onClick={() => setSelectedPass(null)}>
               DISMISS
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR/DIGITAL CARD MODAL */}
      <Dialog open={!!selectedQR} onOpenChange={(open) => {
          if (!open) {
              setSelectedQR(null);
              setIsFlipped(false);
          }
      }}>
        <DialogContent className="max-w-sm w-[95vw] p-0 border-none bg-transparent shadow-none">
          <div className="perspective-1000 w-full h-full flex justify-center items-center">
            <div 
                className={cn(
                    "relative w-full aspect-[3/4.6] transition-all duration-700 ease-in-out preserve-3d cursor-pointer",
                    isFlipped ? "rotate-y-180" : ""
                )}
                onClick={() => setIsFlipped(!isFlipped)}
            >
              {/* FRONT SIDE */}
              <Card className="absolute inset-0 w-full h-full rounded-3xl overflow-hidden border-2 border-emerald-500/50 shadow-2xl bg-white text-black backface-hidden">
                <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-green-400 to-teal-500"></div>
                <CardContent className="flex flex-col items-center p-6 relative gap-7 h-full">
                  <div className="w-full flex justify-between items-center">
                    <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em]">Security Pass</p>
                    <p className="font-mono font-black text-sm text-slate-900">GP#{selectedQR?.id}</p>
                  </div>
                  <div className="flex flex-col items-center w-full">
                    <div className="w-44 h-44 rounded-[2.5rem] bg-emerald-50 p-1 border-4 border-emerald-500/10 overflow-hidden relative shadow-lg">
                      <img 
                        src={selectedQR?.student_profile_picture || `https://ui-avatars.com/api/?name=${selectedQR?.student_name}&background=ecfdf5&color=047857&bold=true&size=128`} 
                        alt={selectedQR?.student_name}
                        className="w-full h-full object-cover rounded-[2.2rem]"
                      />
                      <div className="absolute -bottom-1 -right-1 p-1 bg-white rounded-xl shadow-xl w-14 h-14 border border-emerald-100">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${selectedQR?.qr_code}`} className="w-full h-full" />
                      </div>
                    </div>
                    <div className="text-center mt-6">
                      <h2 className="text-2xl font-black text-slate-900">{selectedQR?.student_name}</h2>
                      <p className="text-[10px] font-mono font-bold text-slate-400 uppercase mt-0.5">{selectedQR?.student_hall_ticket}</p>
                    </div>
                  </div>
                  <div className="w-full grid grid-cols-2 gap-3.5 mt-auto mb-4">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Out</p>
                      <p className="text-xs font-black">{selectedQR?.exit_date}</p>
                      <p className="text-[10px] font-bold text-slate-500">{selectedQR?.exit_time}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">In</p>
                      <p className="text-xs font-black">{selectedQR?.expected_return_date}</p>
                      <p className="text-[10px] font-bold text-slate-500">{selectedQR?.expected_return_time}</p>
                    </div>
                  </div>
                  <p className="text-[9px] font-black text-primary/40 uppercase animate-pulse">Tap to Flip 🔄</p>
                </CardContent>
              </Card>

              {/* BACK SIDE */}
              <Card className="absolute inset-0 w-full h-full rounded-3xl overflow-hidden border-2 border-slate-900/50 shadow-2xl bg-[#090909] text-white rotate-y-180 backface-hidden">
                <div className="h-2 w-full bg-primary/80"></div>
                <CardContent className="p-7 flex flex-col h-full">
                  <h3 className="text-xl font-black tracking-tighter text-white">SMG HOSTELS</h3>
                  <div className="space-y-6 mt-8 flex-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-[8px] font-black text-white/30 uppercase">Building</p>
                            <p className="text-xs font-black">{selectedQR?.hostel_name || 'Main Block'}</p>
                        </div>
                        <div className="text-right space-y-1">
                            <p className="text-[8px] font-black text-white/30 uppercase">Room</p>
                            <p className="text-xs font-black">{selectedQR?.student_room || 'N/A'}</p>
                        </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                        <p className="text-[8px] font-black text-primary uppercase">Authorized By</p>
                        <p className="text-sm font-black">{selectedQR?.approved_by_name || 'System Authority'}</p>
                        <p className="text-[10px] text-white/40 mt-2 italic">{selectedQR?.updated_at}</p>
                    </div>
                  </div>
                  <div className="mt-auto text-center">
                    <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.4em]">SECURE INSTITUTIONAL ACCESS</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          
          <div className="mt-4 flex flex-col items-center px-4 gap-3">
             {isSecurity && selectedQR?.status === 'approved' && (
                <Button className="w-full rounded-2xl bg-sky-500 text-white h-11 font-black shadow-md text-sm" onClick={() => { verifyMutation.mutate({ id: selectedQR.id, action: 'check_out', location: selectedGate }); setSelectedQR(null); }}>
                   📤 REGISTER EXIT
                </Button>
             )}
             {isSecurity && selectedQR?.status === 'used' && (
                <Button className="w-full rounded-2xl bg-emerald-500 text-white h-11 font-black shadow-md text-sm" onClick={() => { verifyMutation.mutate({ id: selectedQR.id, action: 'check_in', location: selectedGate }); setSelectedQR(null); }}>
                   📥 COMPLETE RETURN
                </Button>
             )}
             <Button className="px-8 rounded-full bg-black text-white h-10 font-black text-xs" onClick={() => setSelectedQR(null)}>DISMISS</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProtocolModal pass={protocolPass} />
      <ParentInformedConfirmModal pass={informedConfirmPass} />
      
      {/* CREATE DIALOG */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden border-0 rounded-[2rem] sm:rounded-[3rem] shadow-2xl">
          <div className="bg-primary p-6 sm:p-8 text-white relative">
            <div className="flex flex-col gap-2">
              <Badge variant="outline" className="w-fit text-white border-white/40 font-black text-[10px] uppercase tracking-widest px-2 py-0.5 mb-1 bg-white/10">Institutional Protocol</Badge>
              <DialogTitle className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                  <CheckCircle2 className="h-6 w-6 sm:h-7 sm:w-7" />
                </div>
                Request Gate Pass
              </DialogTitle>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-5 sm:space-y-6 bg-white overflow-y-auto max-h-[75vh] stylish-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {/* Type & Destination */}
              <div className="space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Pass Type</Label>
                  <Select 
                    value={formData.pass_type} 
                    onValueChange={(v: 'day' | 'overnight' | 'weekend' | 'emergency') => setFormData({ ...formData, pass_type: v })}
                  >
                    <SelectTrigger className="rounded-xl border-0 bg-gray-50 h-11 sm:h-12 font-bold focus:ring-primary shadow-sm">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-gray-100 shadow-2xl">
                      <SelectItem value="day" className="font-bold rounded-xl my-1">🌞 Day Visit</SelectItem>
                      <SelectItem value="overnight" className="font-bold rounded-xl my-1">🌙 Overnight</SelectItem>
                      <SelectItem value="weekend" className="font-bold rounded-xl my-1">🏠 Weekend Home</SelectItem>
                      <SelectItem value="emergency" className="font-bold rounded-xl my-1">🚨 Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="destination" className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Destination</Label>
                  <Input
                    id="destination"
                    placeholder="Where are you going?"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    className="rounded-xl border-0 bg-gray-50 h-11 sm:h-12 font-bold focus-visible:ring-primary shadow-sm"
                  />
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="purpose" className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Purpose/Reason</Label>
                  <Input
                    id="purpose"
                    placeholder="Brief reason for outing"
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    className="rounded-xl border-0 bg-gray-50 h-11 sm:h-12 font-bold focus-visible:ring-primary shadow-sm"
                  />
                </div>
              </div>

              {/* Timing */}
              <div className="space-y-4">
                <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 space-y-3 shadow-sm">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1 flex items-center gap-2">
                    <Clock className="h-3 w-3" /> Exit Schedule
                  </p>
                  <DatePicker
                    date={formData.exit_date ? new Date(formData.exit_date) : undefined}
                    onSelect={(date) => setFormData({ ...formData, exit_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                    className="w-full rounded-xl border-0 bg-white shadow-sm h-11 font-medium"
                  />
                  <TimePicker
                    value={formData.exit_time}
                    onChange={(e) => setFormData({ ...formData, exit_time: e.target.value })}
                    className="w-full rounded-xl border-0 bg-white shadow-sm h-11 font-medium px-4"
                  />
                </div>

                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 space-y-3 shadow-sm">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3" /> Return Schedule
                  </p>
                  <DatePicker
                    date={formData.expected_return_date ? new Date(formData.expected_return_date) : undefined}
                    onSelect={(date) => setFormData({ ...formData, expected_return_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                    className="w-full rounded-xl border-0 bg-white shadow-sm h-11 font-medium"
                  />
                  <TimePicker
                    value={formData.expected_return_time}
                    onChange={(e) => setFormData({ ...formData, expected_return_time: e.target.value })}
                    className="w-full rounded-xl border-0 bg-white shadow-sm h-11 font-medium px-4"
                  />
                </div>
              </div>
            </div>

            <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10 space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <Play className="h-3 w-3 fill-current" /> Voice Explanation (Optional)
              </Label>
              <div className="flex justify-center">
                <AudioRecorder 
                  onRecordingComplete={(blob) => setAudioBlob(blob)} 
                  onClear={() => setAudioBlob(null)}
                />
              </div>
              <p className="text-[10px] font-medium text-center text-primary/60">Voice notes help wardens process requests faster.</p>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="remarks" className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Additional Remarks</Label>
              <Textarea
                id="remarks"
                placeholder="Any other details..."
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="rounded-xl border-0 bg-gray-50 min-h-[80px] focus:ring-primary p-4 font-medium"
              />
            </div>

            <div className="pt-4 border-t border-gray-100 flex flex-col gap-3">
              <Button type="submit" disabled={createMutation.isPending} className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-black text-base uppercase rounded-2xl shadow-xl shadow-primary/10">
                {createMutation.isPending ? 'SYNCHRONIZING...' : '✓ SUBMIT REQUEST'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCreateDialogOpen(false)} className="w-full h-10 font-bold text-gray-400 uppercase tracking-widest text-[10px]">
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* STUDENT DIGITAL CARD MODAL */}
      <Dialog open={!!selectedStudentForCard} onOpenChange={(open) => !open && setSelectedStudentForCard(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 rounded-[2.5rem] shadow-2xl bg-transparent">
          {selectedStudentForCard?.student_details ? (
             <DigitalCard 
                user={selectedStudentForCard.student_details} 
                gatePass={selectedStudentForCard}
             />
          ) : (
            <div className="p-10 bg-white rounded-[2.5rem] text-center space-y-4">
              <div className="h-20 w-20 bg-muted rounded-full mx-auto animate-pulse flex items-center justify-center">
                 <UserIcon className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <p className="font-black text-muted-foreground">Loading Student Profile...</p>
            </div>
          )}
          <Button variant="ghost" className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full h-10 w-10 p-0" onClick={() => setSelectedStudentForCard(null)}>
            <X className="h-6 w-6" />
          </Button>
        </DialogContent>
      </Dialog>
      
      {/* Mutation Progress indicators happen inside the dialog/button levels */}
    </div>
  );
}
