import { useState, useRef, useEffect, useMemo, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Search, QrCode, AlertCircle, Calendar as CalendarIcon, Clock, Play, Pause, MapPin, Info, CheckCircle2, ChevronDown, User as UserIcon, Phone, X } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { format, formatDistanceToNow } from 'date-fns';
import { ListSkeleton } from '@/components/common/PageSkeleton';
import { AudioRecorder } from '@/components/AudioRecorder';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QRScanner } from '@/components/QRScanner';
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
import { downloadFile } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { GatePass } from '@/types';
import { toast } from 'sonner';
import { getApiErrorMessage, cn, formatDateForAPI } from '@/lib/utils';
import { validateGatePassForm, sanitizeInput, GatePassFormData } from '@/lib/validation';
import { SEO } from '@/components/common/SEO';
import { DigitalCard } from '@/components/profile/DigitalCard';
import { isWarden, isSecurity as isSecurityRole, isStudent as isStudentRole } from '@/lib/rbac';
import {
  useGatePassesList,
  useRequestGatePass,
  useApproveGatePass,
  useRejectGatePass,
  useVerifyGatePass,
  useScanQRCode,
} from '@/hooks/features/useGatePasses';

const MAX_HISTORY_ITEMS = 500;


export default function GatePassesPage() {
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [searchTicket, setSearchTicket] = useState(searchParams.get('hall_ticket') || '');
  const [activeView, setActiveView] = useState<'overview' | 'history'>('overview');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
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
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const isAuthority = isWarden(user?.role);
  const isSecurity = isSecurityRole(user?.role);
  const isStudent = isStudentRole(user?.role);
  const canCreate = isStudent;

  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<GatePass[]>([]);

  type GatePassListResponse = { results?: GatePass[]; next?: string | null } | GatePass[];
  
  const parentRef = useRef<HTMLDivElement>(null);

  const { data: queryData, isLoading, isFetching } = useGatePassesList<GatePassListResponse>({
    status: statusFilter,
    hall_ticket: searchTicket,
    page,
  });

  // Infinite scroll logic / Lazy loading
  useEffect(() => {
    if (!queryData) return;

    const currentPageResults = Array.isArray(queryData)
      ? queryData
      : (queryData.results || []);

    if (page === 1) {
      setHistory(currentPageResults.slice(0, MAX_HISTORY_ITEMS));
    } else {
      setHistory(prev => {
        const newResults = currentPageResults.filter(
          (r: GatePass) => !prev.some(p => p.id === r.id)
        );
        return [...prev, ...newResults].slice(-MAX_HISTORY_ITEMS);
      });
    }
  }, [queryData, page]);

  const gatePasses = history;
  const hasNextPage = !Array.isArray(queryData) && !!queryData?.next;

  useEffect(() => {
    setShowOnboarding(localStorage.getItem('onboarding:gate-passes:v1') !== 'dismissed');
  }, []);

  const dismissOnboarding = () => {
    localStorage.setItem('onboarding:gate-passes:v1', 'dismissed');
    setShowOnboarding(false);
  };

  const rowVirtualizer = useVirtualizer({
    count: gatePasses.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180, // Precise measurement of Gate Pass Mobile Card
    overscan: 2, // Minimal memory footprint setting
  });

  // Real-time updates for gate passes (single subscription = lower listener overhead)
  useRealtimeQuery(
    [
      'gatepass_created',
      'gatepass_approved',
      'gatepass_rejected',
      'gate_scan_logged',
      'gatepass_parent_informed',
      'gatepass_updated',
    ],
    'gate-passes'
  );

  const createHook = useRequestGatePass();
  const createMutation = {
    ...createHook,
    mutate: (data: FormData) => {
      createHook.mutate(data, {
        onSuccess: async () => {
          toast.success('Gate pass created successfully');
          setInlineError(null);
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
        },
        onError: (error: unknown) => {
          const message = getApiErrorMessage(error, 'Failed to create gate pass');
          const normalized = message.toLowerCase();
          if (
            normalized.includes('active or pending gate pass') ||
            normalized.includes('already has an active') ||
            normalized.includes('already have a gate pass request')
          ) {
            setInlineError('You already have a gate pass request in progress. Wait for approval or rejection before applying again.');
            toast.error('You already have a gate pass request in progress. Wait for approval or rejection before applying again.');
            return;
          }
          setInlineError(message);
          toast.error(message);
        },
      });
    },
  };

  const approveHook = useApproveGatePass();
  const approveMutation = {
    ...approveHook,
    mutate: (params: { id: number; remarks: string; parent_informed: boolean }) => {
      approveHook.mutate(params, {
        onSuccess: (updatedPass) => {
          queryClient.setQueriesData({ queryKey: ['gate-passes'] }, (old: unknown) => {
            const typed = old as { results?: GatePass[] } | GatePass[] | undefined;
            if (!typed) return typed;
            if (Array.isArray(typed)) {
              return typed.map((p) => (p.id === updatedPass.id ? updatedPass : p));
            }
            if (Array.isArray(typed.results)) {
              return {
                ...typed,
                results: typed.results.map((p) => (p.id === updatedPass.id ? updatedPass : p)),
              };
            }
            return typed;
          });
          setHistory((prev) => prev.map((p) => (p.id === updatedPass.id ? updatedPass : p)));
          toast.success('Gate pass approved');
          setInlineError(null);
          setProtocolPass(null);
        },
        onError: (error: unknown) => {
          const message = getApiErrorMessage(error, 'Failed to approve');
          setInlineError(message);
          toast.error(message);
        },
      });
    },
  };

  const rejectHook = useRejectGatePass();
  const rejectMutation = {
    ...rejectHook,
    mutate: (params: { id: number; remarks: string }) => {
      rejectHook.mutate(params, {
        onSuccess: () => {
          toast.success('Gate pass rejected');
          setInlineError(null);
          setProtocolPass(null);
        },
        onError: (error: unknown) => {
          const message = getApiErrorMessage(error, 'Failed to reject');
          setInlineError(message);
          toast.error(message);
        },
      });
    },
  };

  const verifyHook = useVerifyGatePass();
  const verifyMutation = {
    ...verifyHook,
    mutate: (params: { id: number; action: 'check_out' | 'check_in' | 'deny_exit'; location?: string }) => {
      verifyHook.mutate(params, {
        onSuccess: () => {
          toast.success('Movement logged successfully');
          setInlineError(null);
        },
        onError: (error: unknown) => {
          const message = getApiErrorMessage(error, 'Operation failed');
          setInlineError(message);
          toast.error(message);
        },
      });
    },
  };

  const scanHook = useScanQRCode();
  const scanMutation = {
    ...scanHook,
    mutate: (qrCode: string) => {
      scanHook.mutate({ digital_qr: qrCode, location: selectedGate }, {
        onSuccess: (data) => {
          toast.success(`Scanned: ${data.student_name} (${data.status.toUpperCase()})`);
          setInlineError(null);
          setIsScannerOpen(false);
        },
        onError: (error: unknown) => {
          const message = getApiErrorMessage(error, 'Scan failed');
          setInlineError(message);
          toast.error(message);
        },
      });
    },
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // ── VALIDATION RULES (RUEL 1, 2, 3, 4) ──
    if (isStudent) {
      // 1. Pending Approval Restriction
      // We check the history (which holds the latest passes) for any pending status
      const hasPending = history.some(p => p.status === 'pending');
      if (hasPending) {
        setInlineError('You already have a gate pass request waiting for approval. Please wait until it is approved or rejected.');
        toast.error("You already have a gate pass request waiting for approval. Please wait until it is approved or rejected.");
        return;
      }
      
      // 2. Student Outside Campus Restriction
      // Priority: Check user.student_status from profile
      if (user?.student_status === 'OUTSIDE_HOSTEL') {
        setInlineError('You are currently outside the hostel. Gate pass request can only be created after you return to the hostel.');
        toast.error("You are currently outside the hostel. Gate pass request can only be created after you return to the hostel.");
        return;
      }
    }

    const validation = validateGatePassForm(formData as GatePassFormData);
    if (!validation.isValid) {
      setInlineError(validation.errors[0].message);
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

  const getStatusBadge = (status: string, pass?: GatePass) => {
    const commonClasses = "uppercase text-[10px] tracking-widest px-2.5 rounded-sm h-5 flex items-center justify-center font-black";
    
    switch (status) {
      case 'draft': return <Badge className={cn(commonClasses, "bg-slate-50 text-slate-400 border-slate-200")}>Draft</Badge>;
      case 'pending': return <Badge className={cn(commonClasses, "bg-orange-50 text-orange-600 border-orange-200")}>Pending</Badge>;
      case 'approved': return <Badge className={cn(commonClasses, "bg-emerald-100 text-emerald-700 border-emerald-200")}>Approved</Badge>;
      case 'out': return <Badge className={cn(commonClasses, "bg-rose-100 text-rose-700 border-rose-200")}>OUT</Badge>;
      case 'in': return <Badge className={cn(commonClasses, "bg-sky-100 text-sky-700 border-sky-200")}>IN</Badge>;
      case 'completed': return <Badge className={cn(commonClasses, "bg-indigo-100 text-indigo-700 border-indigo-200")}>Completed</Badge>;
      case 'rejected': return <Badge className={cn(commonClasses, "bg-rose-50 text-rose-600 border-rose-200 uppercase")}>Rejected</Badge>;
      case 'late_return': return <Badge className={cn(commonClasses, "bg-red-100 text-red-700 border-red-200")}>LATE RETURN ({pass?.late_minutes}m)</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMovementBadge = (movementStatus?: string) => {
    switch (movementStatus || 'pending') {
      case 'inside':
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 uppercase text-[10px] tracking-widest px-2.5">INSIDE</Badge>;
      case 'outside':
        return <Badge className="bg-rose-100 text-rose-700 border-rose-200 uppercase text-[10px] tracking-widest px-2.5">OUTSIDE</Badge>;
      case 'returned':
        return <Badge className="bg-sky-100 text-sky-700 border-sky-200 uppercase text-[10px] tracking-widest px-2.5">RETURNED</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 uppercase text-[10px] tracking-widest px-2.5">PENDING</Badge>;
    }
  };

  const getTrackingPhase = (pass?: GatePass | null) => {
    if (!pass) return 0;
    if (pass.status === 'rejected') return -1;
    if (pass.status === 'completed') return 5;
    if (pass.actual_entry_at || pass.movement_status === 'returned' || pass.status === 'returned' || pass.status === 'in') return 4;
    if (pass.actual_exit_at || pass.movement_status === 'outside' || pass.status === 'outside' || pass.status === 'out' || pass.status === 'used' || pass.status === 'late_return') return 3;
    if (pass.status === 'approved') return 2;
    return 1;
  };

  const trackingStats = useMemo(() => ({
    requested: gatePasses.length,
    approved: gatePasses.filter((p) => p.status === 'approved' || p.status === 'out' || p.status === 'outside' || p.status === 'used' || p.status === 'in' || p.status === 'returned' || p.status === 'completed').length,
    outside: gatePasses.filter((p) => p.movement_status === 'outside' || p.status === 'outside' || p.status === 'out' || p.status === 'used').length,
    returned: gatePasses.filter((p) => p.actual_entry_at || p.movement_status === 'returned' || p.status === 'returned' || p.status === 'in' || p.status === 'completed').length,
    rejected: gatePasses.filter((p) => p.status === 'rejected').length,
  }), [gatePasses]);

  const latestTrackedPass = gatePasses[0] || null;
  const latestTrackingPhase = getTrackingPhase(latestTrackedPass);
  const trackSteps = useMemo(() => ['Requested', 'Approved', 'Out Scan', 'Return Scan', 'Closed'], []);

  const AudioPlayer = memo(({ url }: { url?: string }) => {
    const [playing, setPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    if (!url) return null;
    const origin = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');
    const audioUrl = url.startsWith('http') ? url : `${origin}${url}`;

    return (
        <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 w-8 rounded-sm" onClick={(e) => {
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
  });

  const ProtocolModal = ({ pass }: { pass: GatePass | null }) => {
    const [remarks, setRemarks] = useState('');
    const [parentInformed, setParentInformed] = useState(pass?.parent_informed || false);

    useEffect(() => {
        if (pass) {
            setRemarks('');
            setParentInformed(pass.parent_informed || false);
        }
    }, [pass]);

    if (!pass) return null;

    return (
        <Dialog open={!!pass} onOpenChange={(open) => !open && setProtocolPass(null)}>
            <DialogContent className="max-w-md rounded p-0 overflow-hidden border-0 shadow-2xl animate-in fade-in zoom-in duration-300">
                <div className="bg-primary/10 p-6 border-b border-primary/20">
                    <DialogTitle className="text-xl font-black text-primary">Gatepass Review</DialogTitle>
                    <DialogDescription className="text-xs font-semibold text-primary/60 uppercase tracking-tighter">Pending Approval Request</DialogDescription>
                </div>
                
                <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto stylish-scrollbar focus:outline-none">
                    {/* Student Identity Section */}
                    <div className="bg-muted/30 p-5 rounded-sm border border-border space-y-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.1em] mb-1">Student Information</p>
                                <h3 className="font-black text-lg text-slate-900 leading-tight">{pass.student_name}</h3>
                                <p className="text-xs font-bold text-primary">{pass.student_hall_ticket}</p>
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="rounded-sm font-black text-[10px] h-8 border-primary/20 hover:bg-primary/5 text-primary"
                                onClick={() => setSelectedStudentForCard(pass)}
                            >
                                <UserIcon className="h-3 w-3 mr-1.5" /> DIGITAL CARD
                            </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed">
                            <div>
                                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Hostel / Room</p>
                                <p className="text-xs font-bold text-slate-700">{pass.hostel_name} • {pass.student_room}</p>
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Contact</p>
                                <p className="text-xs font-bold text-slate-700">{pass.student_phone}</p>
                            </div>
                        </div>
                    </div>

                    {pass.audio_brief && (
                        <div className="p-4 bg-primary/5 rounded-sm border border-primary/10">
                            <AudioPlayer url={pass.audio_brief} />
                        </div>
                    )}

                    {/* Movement Details */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 bg-orange-50/50 rounded-sm border border-orange-100">
                            <p className="text-[8px] font-black text-orange-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                <Clock className="h-3 w-3" /> Outbound
                            </p>
                            <p className="text-xs font-black text-orange-950">{pass.exit_date}</p>
                            <p className="text-[10px] font-bold text-orange-800/60">{pass.exit_time}</p>
                        </div>
                        <div className="p-4 bg-emerald-50/50 rounded-sm border border-emerald-100">
                            <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                <CalendarIcon className="h-3 w-3" /> Inbound
                            </p>
                            <p className="text-xs font-black text-emerald-950">{pass.expected_return_date}</p>
                            <p className="text-[10px] font-bold text-emerald-800/60">{pass.expected_return_time}</p>
                        </div>
                    </div>

                    {/* Remarks Section */}
                    <div className="space-y-4 pt-2">
                        <div className="flex flex-col gap-3 p-4 bg-blue-50/50 rounded-sm border border-blue-100">
                            <div 
                                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity mb-2"
                                onClick={() => setParentInformed(!parentInformed)}
                            >
                                <div className={cn(
                                    "h-5 w-5 rounded-sm border-2 flex items-center justify-center transition-all",
                                    parentInformed ? "bg-primary border-primary" : "bg-white border-blue-200"
                                )}>
                                    {parentInformed && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                                </div>
                                <span className="text-xs font-black text-blue-900 uppercase tracking-tight">Parent / Guardian Informed</span>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-2">
                                {pass.student_phone && (
                                    <a href={`tel:${pass.student_phone}`} className="flex items-center justify-between p-3 bg-white border border-blue-200 hover:border-primary hover:bg-blue-50 rounded-sm transition-all shadow-sm group">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-wider">Student Mobile</span>
                                            <span className="text-sm font-bold text-slate-800 group-hover:text-primary">{pass.student_name || 'Student'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-blue-800 font-black">
                                            <span>{pass.student_phone}</span>
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                                                <Phone className="h-4 w-4" />
                                            </div>
                                        </div>
                                    </a>
                                )}
                                {pass.father_phone && (
                                    <a href={`tel:${pass.father_phone}`} className="flex items-center justify-between p-3 bg-white border border-blue-200 hover:border-primary hover:bg-blue-50 rounded-sm transition-all shadow-sm group">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-wider">Father Number</span>
                                            <span className="text-sm font-bold text-slate-800 group-hover:text-primary">{pass.father_name || 'Father'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-blue-800 font-black">
                                            <span>{pass.father_phone}</span>
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                                                <Phone className="h-4 w-4" />
                                            </div>
                                        </div>
                                    </a>
                                )}
                                {pass.guardian_phone && (
                                    <a href={`tel:${pass.guardian_phone}`} className="flex items-center justify-between p-3 bg-white border border-blue-200 hover:border-primary hover:bg-blue-50 rounded-sm transition-all shadow-sm group">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-wider">Guardian Number</span>
                                            <span className="text-sm font-bold text-slate-800 group-hover:text-primary">{pass.guardian_name || 'Guardian'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-blue-800 font-black">
                                            <span>{pass.guardian_phone}</span>
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                                                <Phone className="h-4 w-4" />
                                            </div>
                                        </div>
                                    </a>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Warden Remarks (Mandatory)</Label>
                            <Textarea 
                                placeholder="Enter reason for approval or rejection..."
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                className="rounded-sm border-2 border-slate-100 bg-slate-50 min-h-[100px] focus:ring-primary p-4 font-bold text-sm"
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <Button 
                            disabled={!remarks.trim() || approveMutation.isPending || rejectMutation.isPending}
                            className="h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-sm shadow-xl shadow-emerald-500/20 text-sm flex flex-col gap-0.5"
                            onClick={() => approveMutation.mutate({ id: pass.id, remarks, parent_informed: parentInformed })}
                        >
                            {approveMutation.isPending ? 'Processing...' : 'APPROVE'}
                        </Button>
                        <Button 
                            variant="outline"
                            disabled={!remarks.trim() || approveMutation.isPending || rejectMutation.isPending}
                            className="h-14 border-2 border-rose-100 hover:bg-rose-50 text-rose-600 font-black rounded-sm text-sm transition-all"
                            onClick={() => rejectMutation.mutate({ id: pass.id, remarks })}
                        >
                            {rejectMutation.isPending ? 'Processing...' : 'REJECT'}
                        </Button>
                    </div>

                    <Button variant="ghost" className="w-full h-10 rounded-sm font-bold text-slate-400 text-xs" onClick={() => setProtocolPass(null)}>Close Review Panel</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
  };

  // Removed ParentInformedConfirmModal as it is now integrated into ProtocolModal

  const isCurrentlyOut = gatePasses.some(
    (gp) => (gp.movement_status === 'outside' || gp.status === 'outside' || gp.status === 'used') && gp.student_id === user?.id
  );

  return (
    <div className="page-frame pb-14 sm:pb-16">
      <SEO title="Gate Passes" description="Manage student gate pass requests and history." />

      <div className="page-hero-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="page-eyebrow">Campus access</p>
            <h1 className="page-title">Gate Passes</h1>
            <p className="page-meta">Movement management & history</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
          {isSecurity && (
            <Button onClick={() => setIsScannerOpen(true)} size="sm" className="h-9 bg-primary/90 text-white rounded-md font-bold px-3 text-xs">
              <QrCode className="h-3.5 w-3.5 mr-1" /> Scan
            </Button>
          )}
          {canCreate && (
            <Button size="sm" onClick={() => {
              if (isCurrentlyOut) {
                const message = 'You are currently outside the hostel. Create a new pass after your return is scanned.';
                setInlineError(message);
                toast.error(message);
                return;
              }
              setInlineError(null);
              setCreateDialogOpen(true);
            }} className="h-9 bg-primary text-white rounded-md font-bold px-3 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> New Pass
            </Button>
          )}
          {isAuthority && (
            <Button variant="outline" size="sm" onClick={() => downloadFile('/gate-passes/export_csv/', 'gate_passes.csv')} className="h-9 rounded-md font-bold px-3 text-xs">
              Export
            </Button>
          )}
          </div>
        </div>
      </div>

      {showOnboarding && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card p-3 shadow-sm">
          <p className="text-xs font-medium text-blue-800">
            Start with <span className="font-bold">Overview</span> then switch to <span className="font-bold">Pass History</span> for actions.
          </p>
          <button onClick={dismissOnboarding} className="shrink-0 text-blue-400 hover:text-blue-600" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {inlineError && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 shadow-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 text-red-500 shrink-0" />
            <p className="text-xs font-medium text-red-700">{inlineError}</p>
          </div>
          <button onClick={() => setInlineError(null)} className="shrink-0 text-red-400 hover:text-red-600" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <Tabs value={activeView} onValueChange={(value) => setActiveView(value as 'overview' | 'history')}>
        <TabsList className="grid w-full grid-cols-2 h-auto rounded-none border-0 border-b border-border bg-transparent p-0">
          <TabsTrigger
            value="overview"
            className="rounded-none border-b-2 border-transparent px-2 py-3 text-sm font-semibold text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none hover:bg-transparent"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-none border-b-2 border-transparent px-2 py-3 text-sm font-semibold text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none hover:bg-transparent"
          >
            Pass History
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeView === 'history' && (
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Search hall ticket..." value={searchTicket} onChange={(e) => { setSearchTicket(e.target.value); setPage(1); }} className="pl-9 h-10 rounded-lg bg-card border border-border text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-28 h-10 rounded-lg bg-card border border-border text-xs font-medium">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-lg">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="out">OUT</SelectItem>
            <SelectItem value="in">Returned</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>
      )}

      {activeView === 'overview' && (
      <div className="stack-compact">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Gate Pass Track</h2>
          {latestTrackedPass && (
            <span className="text-[10px] font-mono text-muted-foreground">#{latestTrackedPass.id}</span>
          )}
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          <div className="rounded-lg bg-blue-50 p-2.5 text-center">
            <p className="text-[8px] font-bold uppercase text-blue-600">Req</p>
            <p className="text-lg font-black text-blue-700">{trackingStats.requested}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-2.5 text-center">
            <p className="text-[8px] font-bold uppercase text-emerald-600">OK</p>
            <p className="text-lg font-black text-emerald-700">{trackingStats.approved}</p>
          </div>
          <div className="rounded-lg bg-rose-50 p-2.5 text-center">
            <p className="text-[8px] font-bold uppercase text-rose-600">Out</p>
            <p className="text-lg font-black text-rose-700">{trackingStats.outside}</p>
          </div>
          <div className="rounded-lg bg-sky-50 p-2.5 text-center">
            <p className="text-[8px] font-bold uppercase text-sky-600">In</p>
            <p className="text-lg font-black text-sky-700">{trackingStats.returned}</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-2.5 text-center">
            <p className="text-[8px] font-bold uppercase text-amber-600">Rej</p>
            <p className="text-lg font-black text-amber-700">{trackingStats.rejected}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto py-2 -mx-1 px-1">
          {trackSteps.map((step, index) => {
            const stepNo = index + 1;
            const isDone = latestTrackingPhase >= stepNo;
            const isRejected = latestTrackingPhase === -1;
            return (
              <div key={step} className="flex items-center gap-1.5 shrink-0">
                <div className={cn(
                  "h-7 px-2.5 rounded-full text-[9px] font-bold flex items-center justify-center whitespace-nowrap",
                  isRejected
                    ? "bg-rose-100 text-rose-700"
                    : isDone
                      ? "bg-primary/15 text-primary"
                      : "bg-slate-100 text-slate-400"
                )}>
                  {step}
                </div>
                {index < trackSteps.length - 1 && (
                  <div className={cn("h-[2px] w-3", isDone && !isRejected ? "bg-primary/40" : "bg-slate-200")} />
                )}
              </div>
            );
          })}
        </div>

        {latestTrackedPass ? (
          <p className="text-[11px] text-muted-foreground">
            Updated {formatDistanceToNow(new Date(latestTrackedPass.updated_at), { addSuffix: true })}.
            {latestTrackingPhase === -1 ? ' Rejected.' : ''}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">No passes yet.</p>
        )}

        <Button variant="outline" size="sm" onClick={() => setActiveView('history')} className="w-full h-9 rounded-lg font-bold text-xs">
          Open Pass History
        </Button>
      </div>
      )}

      {activeView === 'history' && (
      <div className="space-y-4">
         {isLoading && page === 1 ? (
            <ListSkeleton rows={8} />
         ) : gatePasses.length > 0 ? (
            <>
              {/* Desktop Table */}
                <div className="hidden lg:block rounded-lg border border-border bg-card shadow-sm overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="font-black text-[10px] uppercase">Student</TableHead>
                            <TableHead className="font-black text-[10px] uppercase">Destination</TableHead>
                            <TableHead className="font-black text-[10px] uppercase">Exit/Return</TableHead>
                            <TableHead className="font-black text-[10px] uppercase">Status</TableHead>
                            <TableHead className="font-black text-[10px] uppercase">Movement</TableHead>
                            <TableHead className="font-black text-[10px] uppercase text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {gatePasses.map(pass => (
                            <TableRow key={pass.id} className="cursor-pointer hover:bg-primary/5" onClick={() => {
                                if (isAuthority && pass.status === 'pending') setProtocolPass(pass);
                                else if (isSecurity && (pass.status === 'approved' || pass.status === 'outside' || pass.status === 'used' || pass.movement_status === 'outside')) setSelectedQR(pass);
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
                                <TableCell>{getStatusBadge(pass.status, pass)}</TableCell>
                                <TableCell>{getMovementBadge(pass.movement_status)}</TableCell>
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

              {/* Mobile Cards - DOM VIRTUALIZED FOR ULTRA-LIGHT PERFORMANCE */}
              <div ref={parentRef} className="lg:hidden h-[calc(100dvh-220px)] overflow-auto relative rounded-lg border border-border bg-muted/35 p-1.5" style={{ scrollBehavior: 'smooth' }}>
                 <div
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                 >
                 {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const pass = gatePasses[virtualRow.index];
                    const studentName = pass.student_name ?? pass.student?.name ?? 'Student';
                    return (
                        <div
                            key={virtualRow.key}
                            data-index={virtualRow.index}
                            ref={rowVirtualizer.measureElement}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                paddingBottom: '16px', // space-y-4 equivalent
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                        >
                            <Card className="rounded-xl border border-border bg-card shadow-sm active:scale-[0.99] transition-transform cursor-pointer overflow-hidden" onClick={() => {
                                if (isAuthority && pass.status === 'pending') setProtocolPass(pass);
                                else if (isSecurity && (pass.status === 'approved' || pass.status === 'outside' || pass.status === 'used' || pass.movement_status === 'outside')) setSelectedQR(pass);
                                else setSelectedPass(pass);
                            }}>
                                <div className={cn("h-1 w-full", pass.status === 'approved' ? 'bg-emerald-500' : pass.status === 'pending' ? 'bg-orange-500' : 'bg-slate-300')} />
                                <CardHeader className="p-4 flex flex-row items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-primary/10 rounded-sm flex items-center justify-center font-black text-primary hover:bg-primary/20 transition-colors"
                                             onClick={(e) => {
                                                 if (isAuthority || isSecurity) {
                                                     e.stopPropagation();
                                                     setSelectedStudentForCard(pass);
                                                 }
                                             }}>
                                          {studentName.charAt(0)}
                                        </div>
                                        <div onClick={(e) => {
                                                 if (isAuthority || isSecurity) {
                                                     e.stopPropagation();
                                                     setSelectedStudentForCard(pass);
                                                 }
                                             }}>
                                          <p className={cn("font-black text-sm", (isAuthority || isSecurity) && "hover:text-primary")}>{studentName}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground tracking-widest">{pass.student_hall_ticket}</p>
                                        </div>
                                    </div>
                                    {getStatusBadge(pass.status, pass)}
                                    {getMovementBadge(pass.movement_status)}
                                </CardHeader>
                                <CardContent className="px-3 pb-3 pt-0 flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span className="font-medium">Out: {pass.exit_date} {pass.exit_time}</span>
                                    <span className="font-medium">In: {pass.expected_return_date} {pass.expected_return_time}</span>
                                </CardContent>
                            </Card>
                        </div>
                    );
                 })}
                 </div>
              </div>

              {hasNextPage && (
                <div className="flex justify-center pt-4">
                    <Button variant="outline" size="sm" className="rounded-lg font-bold text-xs h-9 px-6" onClick={() => setPage(page + 1)} disabled={isFetching}>
                        {isFetching ? 'LOADING...' : <>LOAD MORE HISTORY <ChevronDown className="h-4 w-4" /></>}
                    </Button>
                </div>
              )}
            </>
         ) : (
            <div className="py-16 text-center">
                <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-sm text-slate-500">No records found</p>
                <p className="text-xs text-slate-400 mt-1">Adjust filters or create a new pass.</p>
                {canCreate && (
                  <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="mt-3 h-9 rounded-lg font-bold text-xs">
                    <Plus className="h-3.5 w-3.5 mr-1" /> New Pass
                  </Button>
                )}
            </div>
         )}
      </div>
            )}

      {/* PASS DETAIL MODAL (REUSED FROM DASHBOARD) */}
      <Dialog open={!!selectedPass} onOpenChange={(open) => !open && setSelectedPass(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 rounded shadow-2xl">
          <div className={cn(
            "p-6 text-white relative",
            selectedPass?.status === 'approved' ? 'bg-emerald-600' :
            (selectedPass?.status === 'used' || selectedPass?.status === 'outside' || selectedPass?.movement_status === 'outside') ? 'bg-blue-600' :
            selectedPass?.status === 'pending' ? 'bg-orange-500' : 'bg-slate-800'
          )}>
            <div className="flex flex-col gap-4">
               <div className="h-16 w-16 bg-white/20 backdrop-blur-md rounded-sm flex items-center justify-center border border-white/20">
                  <QrCode className="h-10 w-10" />
               </div>
               <div>
                  <Badge variant="outline" className="text-white border-white/40 font-black text-[10px] uppercase mb-1">
                    #{selectedPass?.id} • Institutional Gate Pass
                  </Badge>
                  <DialogTitle className="text-2xl font-black text-white tracking-tight">
                      {(selectedPass?.status === 'used' || selectedPass?.status === 'outside' || selectedPass?.movement_status === 'outside') ? 'Currently OUT' : 
                     selectedPass?.status === 'approved' ? 'Ready for Exit' : 
                      selectedPass?.status === 'returned' ? 'Returned' :
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

            <div className="stack-compact">
               <div className="p-4 bg-muted/30 rounded-sm border border-dashed border-border space-y-3">
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
                  <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-sm border border-emerald-100">
                    <div>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Approved At</p>
                      <p className="text-xs font-black text-emerald-900">{selectedPass?.approved_at ? format(new Date(selectedPass.approved_at), 'PPP · p') : '—'}</p>
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
                  <div className="p-4 bg-blue-50 rounded-sm border border-blue-100">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Official Remarks</p>
                    <p className="text-xs font-medium text-blue-900 italic">{selectedPass.approval_remarks}</p>
                  </div>
               )}

              {(selectedPass?.movement_status === 'outside' || selectedPass?.status === 'outside' || selectedPass?.status === 'used') && selectedPass?.actual_exit_at && (
                  <div className="p-4 bg-slate-900 text-white rounded-sm shadow-xl shadow-slate-200">
                    <div className="flex justify-between items-center mb-2">
                       <p className="text-[10px] font-black uppercase tracking-widest text-primary">Live Tracking</p>
                       <Badge className="bg-primary/20 text-primary border-primary/20 text-[9px] font-black animate-pulse">MONITORED</Badge>
                    </div>
                    <div className="stack-compact">
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
                <Button className="w-full h-10 rounded-sm font-black bg-primary text-primary-foreground mb-2 text-xs" onClick={() => { setSelectedPass(null); setSelectedQR(selectedPass); }}>
                    SHOW QR CARD
                </Button>
            )}

            <Button className="w-full h-10 rounded-sm font-black bg-slate-100 text-slate-900 border-0 text-xs" onClick={() => setSelectedPass(null)}>
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
          <DialogTitle className="sr-only">QR Identification Card</DialogTitle>
          <DialogDescription className="sr-only">Digital gate pass verification card with embedded QR code for security scanning.</DialogDescription>
          <div className="perspective-1000 w-full h-full flex justify-center items-center">
            <div 
                className={cn(
                    "relative w-full aspect-[3/4.6] transition-all duration-700 ease-in-out preserve-3d cursor-pointer",
                    isFlipped ? "rotate-y-180" : ""
                )}
                onClick={() => setIsFlipped(!isFlipped)}
            >
              {/* FRONT SIDE */}
              <Card className="absolute inset-0 w-full h-full rounded-sm overflow-hidden border-2 border-emerald-500/50 shadow-2xl bg-white text-black backface-hidden">
                <div className="h-2 w-full bg-emerald-300"></div>
                <CardContent className="flex flex-col items-center p-6 relative gap-7 h-full">
                  <div className="w-full flex justify-between items-center">
                    <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em]">Security Pass</p>
                    <p className="font-mono font-black text-sm text-slate-900">GP#{selectedQR?.id}</p>
                  </div>
                  <div className="flex flex-col items-center w-full">
                    <div className="w-44 h-44 rounded bg-emerald-50 p-1 border-4 border-emerald-500/10 overflow-hidden relative shadow-lg">
                      <img 
                        src={selectedQR?.student_profile_picture || `https://ui-avatars.com/api/?name=${selectedQR?.student_name}&background=ecfdf5&color=047857&bold=true&size=128`} 
                        alt={selectedQR?.student_name}
                        className="w-full h-full object-cover rounded-sm"
                      />
                      <div className="absolute -bottom-1 -right-1 p-1 bg-white rounded-sm shadow-xl w-14 h-14 border border-emerald-100">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${selectedQR?.qr_code}`} className="w-full h-full" />
                      </div>
                    </div>
                    <div className="text-center mt-6">
                      <h2 className="text-2xl font-black text-slate-900">{selectedQR?.student_name}</h2>
                      <p className="text-[10px] font-mono font-bold text-slate-400 uppercase mt-0.5">{selectedQR?.student_hall_ticket}</p>
                    </div>
                  </div>
                  <div className="w-full grid grid-cols-2 gap-3.5 mt-auto mb-4">
                    <div className="bg-slate-50 p-3 rounded-sm border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Out</p>
                      <p className="text-xs font-black">{selectedQR?.exit_date}</p>
                      <p className="text-[10px] font-bold text-slate-500">{selectedQR?.exit_time}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-sm border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">In</p>
                      <p className="text-xs font-black">{selectedQR?.expected_return_date}</p>
                      <p className="text-[10px] font-bold text-slate-500">{selectedQR?.expected_return_time}</p>
                    </div>
                  </div>
                  <p className="text-[9px] font-black text-primary/40 uppercase animate-pulse">Tap to Flip 🔄</p>
                </CardContent>
              </Card>

              {/* BACK SIDE */}
              <Card className="absolute inset-0 w-full h-full rounded-sm overflow-hidden border-2 border-slate-900/50 shadow-2xl bg-[#090909] text-white rotate-y-180 backface-hidden">
                <div className="h-2 w-full bg-primary/80"></div>
                <CardContent className="p-7 flex flex-col h-full">
                  <h3 className="text-xl font-black tracking-tighter text-white">SMG CAMPUSCORE</h3>
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
                    <div className="p-4 rounded-sm bg-white/5 border border-white/10">
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
                <Button className="w-full rounded-sm bg-sky-500 text-white h-11 font-black shadow-md text-sm" onClick={() => { verifyMutation.mutate({ id: selectedQR.id, action: 'check_out', location: selectedGate }); setSelectedQR(null); }}>
                   📤 REGISTER EXIT
                </Button>
             )}
             {isSecurity && (selectedQR?.movement_status === 'outside' || selectedQR?.status === 'outside' || selectedQR?.status === 'used') && (
                <Button className="w-full rounded-sm bg-emerald-500 text-white h-11 font-black shadow-md text-sm" onClick={() => { verifyMutation.mutate({ id: selectedQR.id, action: 'check_in', location: selectedGate }); setSelectedQR(null); }}>
                   📥 COMPLETE RETURN
                </Button>
             )}
             <Button className="px-8 rounded-sm bg-black text-white h-10 font-black text-xs" onClick={() => setSelectedQR(null)}>DISMISS</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProtocolModal pass={protocolPass} />
      
      {/* CREATE DIALOG */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden border-0 rounded sm:rounded shadow-2xl">
          <DialogTitle className="sr-only">Create New Gate Pass</DialogTitle>
          <DialogDescription className="sr-only">Form to request a new gate pass with destination, timing, and purpose details.</DialogDescription>
          <div className="bg-primary p-6 sm:p-8 text-white relative">
            <div className="flex flex-col gap-2">
              <Badge variant="outline" className="w-fit text-white border-white/40 font-black text-[10px] uppercase tracking-widest px-2 py-0.5 mb-1 bg-white/10">Institutional Protocol</Badge>
              <DialogTitle className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-white/20 backdrop-blur-md rounded-sm flex items-center justify-center border border-white/20">
                  <CheckCircle2 className="h-6 w-6 sm:h-7 sm:w-7" />
                </div>
                Request Gate Pass
              </DialogTitle>
              <DialogDescription className="text-white/60 text-xs font-medium">Please provide accurate destination and timing details for verification.</DialogDescription>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-5 sm:space-y-6 bg-white overflow-y-auto max-h-[75vh] stylish-scrollbar">
            {inlineError && (
              <div className="rounded-sm border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {inlineError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {/* Type & Destination */}
              <div className="space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Pass Type</Label>
                  <Select 
                    value={formData.pass_type} 
                    onValueChange={(v: 'day' | 'overnight' | 'weekend' | 'emergency') => setFormData({ ...formData, pass_type: v })}
                  >
                    <SelectTrigger className="rounded-sm border-0 bg-gray-50 h-11 sm:h-12 font-bold focus:ring-primary shadow-sm">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-sm border-gray-100 shadow-2xl">
                      <SelectItem value="day" className="font-bold rounded-sm my-1">🌞 Day Visit</SelectItem>
                      <SelectItem value="overnight" className="font-bold rounded-sm my-1">🌙 Overnight</SelectItem>
                      <SelectItem value="weekend" className="font-bold rounded-sm my-1">🏠 Weekend Home</SelectItem>
                      <SelectItem value="emergency" className="font-bold rounded-sm my-1">🚨 Emergency</SelectItem>
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
                    className="rounded-sm border-0 bg-gray-50 h-11 sm:h-12 font-bold focus-visible:ring-primary shadow-sm"
                  />
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="purpose" className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Purpose/Reason</Label>
                  <Input
                    id="purpose"
                    placeholder="Brief reason for outing"
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    className="rounded-sm border-0 bg-gray-50 h-11 sm:h-12 font-bold focus-visible:ring-primary shadow-sm"
                  />
                </div>
              </div>

              {/* Timing */}
              <div className="space-y-4">
                <div className="bg-primary/5 rounded-sm p-4 border border-primary/10 space-y-3 shadow-sm">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1 flex items-center gap-2">
                    <Clock className="h-3 w-3" /> Exit Schedule
                  </p>
                  <DatePicker
                    date={formData.exit_date ? new Date(formData.exit_date) : undefined}
                    onSelect={(date) => setFormData({ ...formData, exit_date: date ? formatDateForAPI(date) : '' })}
                    className="w-full rounded-sm border-0 bg-white shadow-sm h-11 font-medium"
                  />
                  <TimePicker
                    value={formData.exit_time}
                    onChange={(e) => setFormData({ ...formData, exit_time: e.target.value })}
                    className="w-full rounded-sm border-0 bg-white shadow-sm h-11 font-medium px-4"
                  />
                </div>

                <div className="bg-emerald-50 rounded-sm p-4 border border-emerald-100 space-y-3 shadow-sm">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3" /> Return Schedule
                  </p>
                  <DatePicker
                    date={formData.expected_return_date ? new Date(formData.expected_return_date) : undefined}
                    onSelect={(date) => setFormData({ ...formData, expected_return_date: date ? formatDateForAPI(date) : '' })}
                    className="w-full rounded-sm border-0 bg-white shadow-sm h-11 font-medium"
                  />
                  <TimePicker
                    value={formData.expected_return_time}
                    onChange={(e) => setFormData({ ...formData, expected_return_time: e.target.value })}
                    className="w-full rounded-sm border-0 bg-white shadow-sm h-11 font-medium px-4"
                  />
                </div>
              </div>
            </div>

            <div className="bg-primary/5 p-5 rounded-sm border border-primary/10 space-y-3">
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
                className="rounded-sm border-0 bg-gray-50 min-h-[80px] focus:ring-primary p-4 font-medium"
              />
            </div>

            <div className="pt-4 border-t border-gray-100 flex flex-col gap-3">
              <Button type="submit" disabled={createMutation.isPending} className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-black text-base uppercase rounded-sm shadow-xl shadow-primary/10">
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
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 rounded shadow-2xl bg-transparent">
          <DialogTitle className="sr-only">Student Smart Identity Portal</DialogTitle>
          <DialogDescription className="sr-only">Comprehensive view of student academic and residential identification credentials.</DialogDescription>
          {selectedStudentForCard?.student_details ? (
             <DigitalCard 
                user={selectedStudentForCard.student_details} 
                gatePass={selectedStudentForCard}
             />
          ) : (
            <div className="p-10 bg-white rounded text-center space-y-4">
              <div className="h-20 w-20 bg-muted rounded-sm mx-auto animate-pulse flex items-center justify-center">
                 <UserIcon className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <p className="font-black text-muted-foreground">Loading Student Profile...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Mutation Progress indicators happen inside the dialog/button levels */}
      {/* SCANNER DIALOG */}
      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 rounded shadow-2xl">
            <div className="bg-black p-6 border-b border-white/10">
                <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
                    <QrCode className="h-5 w-5 text-primary" /> SECURITY SCANNER
                </DialogTitle>
                <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Institutional Gate Control System</DialogDescription>
            </div>
            <div className="p-6 bg-slate-900">
                <QRScanner onScan={(data) => scanMutation.mutate(data)} />
            </div>
            <div className="p-6 bg-black border-t border-white/5 flex gap-2">
                <Button variant="ghost" className="flex-1 rounded-sm font-black text-slate-400 text-[10px]" onClick={() => setIsScannerOpen(false)}>CANCEL</Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
