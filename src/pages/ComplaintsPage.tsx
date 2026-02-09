
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MessageSquare, AlertCircle, CheckCircle2, Clock, Hammer, AlertOctagon, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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
    onError: (error: any) => {
      toast.error('Failed to submit complaint');
    }
  });

  const activeComplaints = complaints?.filter(c => ['open', 'in_progress'].includes(c.status)) || [];
  const resolvedComplaints = complaints?.filter(c => ['resolved', 'closed'].includes(c.status)) || [];
  
  const currentList = activeTab === 'active' ? activeComplaints : resolvedComplaints;

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return <Badge variant="destructive" className="animate-pulse"><AlertOctagon className="w-3 h-3 mr-1"/> Critical</Badge>;
      case 'high': return <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600"><AlertTriangle className="w-3 h-3 mr-1"/> High</Badge>;
      case 'medium': return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-200"><AlertTriangle className="w-3 h-3 mr-1"/> Medium</Badge>;
      case 'low': return <Badge variant="outline" className="text-slate-500">Low</Badge>;
      default: return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">Open</Badge>;
      case 'in_progress': return <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-200"><Hammer className="w-3 h-3 mr-1"/> In Progress</Badge>;
      case 'resolved': return <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="w-3 h-3 mr-1"/> Resolved</Badge>;
      case 'closed': return <Badge variant="secondary">Closed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Hammer className="h-8 w-8 text-primary" />
            Complaints & Maintenance
          </h1>
          <p className="text-muted-foreground">Report and track maintenance issues</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="shadow-md">
              <Plus className="w-5 h-5 mr-2" />
              New Complaint
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Report an Issue</DialogTitle>
              <DialogDescription>
                Submit a new maintenance request or complaint.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Issue Title</Label>
                <Input 
                  id="title" 
                  placeholder="e.g. Fan not working in Room 101" 
                  value={newComplaint.title}
                  onChange={(e) => setNewComplaint({...newComplaint, title: e.target.value})}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select 
                    value={newComplaint.category} 
                    onValueChange={(val) => setNewComplaint({...newComplaint, category: val})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="severity">Urgency</Label>
                  <Select 
                    value={newComplaint.severity} 
                    onValueChange={(val) => setNewComplaint({...newComplaint, severity: val as any})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select urgency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low - Can wait</SelectItem>
                      <SelectItem value="medium">Medium - Standard</SelectItem>
                      <SelectItem value="high">High - Urgent</SelectItem>
                      <SelectItem value="critical">Critical - Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  placeholder="Please describe the issue in detail..." 
                  className="min-h-[100px]"
                  value={newComplaint.description}
                  onChange={(e) => setNewComplaint({...newComplaint, description: e.target.value})}
                  required
                />
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Submitting...' : 'Submit Complaint'}
                </Button>
              </DialogFooter>
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
                <Card key={complaint.id} className={`hover:shadow-md transition-shadow ${complaint.is_overdue ? 'border-red-200 bg-red-50/50' : ''}`}>
                  <CardHeader className="pb-3 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                         <Badge variant="secondary" className="uppercase text-[10px] tracking-wider mb-1">
                           {complaint.category}
                         </Badge>
                         <CardTitle className="line-clamp-1 text-lg">{complaint.title}</CardTitle>
                      </div>
                      {getSeverityBadge(complaint.severity)}
                    </div>
                    <CardDescription className="flex items-center gap-2 text-xs">
                      <Clock className="w-3 h-3" />
                      {format(new Date(complaint.created_at), 'MMM d, h:mm a')}
                      {complaint.is_overdue && (
                        <span className="text-destructive font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Overdue
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <p className="text-sm text-muted-foreground line-clamp-3 min-h-[3rem]">
                      {complaint.description}
                    </p>
                  </CardContent>
                  <CardFooter className="pt-3 border-t bg-muted/20 flex justify-between items-center">
                    {getStatusBadge(complaint.status)}
                    {user?.role !== 'student' && complaint.student_details && (
                       <span className="text-xs text-muted-foreground font-medium truncate max-w-[120px]">
                         by {complaint.student_details.name}
                       </span>
                    )}
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
