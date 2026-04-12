import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, Search, UserPlus, Users } from 'lucide-react';
import { format } from 'date-fns';

import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { StudentSearch } from '@/components/common/StudentSearch';
import { toast } from 'sonner';

interface VisitorLog {
  id: number;
  visitor_name: string;
  relationship: string;
  phone_number: string;
  purpose: string;
  check_in: string;
  check_out?: string;
  student_details?: {
    name: string;
    room_number?: string;
  };
  is_active: boolean;
}

interface VisitorPreRegistration {
  id: number;
  visitor_name: string;
  relationship: string;
  phone_number: string;
  purpose: string;
  expected_date: string;
  expected_time?: string;
  status: 'pending' | 'approved' | 'rejected' | 'checked_in' | 'expired';
  rejection_reason?: string;
  notes?: string;
  created_at: string;
}

const statusBadgeClass: Record<VisitorPreRegistration['status'], string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  checked_in: 'bg-blue-100 text-blue-800 border-blue-200',
  expired: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function VisitorsPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const isStudent = user?.role === 'student';

  const [searchTerm, setSearchTerm] = useState('');
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isPreRegOpen, setIsPreRegOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  const [newVisitor, setNewVisitor] = useState({
    visitor_name: '',
    phone_number: '',
    student_id: '',
    purpose: '',
    relationship: 'Family',
    id_proof_number: '',
  });

  const [newPreRegistration, setNewPreRegistration] = useState({
    visitor_name: '',
    relationship: 'Family',
    phone_number: '',
    purpose: '',
    expected_date: '',
    expected_time: '',
    id_proof_number: '',
    notes: '',
  });

  const { data: visitorLogs = [], isLoading: visitorLogsLoading } = useQuery<VisitorLog[]>({
    queryKey: ['visitors', isStudent ? 'student' : 'management'],
    queryFn: async () => {
      const response = await api.get('/visitors/');
      return response.data.results || response.data || [];
    },
  });

  const { data: preRegistrations = [], isLoading: preRegsLoading } = useQuery<VisitorPreRegistration[]>({
    queryKey: ['visitors', 'pre-registrations'],
    queryFn: async () => {
      const response = await api.get('/visitors/pre-registrations/');
      return response.data.results || response.data || [];
    },
    enabled: isStudent,
  });

  const createVisitorMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const response = await api.post('/visitors/', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      setIsCheckInOpen(false);
      setNewVisitor({
        visitor_name: '',
        phone_number: '',
        student_id: '',
        purpose: '',
        relationship: 'Family',
        id_proof_number: '',
      });
      toast.success('Visitor checked in successfully');
    },
    onError: () => toast.error('Failed to check in visitor'),
  });

  const checkoutMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.post(`/visitors/${id}/checkout/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      toast.success('Visitor checked out');
    },
    onError: () => toast.error('Failed to check out visitor'),
  });

  const createPreRegistrationMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const response = await api.post('/visitors/pre-registrations/', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors', 'pre-registrations'] });
      setIsPreRegOpen(false);
      setNewPreRegistration({
        visitor_name: '',
        relationship: 'Family',
        phone_number: '',
        purpose: '',
        expected_date: '',
        expected_time: '',
        id_proof_number: '',
        notes: '',
      });
      toast.success('Visitor pre-registration submitted');
    },
    onError: () => toast.error('Failed to submit visitor pre-registration'),
  });

  const filteredVisitors = visitorLogs.filter((visitor) => {
    const matchesSearch =
      visitor.visitor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (visitor.student_details?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return activeTab === 'active' ? visitor.is_active && matchesSearch : !visitor.is_active && matchesSearch;
  });

  const filteredPreRegs = preRegistrations.filter((entry) => {
    if (!searchTerm) return true;
    return (
      entry.visitor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.purpose.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (isStudent) {
    return (
      <div className="page-frame mx-auto min-w-0 w-full max-w-5xl space-y-3 sm:space-y-4 pb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2 text-foreground">
              <UserPlus className="h-8 w-8 text-primary" />
              Visitor Pre-Registration
            </h1>
            <p className="text-muted-foreground">Register expected visitors before they arrive at the hostel gate</p>
          </div>

          <Dialog open={isPreRegOpen} onOpenChange={setIsPreRegOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="primary-gradient text-white font-semibold hover:opacity-90 smooth-transition shadow-md">
                <UserPlus className="w-5 h-5 mr-2" />
                New Visitor Request
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px]">
              <DialogHeader>
                <DialogTitle>Pre-Register Visitor</DialogTitle>
                <DialogDescription>
                  Share the expected visitor details so security can verify and speed up entry.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pr_name">Visitor Name</Label>
                    <Input
                      id="pr_name"
                      value={newPreRegistration.visitor_name}
                      onChange={(event) => setNewPreRegistration((current) => ({ ...current, visitor_name: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pr_phone">Phone Number</Label>
                    <Input
                      id="pr_phone"
                      value={newPreRegistration.phone_number}
                      onChange={(event) => setNewPreRegistration((current) => ({ ...current, phone_number: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pr_relationship">Relationship</Label>
                    <Input
                      id="pr_relationship"
                      value={newPreRegistration.relationship}
                      onChange={(event) => setNewPreRegistration((current) => ({ ...current, relationship: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pr_idproof">ID Proof Number</Label>
                    <Input
                      id="pr_idproof"
                      value={newPreRegistration.id_proof_number}
                      onChange={(event) => setNewPreRegistration((current) => ({ ...current, id_proof_number: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pr_date">Expected Date</Label>
                    <Input
                      id="pr_date"
                      type="date"
                      value={newPreRegistration.expected_date}
                      onChange={(event) => setNewPreRegistration((current) => ({ ...current, expected_date: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pr_time">Expected Time</Label>
                    <Input
                      id="pr_time"
                      type="time"
                      value={newPreRegistration.expected_time}
                      onChange={(event) => setNewPreRegistration((current) => ({ ...current, expected_time: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pr_purpose">Purpose</Label>
                  <Input
                    id="pr_purpose"
                    value={newPreRegistration.purpose}
                    onChange={(event) => setNewPreRegistration((current) => ({ ...current, purpose: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pr_notes">Notes</Label>
                  <Textarea
                    id="pr_notes"
                    value={newPreRegistration.notes}
                    onChange={(event) => setNewPreRegistration((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Optional entry notes for security or hostel staff"
                  />
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsPreRegOpen(false)}>Cancel</Button>
                  <Button
                    className="primary-gradient text-white font-semibold hover:opacity-90 smooth-transition"
                    onClick={() => {
                      if (!newPreRegistration.visitor_name.trim() || !newPreRegistration.expected_date || !newPreRegistration.purpose.trim()) {
                        toast.error('Visitor name, expected date, and purpose are required');
                        return;
                      }

                      createPreRegistrationMutation.mutate({
                        ...newPreRegistration,
                        expected_time: newPreRegistration.expected_time || null,
                        notes: newPreRegistration.notes || '',
                      });
                    }}
                  >
                    Submit Request
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search your visitor requests..."
            className="pl-9"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <Tabs defaultValue="requests" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="requests">Pre-Registrations</TabsTrigger>
            <TabsTrigger value="history">Visitor History</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-4">
            {preRegsLoading ? (
              <Card className="rounded-xl border border-border bg-card shadow-sm">
                <CardContent className="py-6 space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 w-full rounded-sm" />
                  ))}
                </CardContent>
              </Card>
            ) : filteredPreRegs.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {filteredPreRegs.map((entry) => (
                  <Card key={entry.id} className="rounded-xl border border-border bg-card shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">{entry.visitor_name}</CardTitle>
                          <CardDescription>
                            {entry.relationship} • {entry.phone_number || 'No phone provided'}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className={statusBadgeClass[entry.status]}>
                          {entry.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="text-muted-foreground">
                        Expected on {format(new Date(entry.expected_date), 'dd MMM yyyy')}
                        {entry.expected_time ? ` at ${entry.expected_time}` : ''}
                      </div>
                      <div><span className="font-semibold text-foreground">Purpose:</span> {entry.purpose}</div>
                      {entry.notes ? <div><span className="font-semibold text-foreground">Notes:</span> {entry.notes}</div> : null}
                      {entry.rejection_reason ? (
                        <div className="rounded-sm bg-red-50 border border-red-100 text-red-700 px-3 py-2">
                          Rejection reason: {entry.rejection_reason}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="rounded-xl border border-border bg-card shadow-sm">
                <CardContent className="py-12 text-center text-muted-foreground">
                  No visitor pre-registrations yet.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {visitorLogsLoading ? (
              <Card className="rounded-xl border border-border bg-card shadow-sm">
                <CardContent className="py-6 space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 w-full rounded-sm" />
                  ))}
                </CardContent>
              </Card>
            ) : visitorLogs.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {visitorLogs.map((visitor) => (
                  <Card key={visitor.id} className="rounded-xl border border-border bg-card shadow-sm">
                    <CardContent className="py-5 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{visitor.visitor_name}</p>
                          <p className="text-sm text-muted-foreground">{visitor.relationship} • {visitor.purpose}</p>
                        </div>
                        <Badge variant="outline" className={visitor.is_active ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'}>
                          {visitor.is_active ? 'Inside' : 'Completed'}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Check-in: {format(new Date(visitor.check_in), 'dd MMM yyyy, hh:mm a')}
                      </div>
                      {visitor.check_out ? (
                        <div className="text-sm text-muted-foreground">
                          Check-out: {format(new Date(visitor.check_out), 'dd MMM yyyy, hh:mm a')}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="rounded-xl border border-border bg-card shadow-sm">
                <CardContent className="py-12 text-center text-muted-foreground">
                  No visitor history found yet.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="page-frame mx-auto min-w-0 w-full max-w-6xl space-y-3 sm:space-y-4 pb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-foreground">
            <Users className="h-8 w-8 text-primary" />
            Visitor Management
          </h1>
          <p className="text-muted-foreground">Log and track visitors at the gate</p>
        </div>

        <Dialog open={isCheckInOpen} onOpenChange={setIsCheckInOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="primary-gradient text-white font-semibold hover:opacity-90 smooth-transition shadow-md">
              <UserPlus className="w-5 h-5 mr-2" />
              Check-In Visitor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Visitor Check-In</DialogTitle>
              <DialogDescription>Record details for a new visitor entry.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="v_name">Visitor Name</Label>
                  <Input id="v_name" value={newVisitor.visitor_name} onChange={(event) => setNewVisitor((current) => ({ ...current, visitor_name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v_phone">Phone Number</Label>
                  <Input id="v_phone" value={newVisitor.phone_number} onChange={(event) => setNewVisitor((current) => ({ ...current, phone_number: event.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Select Student</Label>
                <StudentSearch
                  onSelect={(studentId) => setNewVisitor((current) => ({ ...current, student_id: studentId.toString() }))}
                  placeholder="Search by name or hall ticket..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="relationship">Relationship</Label>
                  <Input id="relationship" value={newVisitor.relationship} onChange={(event) => setNewVisitor((current) => ({ ...current, relationship: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purpose">Purpose</Label>
                  <Input id="purpose" value={newVisitor.purpose} onChange={(event) => setNewVisitor((current) => ({ ...current, purpose: event.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="id_num">ID Proof Number</Label>
                <Input id="id_num" value={newVisitor.id_proof_number} onChange={(event) => setNewVisitor((current) => ({ ...current, id_proof_number: event.target.value }))} />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCheckInOpen(false)}>Cancel</Button>
                <Button
                  className="primary-gradient text-white font-semibold hover:opacity-90 smooth-transition"
                  onClick={() => {
                    if (!newVisitor.student_id) {
                      toast.error('Please select a student');
                      return;
                    }
                    if (!newVisitor.visitor_name.trim()) {
                      toast.error('Visitor name is required');
                      return;
                    }

                    createVisitorMutation.mutate({
                      visitor_name: newVisitor.visitor_name,
                      phone_number: newVisitor.phone_number,
                      relationship: newVisitor.relationship,
                      purpose: newVisitor.purpose,
                      id_proof_number: newVisitor.id_proof_number,
                      student: parseInt(newVisitor.student_id, 10),
                    });
                  }}
                >
                  Check In
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search visitors or students..." className="pl-9" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
      </div>

      <Tabs defaultValue="active" value={activeTab} onValueChange={(value) => setActiveTab(value as 'active' | 'history')} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="active">Active Visitors</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-0">
          <Card className="rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Visitor</TableHead>
                  <TableHead>Student Visited</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visitorLogsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-4 border-0">
                      <div className="space-y-2 px-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <Skeleton key={index} className="h-10 w-full rounded-sm" />
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredVisitors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No visitors found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVisitors.map((visitor) => (
                    <TableRow key={visitor.id}>
                      <TableCell>
                        <div className="font-semibold">{visitor.visitor_name}</div>
                        <div className="text-sm text-muted-foreground">{visitor.relationship}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{visitor.student_details?.name || 'Unknown'}</div>
                        <div className="text-sm text-muted-foreground">{visitor.student_details?.room_number || 'Room pending'}</div>
                      </TableCell>
                      <TableCell>{visitor.purpose}</TableCell>
                      <TableCell>{format(new Date(visitor.check_in), 'dd MMM yyyy, hh:mm a')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={visitor.is_active ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'}>
                          {visitor.is_active ? 'Inside' : 'Completed'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {visitor.is_active ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => checkoutMutation.mutate(visitor.id)}
                            disabled={checkoutMutation.isPending}
                          >
                            <LogOut className="h-4 w-4 mr-2" />
                            Check Out
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">Completed</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
