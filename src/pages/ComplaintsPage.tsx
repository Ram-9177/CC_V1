
import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, CheckCircle2, Clock, Hammer, AlertOctagon, 
  AlertTriangle, Search, History, User, 
    MessageSquare, ChevronRight, X, Info, MapPin, Phone, DoorOpen, Paperclip,
  BarChart3, ListTodo, ShieldAlert
} from 'lucide-react';
import { ComplaintAnalytics } from '@/components/features/complaints/ComplaintAnalytics';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Field, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { SEO } from '@/components/common/SEO';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { cn } from '@/lib/utils';
import { 
  useComplaintsList, 
  useCreateComplaint, 
  useUpdateComplaintStatus, 
  useEscalateComplaint, 
  useComplaintFeedback 
} from '@/hooks/features/useComplaints';
import type { Complaint, ComplaintStatus } from '@/types';

const CATEGORIES = {
  hosteller: [
    { value: 'room', label: 'Room Issue' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'plumbing', label: 'Plumbing' },
    { value: 'mess', label: 'Mess/Food' },
    { value: 'cleaning', label: 'Cleanliness' },
    { value: 'other', label: 'Other' }
  ],
  day_scholar: [
    { value: 'academic', label: 'Academic' },
    { value: 'faculty', label: 'Faculty' },
    { value: 'admin', label: 'Admin' },
    { value: 'other', label: 'Other' }
  ]
};

const VISIT_SLOT_OPTIONS = [
    { value: 'anytime', label: 'Anytime' },
    { value: 'morning', label: 'Morning (6 AM - 12 PM)' },
    { value: 'afternoon', label: 'Afternoon (12 PM - 5 PM)' },
    { value: 'evening', label: 'Evening (5 PM - 10 PM)' },
];

const getVisitSlotLabel = (slot?: string) =>
    VISIT_SLOT_OPTIONS.find((opt) => opt.value === slot)?.label || 'Anytime';

