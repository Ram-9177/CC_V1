import { useRef, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, Upload, Plus, MoreHorizontal, Shield, ShieldAlert, BadgeCheck } from 'lucide-react';
import { useDebounce } from '@/hooks/useCommon';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { getApiErrorMessage } from '@/lib/utils';
import { AddStudentDialog } from '@/components/modals/AddStudentDialog';
import { AddUserDialog } from '@/components/modals/AddUserDialog';

interface Tenant {
  id: number;
  father_name?: string;
  father_phone?: string;
  mother_name?: string;
  mother_phone?: string;
  guardian_name?: string;
  guardian_phone?: string;
  college_code?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  created_at: string;
  user: {
    id: number;
    name: string;
    hall_ticket?: string;
    username: string;
    role: string;
    registration_number?: string;
    phone?: string;
    is_student_hr?: boolean;
  };
}

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  phone: string;
  is_active: boolean;
}

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(searchQuery, 500);
  
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const currentUser = useAuthStore(state => state.user);

  const canElectHR = ['head_warden', 'admin', 'super_admin'].includes(currentUser?.role || '');

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Data for Tenants (Students)
  const { data: tenantData, isLoading: isTenantsLoading } = useQuery({
    queryKey: ['tenants', page, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      if (debouncedSearch) params.append('search', debouncedSearch);
      
      const response = await api.get(`/users/tenants/?${params.toString()}`);
      return response.data;
    },
     placeholderData: (previousData) => previousData,
  });

  const tenants: Tenant[] = tenantData?.results || (Array.isArray(tenantData) ? tenantData : []);
  
  // Data for All Users (Staff/Admin)
  const { data: usersData } = useQuery({
    queryKey: ['users', page, debouncedSearch],
    queryFn: async () => {
        const response = await api.get('/users/');
        return response.data;
    },
  });
  
  const staffUsers = Array.isArray(usersData) ? usersData.filter((u: User) => u.role !== 'student') : [];

  const uploadMutation = useMutation({
      mutationFn: async (file: File) => {
          const formData = new FormData();
          formData.append('file', file);
          return api.post('/users/tenants/bulk_upload/', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });
      },
      onSuccess: (res) => {
          toast.success(res.data.message || 'Upload successful');
          queryClient.invalidateQueries({ queryKey: ['tenants'] });
          if (res.data.errors && res.data.errors.length > 0) {
              res.data.errors.forEach((err: string) => toast.error(err));
          }
      },
      onError: (err: unknown) => {
          toast.error(getApiErrorMessage(err, 'Upload failed'));
      }
  });

  const toggleHrMutation = useMutation({
      mutationFn: async ({ id, status }: { id: number; status: boolean }) => {
          return api.post(`/users/tenants/${id}/toggle_hr/`, { status });
      },
      onSuccess: (res) => {
          toast.success(res.data.detail);
          queryClient.invalidateQueries({ queryKey: ['tenants'] });
      },
      onError: (err: unknown) => {
           toast.error(getApiErrorMessage(err, 'Failed to update HR status'));
      }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          uploadMutation.mutate(e.target.files[0]);
      }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
              <h1 className="text-3xl font-bold flex items-center gap-2 text-foreground">
              <Users className="h-8 w-8 text-primary" />
              User Management
              </h1>
              <p className="text-muted-foreground">Manage students, staff, and system users</p>
          </div>
        </div>
      
      <Tabs defaultValue="students" className="w-full">
        <div className="flex justify-between items-center mb-4">
             <TabsList>
                <TabsTrigger value="students">Students</TabsTrigger>
                <TabsTrigger value="staff">Staff & Admins</TabsTrigger>
             </TabsList>
        </div>

        {/* STUDENTS TAB */}
        <TabsContent value="students" className="space-y-4">
            <div className="flex justify-between items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                    placeholder="Search students..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    />
                </div>
                <div className="flex gap-2">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".csv" 
                        onChange={handleFileUpload}
                    />
                    <Button
                    variant="outline"
                    className="border-black text-foreground font-bold hover:bg-muted"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadMutation.isPending}
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        CSV Upload
                    </Button>
                    <Button onClick={() => setIsAddStudentOpen(true)} className="primary-gradient text-white font-semibold hover:opacity-90 smooth-transition">
                        <Plus className="h-4 w-4 mr-2" /> Add Student
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                {isTenantsLoading ? (
                    <div className="p-6 space-y-4">
                         <Skeleton className="h-10 w-full" />
                         <Skeleton className="h-10 w-full" />
                         <Skeleton className="h-10 w-full" />
                    </div>
                ) : tenants.length > 0 ? (
                    <div className="overflow-x-auto">
                        <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>College</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Address</TableHead>
                            {canElectHR && <TableHead className="w-12"></TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tenants.map((tenant) => (
                            <TableRow key={tenant.id}>
                                <TableCell>
                                <div className="flex items-center gap-2">
                                    <div className="font-medium">{tenant.user?.name || tenant.user?.username}</div>
                                    {tenant.user?.is_student_hr && (
                                        <Badge className="bg-black text-white hover:bg-black/80 gap-1 text-[10px] h-5 px-1.5 font-bold">
                                            <Shield className="w-3 h-3" /> HR
                                        </Badge>
                                    )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    HT: {tenant.user?.hall_ticket || tenant.user?.username}
                                </div>
                                </TableCell>
                                <TableCell><Badge className="bg-primary/20 text-black border border-primary/30 font-bold">{tenant.college_code || 'N/A'}</Badge></TableCell>
                                <TableCell className="text-sm">
                                    {tenant.user?.phone || '—'}
                                    <div className="text-xs text-muted-foreground">Parent: {tenant.father_phone || '-'}</div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                                {tenant.city || tenant.address || '—'}
                                </TableCell>
                                {canElectHR && (
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {tenant.user?.is_student_hr ? (
                                                    <DropdownMenuItem 
                                                        className="text-red-600 focus:text-red-600 cursor-pointer"
                                                        onClick={() => toggleHrMutation.mutate({ id: tenant.id, status: false })}
                                                    >
                                                        <ShieldAlert className="mr-2 h-4 w-4" />
                                                        Revoke HR Status
                                                    </DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem 
                                                        className="text-emerald-600 focus:text-emerald-600 cursor-pointer"
                                                        onClick={() => toggleHrMutation.mutate({ id: tenant.id, status: true })}
                                                    >
                                                        <BadgeCheck className="mr-2 h-4 w-4" />
                                                        Elect as HR
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                )}
                            </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </div>

                ) : (
                    <EmptyState
                    icon={Users}
                    title="No students found"
                    description="No students match your search."
                    />
                )}
                </CardContent>
            </Card>
        </TabsContent>

        {/* STAFF TAB */}
        <TabsContent value="staff" className="space-y-6">
             <div className="flex justify-end">
                 <Button onClick={() => setIsAddUserOpen(true)} className="primary-gradient text-white font-semibold hover:opacity-90 smooth-transition">
                    <Plus className="h-4 w-4 mr-2" /> Add Staff/User
                 </Button>
             </div>
             
             {Object.entries(
                staffUsers.reduce((acc: Record<string, User[]>, u: User) => {
                    const role = u.role;
                    if (!acc[role]) acc[role] = [];
                    acc[role].push(u);
                    return acc;
                }, {} as Record<string, User[]>)
             ).sort().map(([role, users]: [string, User[]]) => (
                <div key={role} className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <h3 className="text-sm font-black uppercase tracking-widest text-foreground">
                            {role.replace('_', ' ')} <span className="text-slate-400 ml-1">({users.length})</span>
                        </h3>
                    </div>
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-[200px]">Username</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead className="text-right">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((u: User) => (
                                        <TableRow key={u.id}>
                                            <TableCell className="font-bold text-foreground">{u.username}</TableCell>
                                            <TableCell className="text-slate-700">{u.name || '-'}</TableCell>
                                            <TableCell className="text-slate-700">{u.phone || '-'}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge className={u.is_active ? 'bg-primary/20 text-black border border-primary/30 font-bold' : 'bg-black text-white font-bold'}>
                                                    {u.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
             ))}

             {staffUsers.length === 0 && (
                <EmptyState
                    icon={Users}
                    title="No staff users found"
                    description="You haven't added any staff or admin users yet."
                />
             )}
        </TabsContent>
        
      </Tabs>

      <AddStudentDialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen} />
      <AddUserDialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen} />
      
    </div>
  );
}
