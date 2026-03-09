import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, DollarSign, ShieldAlert, Search, Loader2, BadgeCheck } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrandedLoading } from '@/components/common/BrandedLoading';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { toast } from 'sonner';
import { getApiErrorMessage, cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { isWarden, isAdmin } from '@/lib/rbac';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface SearchStudent {
  id: number;
  name: string;
  username: string;
  room_number?: string;
  hostel_name?: string;
}

interface DisciplinaryAction {
  id: number;
  student: number;
  student_details?: {
    name: string;
    hall_ticket: string;
    username: string;
  };
  student_name: string; // Fallback
  action_type: string;
  severity: 'low' | 'medium' | 'high' | 'severe';
  title: string;
  description: string;
  fine_amount: string;
  is_paid: boolean;
  paid_at?: string;
  created_at: string;
}

export default function FinesPage() {
  const [activeTab, setActiveTab] = useState('pending');
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const canIssue = isWarden(user?.role) || isAdmin(user?.role);
  
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  
  type IssueFormData = {
    student_id: string;
    title: string;
    description: string;
    action_type: string;
    severity: 'low' | 'medium' | 'high' | 'severe';
    fine_amount: string;
  };

  const [formData, setFormData] = useState<IssueFormData>({
    student_id: '',
    title: '',
    description: '',
    action_type: 'fine',
    severity: 'medium',
    fine_amount: '0',
  });
  
  // Listen for real-time updates
  useRealtimeQuery('disciplinary_updated', ['disciplinary']);
  
  const { data: actions, isLoading } = useQuery<DisciplinaryAction[]>({
    queryKey: ['disciplinary'],
    queryFn: async () => {
      const response = await api.get('/disciplinary/');
      return response.data.results || response.data;
    }
  });

  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debouce for optimized search performance (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(studentSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [studentSearch]);

  const { data: students, isFetching: isSearching } = useQuery<SearchStudent[]>({
      queryKey: ['students-list', debouncedSearch],
      queryFn: async () => {
          if (!debouncedSearch.trim()) return [];
          const response = await api.get('/users/students/', {
              params: { q: debouncedSearch }
          });
          return response.data;
      },
      enabled: issueDialogOpen && canIssue && debouncedSearch.trim().length > 0,
  });

  const filteredStudents = students || [];

  const issueMutation = useMutation({
      mutationFn: async (data: IssueFormData) => {
          await api.post('/disciplinary/', data);
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['disciplinary'] });
          toast.success('Disciplinary action issued');
          setIssueDialogOpen(false);
          setFormData({
            student_id: '',
            title: '',
            description: '',
            action_type: 'fine',
            severity: 'medium',
            fine_amount: '0',
          });
      },
      onError: (err) => {
          toast.error(getApiErrorMessage(err, 'Failed to issue action'));
      }
  });

  const clearMutation = useMutation({
      mutationFn: async (id: number) => {
          await api.patch(`/disciplinary/${id}/`, { is_paid: true, paid_at: new Date().toISOString() });
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['disciplinary'] });
          toast.success('Dues cleared successfully');
          if ('vibrate' in navigator) navigator.vibrate(50);
      }
  });

  const pendingActions = actions?.filter(a => !a.is_paid && parseFloat(a.fine_amount) > 0) || [];
  const historyActions = actions?.filter(a => a.is_paid || parseFloat(a.fine_amount) === 0) || [];
  
  const totalDue = pendingActions.reduce((sum, a) => sum + parseFloat(a.fine_amount), 0);

  const ActionCard = ({ action }: { action: DisciplinaryAction }) => (
    <Card className="rounded-3xl border-0 shadow-sm hover:shadow-md transition-all group overflow-hidden bg-white">
      <div className={`h-1.5 w-full ${action.severity === 'severe' ? 'bg-black' : action.severity === 'high' ? 'bg-red-500' : 'bg-primary'}`} />
      <CardHeader className="pb-3 space-y-2 relative">
        <div className="flex justify-between items-start">
          <Badge className="rounded-lg bg-gray-100 text-gray-600 font-bold uppercase text-[10px] tracking-wider border-0">{action.action_type}</Badge>
          {!action.is_paid && parseFloat(action.fine_amount) > 0 ? (
             <Badge variant="destructive" className="font-black text-[10px] uppercase h-6 rounded-full px-3">Unpaid</Badge>
          ) : (
             <Badge variant="secondary" className="bg-success/10 text-success border-0 font-black text-[10px] uppercase h-6 rounded-full px-3">Resolved</Badge>
          )}
        </div>
        <CardTitle className="text-xl font-black leading-tight text-foreground truncate" title={action.title}>{action.title}</CardTitle>
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">
            <DollarSign className="h-3 w-3" />
            {format(new Date(action.created_at), 'PPP')}
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="bg-gray-50/80 p-4 rounded-2xl border border-dashed border-gray-200">
            <p className="text-sm font-medium text-foreground/80 line-clamp-3 min-h-[3rem]" title={action.description}>
                {action.description}
            </p>
        </div>
        {parseFloat(action.fine_amount) > 0 && (
            <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Penalty Amount</span>
                <span className="text-2xl font-black text-foreground">₹{action.fine_amount}</span>
            </div>
        )}
      </CardContent>
      <CardFooter className="pt-4 border-t border-gray-100 bg-gray-50/30 flex justify-between items-center">
        <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Account</span>
            <span className="text-xs font-bold text-foreground">{action.student_details?.name || action.student_name}</span>
        </div>
        {!action.is_paid && parseFloat(action.fine_amount) > 0 ? (
            canIssue ? (
                <Button 
                    size="sm" 
                    className="h-8 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase px-4 shadow-md shadow-emerald-100"
                    onClick={() => clearMutation.mutate(action.id)}
                    disabled={clearMutation.isPending}
                >
                    {clearMutation.isPending ? 'Clearing...' : 'Mark as Paid'}
                </Button>
            ) : (
                <Button size="sm" className="h-8 rounded-full bg-black text-white text-[10px] font-black uppercase px-4 shadow-md shadow-black/10">Pay at Office</Button>
            )
        ) : null}
      </CardFooter>
    </Card>
  );



  const EmptyStateItem = ({ type }: { type: 'pending' | 'history' }) => (
    <div className="text-center py-20 bg-white rounded-[2rem] border-0 shadow-sm">
        <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-4xl mb-6">
            {type === 'pending' ? '✨' : '📜'}
        </div>
        <h3 className="text-2xl font-black mb-2 tracking-tight">
            {type === 'pending' ? 'Clean Record!' : 'No History Found'}
        </h3>
        <p className="text-muted-foreground font-medium max-w-sm mx-auto px-6">
            {type === 'pending' 
            ? "You don't have any outstanding fines or disciplinary actions at this time." 
            : "No past disciplinary records found for your account."}
        </p>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black flex items-center gap-3 text-foreground tracking-tight">
            <div className="p-2.5 bg-black rounded-2xl text-primary shadow-xl shadow-black/20">
                <ShieldAlert className="h-8 w-8" />
            </div>
            Fines & Penalties
          </h1>
          <p className="text-muted-foreground font-medium pl-1">Monitor disciplinary actions and clear outstanding dues.</p>
        </div>
        <div className="flex items-center gap-3">
            {canIssue && (
                <Button onClick={() => setIssueDialogOpen(true)} className="primary-gradient text-white font-black rounded-2xl px-6 h-14 shadow-lg shadow-primary/20 hover:shadow-xl active:scale-95 transition-all outline-none border-0">
                    <Plus className="h-5 w-5 mr-2" />
                    Issue Fine
                </Button>
            )}
            
            {totalDue > 0 && (
                <Card className="bg-white border-0 shadow-2xl rounded-3xl animate-in fade-in duration-500 overflow-hidden ring-1 ring-black/5">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="p-3 bg-red-500 rounded-2xl text-white shadow-lg shadow-red-200">
                            <DollarSign className="h-6 w-6 font-black" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Due Amount</p>
                            <p className="text-3xl font-black text-foreground">₹{totalDue}</p>
                        </div>
                    </CardContent>
               </Card>
            )}
        </div>
      </div>

      <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-1 scrollbar-hide">
            <TabsList className="flex w-max sm:w-full bg-gray-100/50 p-1 rounded-2xl border border-gray-100">
                <TabsTrigger value="pending" className="rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Pending Dues ({pendingActions.length})</TabsTrigger>
                <TabsTrigger value="history" className="rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Record History ({historyActions.length})</TabsTrigger>
            </TabsList>
        </div>
        
        <TabsContent value="pending" className="mt-8">
            {isLoading ? (
                <BrandedLoading message="Auditing financial records..." />
            ) : pendingActions.length === 0 ? (
                <EmptyStateItem type="pending" />
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {pendingActions.map(action => (
                        <ActionCard key={action.id} action={action} />
                    ))}
                </div>
            )}
        </TabsContent>

        <TabsContent value="history" className="mt-8">
            {isLoading ? (
                <BrandedLoading message="Retrieving disciplinary history..." />
            ) : historyActions.length === 0 ? (
                <EmptyStateItem type="history" />
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {historyActions.map(action => (
                        <ActionCard key={action.id} action={action} />
                    ))}
                </div>
            )}
        </TabsContent>
        </Tabs>

      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl bg-white">
            <div className="bg-black p-8 text-white relative">
                <DialogHeader>
                    <DialogTitle className="text-3xl font-black tracking-tight">Issue Discipline</DialogTitle>
                    <DialogDescription className="text-gray-400 font-medium">Record a rule violation and issue a penalty.</DialogDescription>
                </DialogHeader>
            </div>

            <form onSubmit={(e) => {
                e.preventDefault();
                issueMutation.mutate(formData);
            }} className="p-8 space-y-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Search Student</Label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input 
                                placeholder="Name or Hall Ticket..." 
                                className="rounded-2xl border-0 bg-gray-50 h-12 pl-11 font-bold"
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                            />
                        </div>
                        {studentSearch && (
                            <div className="bg-white rounded-2xl shadow-xl mt-2 p-3 space-y-2 animate-in fade-in duration-300 ring-1 ring-black/5 max-h-[300px] overflow-y-auto">
                                {isSearching ? (
                                    <div className="text-center p-4 text-xs font-bold text-muted-foreground uppercase flex items-center justify-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                                    </div>
                                ) : filteredStudents.length > 0 ? (
                                    filteredStudents.map(s => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            className={cn(
                                                "w-full text-left p-3 rounded-xl transition-all flex items-center justify-between group border border-transparent",
                                                formData.student_id === String(s.id) ? "bg-black text-white" : "hover:bg-gray-50 border-gray-100"
                                            )}
                                            onClick={() => {
                                                setFormData({...formData, student_id: String(s.id)});
                                                setStudentSearch(`${s.name} (${s.username})`);
                                            }}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={cn("h-10 w-10 mt-1 rounded-full flex items-center justify-center font-black shrink-0", formData.student_id === String(s.id) ? "bg-white text-black" : "bg-primary/20 text-primary")}>
                                                    {s.name?.[0]?.toUpperCase() || 'U'}
                                                </div>
                                                <div>
                                                    <p className="font-black leading-none mb-1.5">{s.name}</p>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border-0", formData.student_id === String(s.id) ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600")}>{s.username}</Badge>
                                                        {s.hostel_name && (
                                                            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border-0", formData.student_id === String(s.id) ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600")}>{s.hostel_name}</Badge>
                                                        )}
                                                        {s.room_number && (
                                                            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border-0", formData.student_id === String(s.id) ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600")}>Room {s.room_number}</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {formData.student_id === String(s.id) && <BadgeCheck className="h-5 w-5 text-white shrink-0" />}
                                        </button>
                                    ))
                                ) : debouncedSearch.trim().length > 0 ? (
                                    <div className="text-center p-4 text-xs font-bold text-red-500 uppercase flex items-center justify-center gap-2">
                                        <ShieldAlert className="h-4 w-4" /> No student found.
                                    </div>
                                ) : (
                                    <div className="text-center p-4 text-xs font-bold text-gray-400 uppercase">
                                        Enter name or roll number to search
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Severity</Label>
                            <Select value={formData.severity} onValueChange={(v: IssueFormData['severity']) => setFormData({...formData, severity: v})}>
                                <SelectTrigger className="rounded-2xl border-0 bg-gray-50 h-12 font-bold">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl">
                                    <SelectItem value="low" className="font-bold">Low</SelectItem>
                                    <SelectItem value="medium" className="font-bold">Medium</SelectItem>
                                    <SelectItem value="high" className="font-bold text-red-500">High</SelectItem>
                                    <SelectItem value="severe" className="font-black text-red-600">Severe</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Fine Amount (₹)</Label>
                            <Input 
                                type="number"
                                className="rounded-2xl border-0 bg-gray-50 h-12 font-black text-lg"
                                value={formData.fine_amount}
                                onChange={(e) => setFormData({...formData, fine_amount: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Title</Label>
                        <Input 
                            placeholder="Brief reason (e.g. Late Arrival)" 
                            className="rounded-2xl border-0 bg-gray-50 h-12 font-bold"
                            value={formData.title}
                            onChange={(e) => setFormData({...formData, title: e.target.value})}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Detailed Description</Label>
                        <Textarea 
                            placeholder="Details of the violation..." 
                            className="rounded-2xl border-0 bg-gray-50 min-h-[100px] font-medium p-4"
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            required
                        />
                    </div>
                </div>

                <DialogFooter className="flex-col gap-3">
                    <Button 
                        type="submit" 
                        className="w-full primary-gradient h-14 rounded-2xl font-black uppercase tracking-wider shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-white border-0"
                        disabled={issueMutation.isPending || !formData.student_id}
                    >
                        {issueMutation.isPending ? <Loader2 className="animate-spin h-5 w-5" /> : 'Confirm & Issue Penalty'}
                    </Button>
                    <Button 
                        type="button" 
                        variant="ghost" 
                        className="w-full text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-gray-50 mt-2"
                        onClick={() => setIssueDialogOpen(false)}
                    >
                        Cancel Release
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