export default function ComplaintsPage() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  
  // Filters
  const statusFilter = searchParams.get('status') || 'active';
  const categoryFilter = searchParams.get('category') || '';
  const searchQuery = searchParams.get('search') || '';
  const activeTab = searchParams.get('tab') || 'queue'; // queue or analytics

  const { data: complaints, isLoading } = useComplaintsList({
    category: categoryFilter,
    search: searchQuery
  });

  const createMutation = useCreateComplaint();
  const statusMutation = useUpdateComplaintStatus();
  const escalateMutation = useEscalateComplaint();
  const feedbackMutation = useComplaintFeedback();

  // Local state for new complaint
  const [newComplaint, setNewComplaint] = useState({
    student_id: '',
    title: '',
    description: '',
    category: '',
    priority: '3',
        subcategory: '',
        location_details: '',
        contact_number: '',
        preferred_visit_slot: 'anytime',
        allow_room_entry: false,
        imageFile: null as File | null,
  });

  // Filter complaints locally for tabs
  const filteredComplaints = useMemo(() => {
    if (!complaints) return [];
    if (statusFilter === 'active') {
      return complaints.filter(c => ['open', 'assigned', 'in_progress', 'reopened'].includes(c.status));
    }
    return complaints.filter(c => ['resolved', 'closed'].includes(c.status));
  }, [complaints, statusFilter]);

  const canManageComplaints =
    ['admin', 'super_admin', 'warden', 'head_warden', 'chef', 'head_chef', 'hod', 'faculty', 'hr'].includes(user?.role || '') ||
    !!user?.is_student_hr;
  const canViewAnalytics = ['admin', 'super_admin', 'warden', 'head_warden'].includes(user?.role || '');
    const canRaiseComplaint = user?.role === 'student' && user?.student_type === 'hosteller';
    const showHostellerOnlyHint = user?.role === 'student' && user?.student_type === 'day_scholar';

  const handleRaiseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
        if (!canRaiseComplaint) {
            toast.error('Only hosteller students can raise complaints in this phase.');
            return;
        }

        if (!newComplaint.title.trim() || !newComplaint.description.trim() || !newComplaint.category || !newComplaint.location_details.trim()) {
            toast.error('Please fill all required fields before submitting.');
            return;
        }

    const formData = new FormData();
        formData.append('title', newComplaint.title.trim());
        formData.append('description', newComplaint.description.trim());
    formData.append('category', newComplaint.category);
    formData.append('priority', newComplaint.priority);
        formData.append('subcategory', newComplaint.subcategory.trim());
        formData.append('location_details', newComplaint.location_details.trim());
        formData.append('contact_number', newComplaint.contact_number.trim());
        formData.append('preferred_visit_slot', newComplaint.preferred_visit_slot);
        formData.append('allow_room_entry', String(newComplaint.allow_room_entry));
        if (newComplaint.imageFile) {
            formData.append('image', newComplaint.imageFile);
        }
    
    createMutation.mutate(formData, {
      onSuccess: () => {
        setIsRaiseModalOpen(false);
                setNewComplaint({
                    student_id: '',
                    title: '',
                    description: '',
                    category: '',
                    priority: '3',
                    subcategory: '',
                    location_details: '',
                    contact_number: '',
                    preferred_visit_slot: 'anytime',
                    allow_room_entry: false,
                    imageFile: null,
                });
        toast.success('Institutional Complaint Registered');
      }
    });
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case '1': return <Badge className="bg-red-600 text-white animate-pulse"><AlertOctagon className="w-3 h-3 mr-1"/> Urgent</Badge>;
      case '2': return <Badge className="bg-orange-500 text-white">High</Badge>;
      case '3': return <Badge className="bg-blue-500 text-white">Medium</Badge>;
      case '4': return <Badge variant="outline">Low</Badge>;
      default: return null;
    }
  };

  const getStatusInfo = (status: ComplaintStatus) => {
    switch (status) {
      case 'open': return { label: 'Open', color: 'bg-slate-100 text-slate-700', icon: Clock };
      case 'assigned': return { label: 'Assigned', color: 'bg-indigo-100 text-indigo-700', icon: User };
      case 'in_progress': return { label: 'In Progress', color: 'bg-amber-100 text-amber-700', icon: Hammer };
      case 'resolved': return { label: 'Resolved', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 };
      case 'closed': return { label: 'Closed', color: 'bg-neutral-800 text-white', icon: CheckCircle2 };
      case 'reopened': return { label: 'Reopened', color: 'bg-rose-100 text-rose-700', icon: AlertTriangle };
      case 'invalid': return { label: 'Invalid/Fake', color: 'bg-slate-200 text-slate-500', icon: ShieldAlert };
      default: return { label: status, color: 'bg-gray-100', icon: Info };
    }
  };

  if (isLoading) return <PageSkeleton variant="cards" />;

  return (
    <div className="container mx-auto px-3 py-4 max-w-6xl space-y-3 sm:space-y-4 pb-6">
      <SEO title="Institutional Helpdesk" description="Track and resolve campus issues with SLA enforcement." />

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-foreground flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <Hammer className="h-8 w-8" />
            </div>
            Helpdesk & SLA
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Operational control & campus accountability system.</p>
        </div>

                {canRaiseComplaint && (
                <Dialog open={isRaiseModalOpen} onOpenChange={setIsRaiseModalOpen}>
            <DialogTrigger asChild>
                <Button size="lg" className="rounded-xl shadow-sm h-14 px-8 font-bold text-lg hover:scale-105 transition-transform">
                    <Plus className="mr-2 h-6 w-6" /> Raise Complaint
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg rounded-xl p-0 overflow-hidden border-none shadow-xl">
                <div className="bg-primary p-8 text-primary-foreground">
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <MessageSquare className="h-6 w-6" /> New Service Request
                    </h2>
                    <p className="opacity-80 font-medium">Your request will be auto-assigned to the relevant department.</p>
                </div>
                <form onSubmit={handleRaiseSubmit} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Issue Title *</Label>
                            <Input 
                                placeholder="Brief summary of the issue" 
                                className="h-12 text-base font-bold bg-muted/50 border-none rounded-xl mt-1 focus-visible:ring-primary"
                                value={newComplaint.title}
                                onChange={(e) => setNewComplaint({...newComplaint, title: e.target.value})}
                                required
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Category *</Label>
                                <Select value={newComplaint.category} onValueChange={(v) => setNewComplaint({...newComplaint, category: v})}>
                                    <SelectTrigger className="h-12 bg-muted/50 border-none rounded-xl mt-1">
                                        <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.hosteller.map(cat => (
                                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Priority</Label>
                                <Select value={newComplaint.priority} onValueChange={(v) => setNewComplaint({...newComplaint, priority: v})}>
                                    <SelectTrigger className="h-12 bg-muted/50 border-none rounded-xl mt-1">
                                        <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">Urgent (SLA)</SelectItem>
                                        <SelectItem value="2">High</SelectItem>
                                        <SelectItem value="3">Medium</SelectItem>
                                        <SelectItem value="4">Low</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Subcategory</Label>
                                <Input
                                    placeholder="Eg: Fan, Tube light, Wash basin"
                                    className="h-12 bg-muted/50 border-none rounded-xl mt-1 focus-visible:ring-primary"
                                    value={newComplaint.subcategory}
                                    onChange={(e) => setNewComplaint({...newComplaint, subcategory: e.target.value})}
                                />
                            </div>
                            <div>
                                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Preferred Visit Slot</Label>
                                <Select value={newComplaint.preferred_visit_slot} onValueChange={(v) => setNewComplaint({...newComplaint, preferred_visit_slot: v})}>
                                    <SelectTrigger className="h-12 bg-muted/50 border-none rounded-xl mt-1">
                                        <SelectValue placeholder="Anytime" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {VISIT_SLOT_OPTIONS.map((slot) => (
                                            <SelectItem key={slot.value} value={slot.value}>{slot.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Issue Location *</Label>
                                <Input
                                    placeholder="Eg: Room B-203, 2nd Floor corridor"
                                    className="h-12 bg-muted/50 border-none rounded-xl mt-1 focus-visible:ring-primary"
                                    value={newComplaint.location_details}
                                    onChange={(e) => setNewComplaint({...newComplaint, location_details: e.target.value})}
                                    required
                                />
                            </div>
                            <div>
                                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Contact Number</Label>
                                <Input
                                    placeholder="Number for service coordination"
                                    className="h-12 bg-muted/50 border-none rounded-xl mt-1 focus-visible:ring-primary"
                                    value={newComplaint.contact_number}
                                    onChange={(e) => setNewComplaint({...newComplaint, contact_number: e.target.value})}
                                />
                            </div>
                        </div>

                        <div>
                            <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Detailed Description *</Label>
                            <Textarea 
                                placeholder="Describe the issue in detail..." 
                                className="min-h-[100px] bg-muted/50 border-none rounded-xl mt-1 focus-visible:ring-primary font-medium"
                                value={newComplaint.description}
                                onChange={(e) => setNewComplaint({...newComplaint, description: e.target.value})}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-xl bg-muted/50 p-4 flex items-start gap-3">
                                <input
                                    id="allow-room-entry"
                                    name="allow-room-entry"
                                    type="checkbox"
                                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                                    checked={newComplaint.allow_room_entry}
                                    onChange={(e) => setNewComplaint({...newComplaint, allow_room_entry: e.target.checked})}
                                />
                                <div>
                                    <Label htmlFor="allow-room-entry" className="text-xs font-black tracking-wide text-slate-700 cursor-pointer flex items-center gap-1.5">
                                        <DoorOpen className="h-3.5 w-3.5" />
                                        Allow Room Entry If You Are Away
                                    </Label>
                                    <p className="text-[11px] text-muted-foreground font-medium mt-1">Maintenance team can proceed based on your complaint notes.</p>
                                </div>
                            </div>
                            <Field>
                                <FieldLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">
                                    Attachment (Optional)
                                </FieldLabel>
                                <Input
                                    type="file"
                                    accept="image/*"
                                    className="h-12 bg-muted/50 border-none rounded-xl file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:font-semibold file:text-primary"
                                    onChange={(e) => setNewComplaint({ ...newComplaint, imageFile: e.target.files?.[0] ?? null })}
                                />
                                {newComplaint.imageFile && (
                                    <p className="text-[11px] font-semibold text-slate-500 mt-1 truncate flex items-center gap-1"><Paperclip className="h-3 w-3" /> {newComplaint.imageFile.name}</p>
                                )}
                            </Field>
                        </div>
                    </div>
                    <Button type="submit" className="w-full h-14 text-lg font-black uppercase tracking-widest rounded-xl" disabled={createMutation.isPending}>
                        {createMutation.isPending ? 'Logging Issue...' : 'Register Complaint'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
                )}

                {showHostellerOnlyHint && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                        Complaints can currently be raised by hosteller students only.
                    </div>
                )}
      </div>

      {/* Main Action Tabs (Staff Only) */}
      {canViewAnalytics && (
          <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ ...Object.fromEntries(searchParams), tab: v })} className="w-full">
              <TabsList className="w-fit">
                  <TabsTrigger value="queue" className="rounded-2xl h-full px-8 text-sm font-black uppercase tracking-widest flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-lg">
                      <ListTodo className="h-4 w-4" /> Service Queue
                  </TabsTrigger>
                  <TabsTrigger value="analytics" className="rounded-2xl h-full px-8 text-sm font-black uppercase tracking-widest flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-lg">
                      <BarChart3 className="h-4 w-4" /> Operational Analytics
                  </TabsTrigger>
              </TabsList>
          </Tabs>
      )}

      {activeTab === 'analytics' && canViewAnalytics ? (
          <ComplaintAnalytics />
      ) : (
          <>
            {/* Stats Quick View (Summary for Admins/Wardens) */}
            {canManageComplaints && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in slide-in-from-top duration-500">
                    {[
                        { label: 'Pending Assignment', count: complaints?.filter(c => c.status === 'open').length || 0, color: 'text-slate-400' },
                        { label: 'Work In Progress', count: complaints?.filter(c => c.status === 'in_progress').length || 0, color: 'text-amber-500' },
                        { label: 'SLA Breached', count: complaints?.filter(c => c.is_overdue).length || 0, color: 'text-red-600' },
                        { label: 'Closed / Resolved', count: complaints?.filter(c => ['resolved', 'closed'].includes(c.status)).length || 0, color: 'text-emerald-500' },
                    ].map((stat, i) => (
                        <Card key={i} className="rounded-xl border border-border bg-card shadow-sm p-5 transition-shadow">
                            <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">{stat.label}</p>
                            <h3 className={cn("text-4xl font-black mt-2 tracking-tighter", stat.color)}>{stat.count}</h3>
                        </Card>
                    ))}
                </div>
            )}

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-in fade-in duration-700">
                
                {/* Sidebar Filters */}
                <div className="lg:col-span-3 space-y-3 sm:space-y-4">
                    <Card className="rounded-xl border border-border bg-card shadow-sm overflow-hidden p-5 space-y-5 sticky top-8">
                        <div className="space-y-4">
                            <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Search & Filter</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                  placeholder="Ticket ID or Title..." 
                                  className="pl-10 h-12 bg-slate-50 border-none rounded-xl"
                                  value={searchQuery}
                                  onChange={(e) => setSearchParams({ ...Object.fromEntries(searchParams), search: e.target.value })}
                                />
                            </div>
                            
                            <div className="space-y-3 pt-2">
                                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Lifecycle Status</Label>
                                <Tabs value={statusFilter} onValueChange={(v) => setSearchParams({ ...Object.fromEntries(searchParams), status: v })} className="w-full">
                                    <TabsList className="grid grid-cols-2 w-full">
                                        <TabsTrigger value="active" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-wider">Active</TabsTrigger>
                                        <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-wider">Archive</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>

                        <div className="space-y-3 pt-2">
                            <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Department</Label>
                            <Select value={categoryFilter} onValueChange={(v) => setSearchParams({ ...Object.fromEntries(searchParams), category: v })}>
                                <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                                    <SelectValue placeholder="All Departments" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Departments</SelectItem>
                                    {(user?.student_type === 'day_scholar' ? CATEGORIES.day_scholar : CATEGORIES.hosteller).map(cat => (
                                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

            <div className="bg-card border border-border rounded-xl p-5 text-foreground space-y-3 shadow-sm">
                        <div className="flex items-center gap-2 text-primary">
                            <ShieldAlert className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">SLA Policy</span>
                        </div>
                        <p className="text-xs font-semibold leading-relaxed text-muted-foreground">
                            Institutional SLA:
                            <br/>• Common: 24h
                            <br/>• Mess: 12h
                            <br/>• Academic: 48h
                        </p>
                    </div>
                </Card>
            </div>

          {/* Complaints Feed */}
          <div className="lg:col-span-9 space-y-3 sm:space-y-4">
              {filteredComplaints.length === 0 ? (
                  <div className="bg-card rounded-xl p-12 text-center space-y-5 border border-dashed border-border shadow-sm">
                      <div className="p-6 bg-slate-50 w-24 h-24 rounded-full mx-auto flex items-center justify-center">
                          <CheckCircle2 className="h-12 w-12 text-slate-300" />
                      </div>
                      <div className="space-y-2">
                          <h3 className="text-2xl font-black tracking-tight">Queue Empty</h3>
                          <p className="text-muted-foreground font-medium max-w-sm mx-auto">No operational issues found in this category. System operations normal.</p>
                      </div>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 gap-4">
                      {filteredComplaints.map((complaint) => (
                          <Card 
                            key={complaint.id} 
                            className={cn(
                                "rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-all group cursor-pointer",
                                complaint.is_overdue && "ring-2 ring-red-100"
                            )}
                            onClick={() => setSelectedComplaint(complaint)}
                          >
                              <div className="flex flex-col md:flex-row">
                                  {/* Left Priority Strip */}
                                  <div className={cn(
                                      "w-1 md:w-2",
                                      complaint.priority === '1' ? "bg-red-600" : 
                                      complaint.priority === '2' ? "bg-orange-500" : 
                                      "bg-blue-500"
                                  )} />
                                  <div className="flex-1 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                      <div className="space-y-3 flex-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                              {getPriorityBadge(complaint.priority)}
                                              <Badge className={cn("rounded-md border-none uppercase text-[10px] font-black tracking-wider px-2 py-1", getStatusInfo(complaint.status).color)}>
                                                  {getStatusInfo(complaint.status).label}
                                              </Badge>
                                              <Badge variant="outline" className="rounded-md uppercase text-[10px] font-black tracking-wider px-2 py-1 border-slate-200 text-slate-500">
                                                  #{complaint.id} • {complaint.category}
                                              </Badge>
                                          </div>
                                          
                                          <h3 className="text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                              {complaint.title}
                                          </h3>

                                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                                              {complaint.subcategory && (
                                                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500 rounded-md">
                                                      {complaint.subcategory}
                                                  </Badge>
                                              )}
                                              {complaint.location_details && (
                                                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
                                                      <MapPin className="h-3 w-3" /> {complaint.location_details}
                                                  </span>
                                              )}
                                              {complaint.preferred_visit_slot && (
                                                  <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-indigo-600">
                                                      <Clock className="h-3 w-3" /> {getVisitSlotLabel(complaint.preferred_visit_slot)}
                                                  </span>
                                              )}
                                          </div>
                                          
                                          <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                                              <span className="flex items-center gap-1">
                                                  <User className="h-3 w-3" /> {complaint.student_details?.name}
                                              </span>
                                              <span className="flex items-center gap-1">
                                                  <Clock className="h-3 w-3" /> {formatDistanceToNow(new Date(complaint.created_at))} ago
                                              </span>
                                          </div>
                                      </div>

                                      <div className="flex items-center gap-3 w-full md:w-auto">
                                          {complaint.is_overdue && (
                                              <div className="flex flex-col items-end">
                                                  <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">SLA Breached</span>
                                                  <span className="text-red-500 font-bold text-xs">Exceeded Resolution Target</span>
                                              </div>
                                          )}
                                          <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto md:ml-4 group-hover:translate-x-1 transition-transform" />
                                      </div>
                                  </div>
                              </div>
                          </Card>
                      ))}
                  </div>
              )}
          </div>
      </div>

      {/* Complaint Detail Drawer/Modal */}
      <Dialog open={!!selectedComplaint} onOpenChange={(o) => !o && setSelectedComplaint(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden p-0 border-none shadow-xl rounded-xl flex flex-col">
              {selectedComplaint && (
                  <>
                      {/* Drawer Dynamic Header */}
                      <div className={cn(
                          "p-10 text-white relative",
                          (selectedComplaint.status === 'resolved' || selectedComplaint.status === 'closed') ? 'bg-emerald-600' :
                          selectedComplaint.status === 'invalid' ? 'bg-slate-400' :
                          selectedComplaint.is_overdue ? 'bg-red-600' : 'bg-slate-900'
                      )}>
                          <button 
                            onClick={() => setSelectedComplaint(null)}
                            className="absolute top-6 right-6 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                          >
                              <X className="h-5 w-5" />
                          </button>
                          
                          <div className="space-y-4 pr-10">
                              <div className="flex flex-wrap items-center gap-2">
                                  {getPriorityBadge(selectedComplaint.priority)}
                                  <Badge className="bg-white/20 text-white border-none text-[10px] font-black py-1">
                                      {selectedComplaint.category.toUpperCase()}
                                  </Badge>
                                  {selectedComplaint.is_overdue && (
                                      <Badge className="bg-white text-red-600 border-none text-[10px] font-black animate-pulse py-1">
                                          SLA BREACHED
                                      </Badge>
                                  )}
                              </div>
                              <h2 className="text-3xl font-black tracking-tighter leading-none">{selectedComplaint.title}</h2>
                              <div className="flex items-center gap-4 text-sm font-bold opacity-90">
                                  <span className="flex items-center gap-1.5"><User className="h-4 w-4" /> {selectedComplaint.student_details?.name}</span>
                                  <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {format(new Date(selectedComplaint.created_at), 'MMM d, h:mm a')}</span>
                              </div>
                          </div>
                      </div>

                      {/* Drawer Tabs (Details / Timeline) */}
                      <div className="flex-1 overflow-auto bg-slate-50 p-8 space-y-8">
                          <section className="space-y-3">
                              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Issue Description</Label>
                              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 font-medium text-slate-700 leading-relaxed">
                                  {selectedComplaint.description}
                              </div>
                          </section>

                          <section className="space-y-3">
                              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Service Details</Label>
                              <div className="rounded-xl border border-slate-200 bg-white shadow-none p-6 space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                      <div className="space-y-1">
                                          <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Location</p>
                                          <p className="font-semibold text-slate-700 flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /> {selectedComplaint.location_details || 'Not provided'}</p>
                                      </div>
                                      <div className="space-y-1">
                                          <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Preferred Visit</p>
                                          <p className="font-semibold text-slate-700">{getVisitSlotLabel(selectedComplaint.preferred_visit_slot)}</p>
                                      </div>
                                      <div className="space-y-1">
                                          <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Contact Number</p>
                                          <p className="font-semibold text-slate-700 flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /> {selectedComplaint.contact_number || 'Not provided'}</p>
                                      </div>
                                      <div className="space-y-1">
                                          <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Room Entry Consent</p>
                                          <p className="font-semibold text-slate-700 flex items-center gap-2"><DoorOpen className="h-4 w-4 text-slate-400" /> {selectedComplaint.allow_room_entry ? 'Allowed' : 'Not allowed'}</p>
                                      </div>
                                  </div>

                                  {selectedComplaint.image && (
                                      <div className="space-y-2">
                                          <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Attachment</p>
                                          <a href={selectedComplaint.image} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                                              <Paperclip className="h-4 w-4" /> View Uploaded Image
                                          </a>
                                      </div>
                                  )}
                              </div>
                          </section>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="rounded-xl border border-slate-200 bg-white shadow-none p-6 space-y-4">
                                  <div className="flex items-center justify-between">
                                      <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Assigned Personnel</Label>
                                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><User className="h-4 w-4" /></div>
                                  </div>
                                  <div>
                                      <p className="text-lg font-black text-slate-800">{selectedComplaint.assigned_to_name || 'Departmental Queue'}</p>
                                      <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-tight">Responsibility Owner</p>
                                  </div>
                              </div>

                              <div className={cn(
                                  "rounded-xl border border-slate-200 bg-white shadow-none p-6 space-y-4",
                                  selectedComplaint.is_overdue && "bg-red-50"
                              )}>
                                  <div className="flex items-center justify-between">
                                      <Label className={cn("text-[10px] uppercase font-black tracking-widest", selectedComplaint.is_overdue ? "text-red-500" : "text-muted-foreground")}>Resolution Target</Label>
                                      <div className={cn("p-2 rounded-lg", selectedComplaint.is_overdue ? "bg-red-100 text-red-600" : "bg-slate-50 text-slate-500")}><Clock className="h-4 w-4" /></div>
                                  </div>
                                  <div>
                                      <p className={cn("text-lg font-black", selectedComplaint.is_overdue ? "text-red-600" : "text-slate-800")}>
                                          {selectedComplaint.expected_resolution_time ? format(new Date(selectedComplaint.expected_resolution_time), 'MMM d, h:mm a') : '24 Hours'}
                                      </p>
                                      <p className={cn("text-xs font-bold mt-1 uppercase tracking-tight", selectedComplaint.is_overdue ? "text-red-400" : "text-slate-400")}>SLA Commitment</p>
                                  </div>
                              </div>
                          </div>

                          {/* Timeline / History */}
                          <section className="space-y-4">
                              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                  <History className="h-3 w-3" /> Resolution Timeline
                              </h3>
                              <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-0 before:w-0.5 before:bg-slate-200">
                                  {selectedComplaint.updates?.map((update, i) => (
                                      <div key={i} className="flex gap-4 relative">
                                          <div className={cn(
                                              "mt-1.5 w-6 h-6 rounded-full border-4 border-slate-50 relative z-10 flex items-center justify-center",
                                              (update.status_to === 'resolved' || update.status_to === 'closed') ? 'bg-emerald-500' : 'bg-slate-300'
                                          )}>
                                              {(update.status_to === 'resolved' || update.status_to === 'closed') ? <CheckCircle2 className="h-2 w-2 text-white" /> : <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                          </div>
                                          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex-1 space-y-1">
                                              <div className="flex justify-between items-start">
                                                  <span className="text-xs font-black text-slate-800">{update.user_name}</span>
                                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{formatDistanceToNow(new Date(update.created_at))} ago</span>
                                              </div>
                                              <p className="text-sm font-bold text-slate-500">
                                                  Changed status to <Badge variant="outline" className="scale-75 origin-left">{update.status_to}</Badge>
                                              </p>
                                              {update.comment && (
                                                  <p className="text-sm font-medium text-slate-600 mt-2 italic px-3 py-2 bg-slate-50 rounded-lg">"{update.comment}"</p>
                                              )}
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </section>
                      </div>

                      {/* Drawer Actions */}
                      <div className="p-8 bg-white border-t border-slate-100 flex flex-wrap gap-4">
                          {canManageComplaints && !['resolved', 'closed', 'invalid'].includes(selectedComplaint.status) && (
                              <>
                                  <Button 
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest px-8 rounded-xl h-14 flex-1"
                                    onClick={() => statusMutation.mutate({ id: selectedComplaint.id, status: 'resolved', comment: 'Issue has been addressed and fixed.' })}
                                    disabled={statusMutation.isPending}
                                  >
                                      Mark Resolved
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    className="border-2 border-slate-200 font-black uppercase tracking-widest px-8 rounded-xl h-14"
                                    onClick={() => escalateMutation.mutate(selectedComplaint.id)}
                                                                        disabled={escalateMutation.isPending || selectedComplaint.escalation_level >= 3}
                                  >
                                                                            {selectedComplaint.escalation_level >= 3 ? 'Max Escalated' : 'Escalate'}
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    className="border-2 border-red-200 text-red-500 font-black uppercase tracking-widest px-8 rounded-xl h-14"
                                    onClick={() => statusMutation.mutate({ id: selectedComplaint.id, status: 'invalid', comment: 'Ticket marked as invalid/fake request.' })}
                                    disabled={statusMutation.isPending}
                                  >
                                      Invalid
                                  </Button>
                              </>
                          )}

                          {selectedComplaint.status === 'resolved' && selectedComplaint.student === user?.id && (
                              <>
                                  <Button 
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest px-8 rounded-xl h-14 flex-1"
                                    onClick={() => feedbackMutation.mutate({ id: selectedComplaint.id, action: 'close', comment: 'Satisfied with resolution.' })}
                                  >
                                      Accept & Close
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    className="border-2 border-red-500 text-red-500 font-black uppercase tracking-widest px-8 rounded-xl h-14 flex-1"
                                    onClick={() => feedbackMutation.mutate({ id: selectedComplaint.id, action: 'reopen', comment: 'Still facing issues.' })}
                                  >
                                      Reject & Reopen
                                  </Button>
                              </>
                          )}

                          {selectedComplaint.status === 'closed' && selectedComplaint.student === user?.id && (
                              <Button 
                                variant="outline" 
                                className="border-2 border-red-500 text-red-500 font-black uppercase tracking-widest px-8 rounded-xl h-14 flex-1"
                                onClick={() => feedbackMutation.mutate({ id: selectedComplaint.id, action: 'reopen', comment: 'Issue persists after auto-close.' })}
                              >
                                  Reopen Issue
                              </Button>
                          )}
                      </div>
                  </>
              )}
          </DialogContent>
      </Dialog>
      
      {/* End of Analytics wrapper */}
          </>
      )}
    </div>
  );
}
