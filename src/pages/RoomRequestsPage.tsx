import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  GitPullRequest, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  Home, 
  ArrowRight,
  MessageSquare,
  Bed,
  Plus
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getApiErrorMessage, cn } from '@/lib/utils';
import { isManagement, isStudent as isStudentRole } from '@/lib/rbac';
import { SEO } from '@/components/common/SEO';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteConfirmation } from '@/components/common/DeleteConfirmation';

interface RoomRequest {
  id: number;
  student: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    registration_number: string;
  };
  current_room_number?: string;
  current_bed_number?: string;
  preferred_room_type: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
  handled_by_name?: string;
  remarks?: string;
  target_room_number?: string;
  target_bed_number?: string;
}

interface Room {
    id: number;
    room_number: string;
    floor: number;
    room_type: string;
    beds: Array<{ id: number; bed_number: string; is_occupied: boolean }>;
}

export default function RoomRequestsPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const isAuthority = isManagement(user?.role);
  const isStudent = isStudentRole(user?.role);

  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RoomRequest | null>(null);
  const [confirmRejectOpen, setConfirmRejectOpen] = useState(false);
  
  // States for approval
  const [targetRoomId, setTargetRoomId] = useState<string>('');
  const [targetBedId, setTargetBedId] = useState<string>('');
  const [approvalRemarks, setApprovalRemarks] = useState('');

  // Queries
  const { data: requests, isLoading } = useQuery<RoomRequest[]>({
    queryKey: ['room-requests', statusFilter],
    queryFn: async () => {
      const response = await api.get(`/rooms/requests/?status=${statusFilter}`);
      return response.data;
    },
  });

  const { data: rooms } = useQuery<Room[]>({
    queryKey: ['rooms-available'],
    queryFn: async () => {
        const response = await api.get('/rooms/?status=available');
        return response.data;
    },
    enabled: approvalDialogOpen,
  });

  // Mutations
  const createRequestMutation = useMutation({
    mutationFn: async (data: { preferred_room_type: string; reason: string }) => {
      await api.post('/rooms/requests/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-requests'] });
      toast.success('Room change request submitted successfully');
      setRequestDialogOpen(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to submit request')),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, bedId, remarks }: { id: number; bedId: string; remarks: string }) => {
      await api.post(`/rooms/requests/${id}/approve/`, { target_bed_id: bedId, remarks });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-requests'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Request approved and student moved');
      setApprovalDialogOpen(false);
      setSelectedRequest(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to approve request')),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, remarks }: { id: number; remarks: string }) => {
      await api.post(`/rooms/requests/${id}/reject/`, { remarks });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-requests'] });
      toast.success('Request rejected');
      setApprovalDialogOpen(false);
      setSelectedRequest(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to reject request')),
  });

  const filteredRequests = requests?.filter(req => 
    req.student.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    req.student.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    req.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) return <PageSkeleton variant="dashboard" />;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <SEO title="Room Change Requests" description="Manage and track student room transition requests." />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-black px-3 py-1 uppercase tracking-widest text-[10px]">
              Institutional Logistics
            </Badge>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            Room Transitions <GitPullRequest className="text-primary h-8 w-8" />
          </h1>
          <p className="text-slate-500 font-medium">Systemic handling of student room change and upgrade requests.</p>
        </div>

        {isStudent && (
          <Button 
            onClick={() => setRequestDialogOpen(true)}
            className="h-14 px-8 primary-gradient text-white font-black rounded-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest text-xs"
          >
            New Request <Plus className="ml-2 h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Filters & Search */}
      <Card className="border-0 shadow-sm bg-white/60 backdrop-blur-md rounded-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by student name or hall ticket..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-white border-slate-200 rounded-sm focus:ring-primary"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] h-11 bg-white border-slate-200 rounded-sm">
                  <div className="flex items-center gap-2 font-bold">
                    <Filter className="h-4 w-4" />
                    <SelectValue placeholder="Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="all">All Requests</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests && filteredRequests.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRequests.map((req) => (
              <Card key={req.id} className="group hover:shadow-xl transition-all duration-300 border-0 rounded-sm overflow-hidden bg-white shadow-md">
                <div className={cn(
                  "h-1.5 w-full",
                  req.status === 'pending' ? "bg-amber-500" :
                  req.status === 'approved' ? "bg-emerald-500" : "bg-slate-300"
                )} />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-sm bg-slate-100 flex items-center justify-center font-black text-slate-400">
                        {req.student.first_name[0]}
                      </div>
                      <div>
                        <CardTitle className="text-sm font-black text-slate-900 leading-tight">
                          {req.student.first_name} {req.student.last_name}
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-wider">
                          {req.student.registration_number || req.student.username}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className={cn(
                      "font-black text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-sm border-0 shadow-sm",
                      req.status === 'pending' ? "bg-amber-100 text-amber-700" :
                      req.status === 'approved' ? "bg-emerald-100 text-emerald-700" :
                      "bg-slate-100 text-slate-700"
                    )}>
                      {req.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-slate-50 rounded-sm border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Room</p>
                      <p className="text-xs font-black flex items-center gap-1.5">
                        <Home className="h-3 w-3 text-primary" /> {req.current_room_number || 'N/A'}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-sm border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Preferred Type</p>
                      <p className="text-xs font-black capitalize flex items-center gap-1.5">
                        <Bed className="h-3 w-3 text-primary" /> {req.preferred_room_type}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         <MessageSquare className="h-3 w-3" /> Reason for Change
                    </p>
                    <p className="text-xs font-medium text-slate-600 line-clamp-3 bg-slate-50 p-2.5 rounded-sm border border-slate-100 italic">
                      "{req.reason}"
                    </p>
                  </div>

                  {req.status !== 'pending' && req.remarks && (
                    <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-sm">
                        <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1">Authority Feedback</p>
                        <p className="text-[10px] font-bold text-blue-800 line-clamp-2">{req.remarks}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-400">
                        {format(new Date(req.created_at), 'MMM d, p')}
                      </span>
                    </div>
                    
                    {isAuthority && req.status === 'pending' && (
                      <Button 
                        size="sm" 
                        onClick={() => { setSelectedRequest(req); setApprovalDialogOpen(true); }}
                        className="h-8 rounded-sm bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-black"
                      >
                        Action <ArrowRight className="ml-1.5 h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState 
            title="No Requests Found" 
            description="There are no room change requests matching your current filters."
            variant="info"
          />
        )}
      </div>

      {/* New Request Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="p-0 border-0 rounded-sm overflow-hidden bg-white shadow-2xl max-w-lg">
          <div className="bg-primary p-6 text-white text-center">
            <DialogTitle className="text-2xl font-black tracking-tight">Request Room Change</DialogTitle>
            <DialogDescription className="text-white/70 text-xs font-medium mt-1">Institutional protocol for room transitions.</DialogDescription>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            createRequestMutation.mutate({
              preferred_room_type: formData.get('preferred_type') as string,
              reason: formData.get('reason') as string,
            });
          }} className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Preferred Room Type</Label>
                <Select name="preferred_type" required>
                  <SelectTrigger className="h-12 border-slate-200 rounded-sm font-bold">
                    <SelectValue placeholder="Select room type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single Luxury</SelectItem>
                    <SelectItem value="double">Standard Double</SelectItem>
                    <SelectItem value="triple">Shared Triple</SelectItem>
                    <SelectItem value="quad">Economy Quad</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Detailed Reason</Label>
                <Textarea 
                  name="reason" 
                  placeholder="Explain why you are requesting a move..." 
                  className="min-h-[120px] border-slate-200 rounded-sm bg-slate-50 focus:ring-primary font-medium text-sm p-4"
                  required
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col gap-2 sm:gap-0">
               <Button type="submit" disabled={createRequestMutation.isPending} className="w-full h-12 primary-gradient text-white font-black uppercase tracking-widest rounded-sm">
                 {createRequestMutation.isPending ? 'Submitting...' : 'Submit Request'}
               </Button>
               <Button type="button" variant="ghost" onClick={() => setRequestDialogOpen(false)} className="w-full text-slate-400 font-bold hover:bg-slate-50">Cancel</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Approval/Action Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="p-0 border-0 rounded-sm overflow-hidden bg-white shadow-2xl max-w-xl">
           <div className="bg-slate-900 p-6 text-white text-center">
              <Badge className="bg-primary text-black font-black text-[9px] uppercase tracking-widest mb-2 px-2">Decision Center</Badge>
              <DialogTitle className="text-2xl font-black tracking-tight">Handle Transition</DialogTitle>
              <DialogDescription className="text-slate-400 text-xs font-medium mt-1">Evaluate and process student room change request.</DialogDescription>
           </div>
           
           <div className="p-6 space-y-6">
              <div className="p-4 bg-slate-100 rounded-sm border border-slate-200">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">Student Reason</p>
                  <p className="text-sm font-bold text-slate-800">"{selectedRequest?.reason}"</p>
              </div>

              <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Target Room {selectedRequest?.preferred_room_type && `(Prefer: ${selectedRequest.preferred_room_type})`}</Label>
                    <Select value={targetRoomId} onValueChange={(v) => { setTargetRoomId(v); setTargetBedId(''); }}>
                        <SelectTrigger className="h-12 border-slate-200 rounded-sm font-bold bg-white">
                            <SelectValue placeholder="Select available room..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                            {rooms?.map(room => (
                                <SelectItem key={room.id} value={room.id.toString()}>
                                    Room {room.room_number} • Floor {room.floor} • ({room.room_type})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  </div>

                  {targetRoomId && (
                     <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Select Bed</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {rooms?.find(r => r.id.toString() === targetRoomId)?.beds.map(bed => (
                               <Button
                                 key={bed.id}
                                 variant="outline"
                                 disabled={bed.is_occupied}
                                 onClick={() => setTargetBedId(bed.id.toString())}
                                 className={cn(
                                     "h-12 rounded-sm border-2 justify-start font-bold",
                                     targetBedId === bed.id.toString() ? "border-primary bg-primary/5 text-primary" : "border-slate-100 hover:border-slate-200",
                                     bed.is_occupied && "opacity-50 cursor-not-allowed bg-slate-50"
                                 )}
                               >
                                  <Bed className={cn("h-4 w-4 mr-2", targetBedId === bed.id.toString() ? "text-primary" : "text-slate-400")} />
                                  Bed {bed.bed_number}
                                  {bed.is_occupied && <span className="ml-auto text-[8px] uppercase tracking-tighter opacity-50">Taken</span>}
                               </Button>
                            ))}
                        </div>
                     </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Authority Remarks (Visible to student)</Label>
                    <Input 
                        placeholder="e.g., Approved for Room upgrade..." 
                        value={approvalRemarks}
                        onChange={(e) => setApprovalRemarks(e.target.value)}
                        className="h-12 border-slate-200 rounded-sm bg-slate-50 focus:ring-primary font-bold"
                    />
                  </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                        setConfirmRejectOpen(true);
                    }}
                    className="flex-1 h-12 text-red-500 font-bold border-2 border-red-50 hover:bg-red-50 rounded-sm"
                  >
                    <XCircle className="h-4 w-4 mr-2" /> REJECT
                  </Button>
                  <Button 
                    disabled={!targetBedId || approveMutation.isPending}
                    onClick={() => {
                        approveMutation.mutate({ 
                            id: selectedRequest!.id, 
                            bedId: targetBedId, 
                            remarks: approvalRemarks 
                        });
                    }}
                    className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-sm shadow-lg shadow-emerald-200"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" /> {approveMutation.isPending ? 'MOVING...' : 'APPROVE & MOVE'}
                  </Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmation
        isOpen={confirmRejectOpen}
        onClose={() => setConfirmRejectOpen(false)}
        onConfirm={() => {
          if (!selectedRequest) return;
          rejectMutation.mutate(
            { id: selectedRequest.id, remarks: approvalRemarks },
            { onSuccess: () => setConfirmRejectOpen(false) }
          );
        }}
        isLoading={rejectMutation.isPending}
        title="Reject Room Request"
        description="This request will be marked as rejected and the student will be notified with your remarks."
        itemName={selectedRequest ? `${selectedRequest.student.first_name} ${selectedRequest.student.last_name}` : undefined}
      />
    </div>
  );
}
