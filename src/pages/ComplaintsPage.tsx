
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle2, Clock, Hammer, AlertOctagon, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface Complaint {
  id: number;
  title: string;
  description: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  resolved_at?: string;
  student_name?: string;
  assigned_to_name?: string;
  is_overdue?: boolean;
  student_details?: {
    name: string;
    hall_ticket: string;
    room_number?: string;
  };
}

const CATEGORIES = [
  'electrical',
  'plumbing',
  'carpentry',
  'civil',
  'internet',
  'cleaning',
  'mess',
  'other'
];

export default function ComplaintsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [newComplaint, setNewComplaint] = useState({
    title: '',
    description: '',
    category: '',
    severity: 'medium'
  });

  const { data: complaints, isLoading } = useQuery<Complaint[]>({
    queryKey: ['complaints'],
    queryFn: async () => {
      const response = await api.get('/complaints/');
      return response.data.results;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newComplaint) => {
      const response = await api.post('/complaints/', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      setIsOpen(false);
      setNewComplaint({ title: '', description: '', category: '', severity: 'medium' });
      toast.success('Complaint submitted successfully');
    },
    onError: () => {
      toast.error('Failed to submit complaint');
    }
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const response = await api.patch(`/complaints/${id}/`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      toast.success('Complaint status updated');
    },
    onError: () => {
      toast.error('Failed to update status');
    }
  });

  const activeComplaints = complaints?.filter(c => ['open', 'in_progress'].includes(c.status)) || [];
  const resolvedComplaints = complaints?.filter(c => ['resolved', 'closed'].includes(c.status)) || [];
  
  const currentList = activeTab === 'active' ? activeComplaints : resolvedComplaints;

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return <Badge variant="destructive" className="bg-black text-white border-0 animate-pulse font-bold"><AlertOctagon className="w-3 h-3 mr-1"/> Critical</Badge>;
      case 'high': return <Badge className="bg-primary hover:bg-primary/90 text-foreground border-0 font-bold"><AlertTriangle className="w-3 h-3 mr-1"/> High</Badge>;
      case 'medium': return <Badge variant="secondary" className="bg-primary/20 text-black border-primary/30 font-bold"><AlertTriangle className="w-3 h-3 mr-1"/> Medium</Badge>;
      case 'low': return <Badge variant="outline" className="text-muted-foreground">Low</Badge>;
      default: return <Badge variant="outline" className="text-foreground">{severity}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge variant="outline" className="border-primary/30 text-black bg-primary/10 font-bold">Open</Badge>;
      case 'in_progress': return <Badge variant="secondary" className="bg-primary/20 text-black hover:bg-primary/30 font-bold"><Hammer className="w-3 h-3 mr-1"/> In Progress</Badge>;
      case 'resolved': return <Badge variant="default" className="bg-primary hover:bg-primary/90 text-foreground font-bold"><CheckCircle2 className="w-3 h-3 mr-1"/> Resolved</Badge>;
      case 'closed': return <Badge variant="secondary" className="text-black font-bold">Closed</Badge>;
      default: return <Badge variant="outline" className="text-foreground">{status}</Badge>;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComplaint.title || !newComplaint.category || !newComplaint.description) {
      toast.error('Please fill all required fields');
      return;
    }
    createMutation.mutate(newComplaint);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-2 text-foreground tracking-tight">
            <div className="p-2 bg-red-100 rounded-2xl text-red-600">
                <Hammer className="h-6 w-6" />
            </div>
            Complaints & Maintenance
          </h1>
          <p className="text-muted-foreground font-medium pl-1">Report and track maintenance issues</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="rounded-full shadow-lg shadow-primary/30 bg-primary hover:bg-primary/90 text-white font-bold hover:shadow-lg hover:shadow-primary/40 transition-all active:scale-95 px-6">
              <Plus className="w-5 h-5 mr-2" />
              New Complaint
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-3xl text-black">
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-6 py-4 border-b">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                  <Hammer className="h-6 w-6 text-primary" />
                  Report an Issue
                </DialogTitle>
                <DialogDescription className="font-medium">
                  Submit a new maintenance request or complaint for quick resolution.
                </DialogDescription>
              </DialogHeader>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Issue Title</Label>
                <Input 
                  id="title" 
                  placeholder="e.g. Fan not working in Room 101" 
                  value={newComplaint.title}
                  onChange={(e) => setNewComplaint({...newComplaint, title: e.target.value})}
                  className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary px-4 font-medium"
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Category</Label>
                  <Select 
                    value={newComplaint.category} 
                    onValueChange={(val) => setNewComplaint({...newComplaint, category: val})}
                  >
                    <SelectTrigger id="category-select" className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary px-4 font-medium">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-gray-100 shadow-2xl">
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat} className="capitalize font-medium">{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="severity" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Urgency</Label>
                  <Select 
                    value={newComplaint.severity} 
                    onValueChange={(val) => setNewComplaint({...newComplaint, severity: val as 'low' | 'medium' | 'high' | 'critical'})}
                  >
                    <SelectTrigger id="urgency-select" className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary px-4 font-medium">
                      <SelectValue placeholder="Select urgency" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-gray-100 shadow-2xl">
                      <SelectItem value="low" className="font-medium">Low - Can wait</SelectItem>
                      <SelectItem value="medium" className="font-medium">Medium - Standard</SelectItem>
                      <SelectItem value="high" className="font-medium">High - Urgent</SelectItem>
                      <SelectItem value="critical" className="font-medium text-red-600">Critical - Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Description</Label>
                <Textarea 
                  id="description" 
                  placeholder="Please describe the issue in detail..." 
                  className="min-h-[120px] rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary p-4 font-medium"
                  value={newComplaint.description}
                  onChange={(e) => setNewComplaint({...newComplaint, description: e.target.value})}
                  required
                />
              </div>

              <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur-md pt-4 pb-0 flex flex-col gap-3">
                <Button type="submit" className="w-full h-14 primary-gradient text-white font-black text-lg uppercase tracking-wider rounded-2xl shadow-xl shadow-orange-200 hover:scale-[1.02] active:scale-95 transition-all" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Submitting...' : 'Submit Complaint'}
                </Button>
                <Button type="button" variant="ghost" className="font-bold text-muted-foreground" onClick={() => setIsOpen(false)}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="active" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full sm:w-[400px] grid-cols-2 mb-6">
          <TabsTrigger value="active">Active Issues ({activeComplaints.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolvedComplaints.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-0">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : currentList.length === 0 ? (
            <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No complaints found</h3>
              <p className="text-muted-foreground">
                {activeTab === 'active' 
                  ? "Great! You don't have any active complaints." 
                  : "No resolved complaints history found."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {currentList.map((complaint) => (
                <Card key={complaint.id} className={`rounded-3xl border-0 shadow-sm hover:shadow-md transition-all group overflow-hidden ${complaint.is_overdue ? 'bg-red-50' : 'bg-white'}`}>
                  <CardHeader className="pb-3 space-y-2 relative">
                    {/* Status Indicator Dot */}
                    <div className={`absolute top-4 right-4 h-3 w-3 rounded-full ${['resolved', 'closed'].includes(complaint.status) ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`} />
                    
                    <div className="flex flex-col gap-1 pr-4">
                         <Badge variant="secondary" className="w-fit rounded-lg bg-neutral-100 text-neutral-600 font-bold uppercase text-[10px] tracking-wider border-0">
                           {complaint.category}
                         </Badge>
                         <CardTitle className="text-lg font-black leading-tight text-foreground">{complaint.title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                        {getSeverityBadge(complaint.severity)}
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="bg-neutral-50/80 p-3 rounded-2xl border border-dashed border-neutral-200">
                        <p className="text-sm font-medium text-foreground/80 line-clamp-3 min-h-[3rem]">
                        {complaint.description}
                        </p>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                      <Clock className="w-3.5 h-3.5" />
                      {format(new Date(complaint.created_at), 'MMM d, h:mm a')}
                      {complaint.is_overdue && (
                        <span className="text-red-600 flex items-center gap-1 ml-auto">
                          <AlertTriangle className="w-3 h-3" /> Overdue
                        </span>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0 pb-4 px-6 flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                      {statusMutation.isPending && complaint.id === statusMutation.variables?.id ? (
                          <span className="text-xs font-bold text-muted-foreground animate-pulse">Updating...</span>
                      ) : user?.role !== 'student' && complaint.status === 'open' ? (
                        <Button 
                          size="sm" 
                          className="rounded-full h-8 px-4 bg-black text-white font-bold hover:bg-neutral-800 text-[10px] shadow-md shadow-black/10"
                          onClick={() => statusMutation.mutate({ id: complaint.id, status: 'resolved' })}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1.5" />
                          Mark Resolved
                        </Button>
                      ) : (
                          <div className="text-xs font-bold text-muted-foreground/50 py-1">
                              {getStatusBadge(complaint.status)}
                          </div>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
