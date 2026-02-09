import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, LogIn, LogOut, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

interface Visitor {
  id: number;
  visitor_name: string;
  phone_number: string;
  student_details?: {
    name: string;
    room_number?: string;
  };
  purpose: string;
  check_in: string;
  check_out?: string;
  id_proof_type?: string;
  id_proof_number?: string;
  is_active: boolean;
}

export default function VisitorsPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newVisitor, setNewVisitor] = useState({
    visitor_name: '',
    phone_number: '',
    student_id: '', // Need search for student
    purpose: '',
    relationship: 'Family',
    id_proof_type: 'Government ID',
    id_proof_number: ''
  });

  const { data: activeVisitors, isLoading: activeLoading } = useQuery<Visitor[]>({
    queryKey: ['visitors'],
    queryFn: async () => {
      const response = await api.get('/visitors/');
      return response.data.results;
    }
  });

  // Fetch students for autocomplete - simplified for now to text input or manual typical ID
  // Ideally use a debounced search. For MVP, we'll assume manual entry of Reg No or Student search.
  // We'll skip Student Search for this iteration and just let them type name or ID if backend supports it.
  // Actually, backend VisitorLogSerializer expects `student` (PK).
  // I need a student search.

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/visitors/', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      setIsOpen(false);
      setNewVisitor({
          visitor_name: '',
          phone_number: '',
          student_id: '',
          purpose: '',
          relationship: 'Family',
          id_proof_type: 'Government ID',
          id_proof_number: ''
      });
      toast.success('Visitor checked in successfully');
    },
    onError: () => {
      toast.error('Failed to check in visitor');
    }
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
    onError: () => {
      toast.error('Failed to check out visitor');
    }
  });

  const filteredVisitors = activeVisitors?.filter(v => {
    const matchesSearch = v.visitor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (v.student_details?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'active') return v.is_active && matchesSearch;
    return !v.is_active && matchesSearch;
  }) || [];

  const handleCheckout = (id: number) => {
    if (confirm('Are you sure you want to check out this visitor?')) {
        checkoutMutation.mutate(id);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserPlus className="h-8 w-8 text-primary" />
            Visitor Management
          </h1>
          <p className="text-muted-foreground">Log and track visitors</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="shadow-md">
              <UserPlus className="w-5 h-5 mr-2" />
              Check-In Visitor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Visitor Check-In</DialogTitle>
              <DialogDescription>
                Record details for new visitor entry.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="v_name">Visitor Name</Label>
                    <Input 
                      id="v_name" 
                      value={newVisitor.visitor_name}
                      onChange={(e) => setNewVisitor({...newVisitor, visitor_name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="v_phone">Phone Number</Label>
                    <Input 
                      id="v_phone" 
                      value={newVisitor.phone_number}
                      onChange={(e) => setNewVisitor({...newVisitor, phone_number: e.target.value})}
                    />
                  </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="s_id">Student ID (User ID)</Label>
                <Input 
                  id="s_id" 
                  placeholder="Enter User ID (PK) for now"
                  type="number"
                  value={newVisitor.student_id}
                  onChange={(e) => setNewVisitor({...newVisitor, student_id: e.target.value})}
                />
                <p className="text-xs text-muted-foreground">Enter internal User ID. (TODO: Add Student Search)</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="relationship">Relationship</Label>
                  <Input 
                    id="relationship" 
                    value={newVisitor.relationship}
                    onChange={(e) => setNewVisitor({...newVisitor, relationship: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purpose">Purpose</Label>
                  <Input 
                    id="purpose" 
                    value={newVisitor.purpose}
                    onChange={(e) => setNewVisitor({...newVisitor, purpose: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="id_type">ID Proof Type</Label>
                    <Input 
                      id="id_type" 
                      value={newVisitor.id_proof_type}
                      onChange={(e) => setNewVisitor({...newVisitor, id_proof_type: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="id_num">ID Number</Label>
                    <Input 
                      id="id_num" 
                      value={newVisitor.id_proof_number}
                      onChange={(e) => setNewVisitor({...newVisitor, id_proof_number: e.target.value})}
                    />
                  </div>
              </div>

              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                    // Convert student_id to number if present
                    const payload = {
                        ...newVisitor,
                        student: newVisitor.student_id ? parseInt(newVisitor.student_id) : null
                    };
                    createMutation.mutate(payload);
                }}>
                  Check In
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search visitors or students..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <Tabs defaultValue="active" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="active">Active Visitors</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-0">
          <Card>
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
                      {activeLoading ? (
                          <TableRow>
                              <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
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
                                <div>
                                  <div className="font-medium">{visitor.visitor_name}</div>
                                  <div className="text-xs text-muted-foreground">{visitor.phone_number}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{visitor.student_details?.name || 'N/A'}</div>
                                </div>
                              </TableCell>
                              <TableCell>{visitor.purpose}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <LogIn className="h-3 w-3 text-muted-foreground" />
                                  {format(new Date(visitor.check_in), 'PP p')}
                                </div>
                              </TableCell>
                              <TableCell>
                                {visitor.is_active ? (
                                  <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Active</Badge>
                                ) : (
                                  <div className="space-y-1">
                                    <Badge variant="secondary">Checked Out</Badge>
                                    {visitor.check_out && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <LogOut className="h-3 w-3" />
                                        {format(new Date(visitor.check_out), 'p')}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {visitor.is_active && (
                                    <Button size="sm" variant="outline" onClick={() => handleCheckout(visitor.id)}>
                                        Check Out
                                    </Button>
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
