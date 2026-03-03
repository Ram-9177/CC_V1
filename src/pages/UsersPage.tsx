import { useRef, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, Upload, Plus, MoreHorizontal, Shield, ShieldAlert, BadgeCheck, Edit, Trash2, School } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { getApiErrorMessage } from '@/lib/utils';
import { isTopLevelManagement, isAdmin, isWarden } from '@/lib/rbac';
import { AddStudentDialog, AddUserDialog, EditStudentDialog } from '@/components/modals';
import { useWebSocketEvent } from '@/hooks/useWebSocket';
import { College } from '@/types';

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
  is_allocated?: boolean;
  room_number?: string;
  user: {
    id: number;
    name: string;
    hall_ticket?: string;
    username: string;
    role: string;
    is_active: boolean;
    is_approved: boolean;
    registration_number?: string;
    phone?: string;
    email?: string;
    is_student_hr?: boolean;
    college?: number | null;
    college_name?: string | null;
    college_code?: string | null;
  };
  parent_informed?: boolean;
}

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  phone: string;
  is_active: boolean;
  is_approved: boolean;
  email?: string;
  date_joined?: string;
  college?: number | null;
  college_name?: string | null;
  college_code?: string | null;
}

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(searchQuery, 500);
  
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [studentStatusFilter, setStudentStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [staffStatusFilter, setStaffStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [collegeFilter, setCollegeFilter] = useState<string>('all');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const currentUser = useAuthStore(state => state.user);

  const canElectHR = isTopLevelManagement(currentUser?.role);
  const canEditStudent = ['warden', 'head_warden', 'admin', 'super_admin'].includes(currentUser?.role || '');
  const canManageUsers = isTopLevelManagement(currentUser?.role);
  const canCreateStudent = isWarden(currentUser?.role);
  const canCreateStaff = isAdmin(currentUser?.role);
  const canDeleteStudent = isWarden(currentUser?.role);

  // Reset page when search or college changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, collegeFilter]);

  // Fetch Colleges for filter
  const { data: colleges = [] } = useQuery<College[]>({
    queryKey: ['colleges'],
    queryFn: async () => {
      const res = await api.get('/colleges/colleges/');
      return res.data.results || res.data;
    }
  });

  // Data for Tenants (Students)
  const { data: tenantData, isLoading: isTenantsLoading } = useQuery({
    queryKey: ['tenants', page, debouncedSearch, studentStatusFilter, collegeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (studentStatusFilter === 'active') params.append('user__is_active', 'true');
      if (studentStatusFilter === 'inactive') params.append('user__is_active', 'false');
      if (collegeFilter !== 'all') params.append('user__college', collegeFilter);
      
      const response = await api.get(`/users/tenants/?${params.toString()}`);
      return response.data;
    },
     placeholderData: (previousData) => previousData,
  });

  const tenants: Tenant[] = tenantData?.results || (Array.isArray(tenantData) ? tenantData : []);
  
  // Data for All Users (Staff/Admin)
  const { data: usersData } = useQuery({
    queryKey: ['users', staffStatusFilter, collegeFilter],
    queryFn: async () => {
        const params = new URLSearchParams();
        if (staffStatusFilter === 'active') params.append('is_active', 'true');
        if (staffStatusFilter === 'inactive') params.append('is_active', 'false');
        if (collegeFilter !== 'all') params.append('college', collegeFilter);
        
        const response = await api.get(`/auth/users/?${params.toString()}`);
        return response.data;
    },
  });
  
  const staffUsers = usersData?.results 
    ? usersData.results.filter((u: User) => u.role !== 'student') 
    : (Array.isArray(usersData) ? usersData.filter((u: User) => u.role !== 'student') : []);

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

  const toggleParentInformed = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: boolean }) => {
      const res = await api.patch(`/users/tenants/${id}/`, { parent_informed: status });
      return res.data;
    },
    onMutate: async ({ id, status }) => {
      const queryKey = ['tenants', page, debouncedSearch, studentStatusFilter, collegeFilter];
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: { results?: Tenant[] } | undefined) => {
        if (!old || !old.results) return old;
        return {
          ...old,
          results: old.results.map((t: Tenant) => 
            t.id === id ? { ...t, parent_informed: status } : t
          )
        };
      });
      return { prev };
    },
    onSuccess: () => {
      toast.success('Parent notification status updated');
    },
    onError: (err, _, ctx) => {
      if (ctx?.prev) {
        const queryKey = ['tenants', page, debouncedSearch, studentStatusFilter, collegeFilter];
        queryClient.setQueryData(queryKey, ctx.prev);
      }
      toast.error(getApiErrorMessage(err, 'Failed to update status'));
    }
  });

  const approveUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.patch(`/auth/users/${id}/`, { is_approved: true, is_active: true });
      return res.data;
    },
    onSuccess: () => {
      toast.success('User approved and activated');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to approve user'));
    }
  });

  const toggleHrMutation = useMutation({
      mutationFn: async ({ id, status }: { id: number; status: boolean }) => {
          return api.post(`/users/tenants/${id}/toggle_hr/`, { status });
      },
      onMutate: async ({ id, status }) => {
          const queryKey = ['tenants', page, debouncedSearch, studentStatusFilter, collegeFilter];
          await queryClient.cancelQueries({ queryKey });
          const previousTenants = queryClient.getQueryData(queryKey);
          
           queryClient.setQueryData(queryKey, (old: { results?: Tenant[] } | undefined) => {
               if (!old || !old.results) return old;
               return {
                   ...old,
                   results: old.results.map((t: Tenant) => 
                       t.id === id ? { ...t, user: { ...t.user, is_student_hr: status } } : t
                   )
               };
           });
          
          return { previousTenants };
      },
      onSuccess: (res) => {
          toast.success(res.data.detail);
      },
      onError: (err: unknown, _, context) => {
           const queryKey = ['tenants', page, debouncedSearch, studentStatusFilter, collegeFilter];
           if (context?.previousTenants) {
               queryClient.setQueryData(queryKey, context.previousTenants);
           }
           toast.error(getApiErrorMessage(err, 'Failed to update HR status'));
      },
      onSettled: () => {
          queryClient.invalidateQueries({ queryKey: ['tenants'] });
      }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          uploadMutation.mutate(e.target.files[0]);
      }
  };

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/auth/users/${id}/`),
    onSuccess: () => {
      toast.success('User deleted');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to delete user'))
  });

  const toggleUserActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => 
      api.patch(`/auth/users/${id}/`, { is_active: !is_active }),
    onMutate: async ({ id, is_active }) => {
        const studentKey = ['tenants', page, debouncedSearch, studentStatusFilter, collegeFilter];
        const staffKey = ['users', staffStatusFilter, collegeFilter];
        
        // Optimistic update for BOTH students and staff lists
        await queryClient.cancelQueries({ queryKey: studentKey });
        await queryClient.cancelQueries({ queryKey: staffKey });
        
        const previousTenants = queryClient.getQueryData(studentKey);
        const previousUsers = queryClient.getQueryData(staffKey);
        
        // Update Tenants list
        queryClient.setQueryData(studentKey, (old: { results?: Tenant[] } | undefined) => {
            if (!old || !old.results) return old;
            return {
                ...old,
                results: old.results.map((t: Tenant) => 
                    t.user.id === id ? { ...t, user: { ...t.user, is_active: !is_active } } : t
                )
            };
        });
        
        // Update Staff list
        queryClient.setQueryData(staffKey, (old: { results?: User[] } | User[] | undefined) => {
            if (!old) return old;
            const updateFunc = (u: User) => u.id === id ? { ...u, is_active: !is_active } : u;
            if (old && 'results' in old && old.results) {
                return { ...old, results: old.results.map(updateFunc) };
            }
            if (Array.isArray(old)) {
                return old.map(updateFunc);
            }
            return old;
        });

        return { previousTenants, previousUsers };
    },
    onSuccess: () => {
      toast.success('User status updated');
    },
    onError: (err, _, context) => {
      const studentKey = ['tenants', page, debouncedSearch, studentStatusFilter];
      const staffKey = ['users', staffStatusFilter];
      if (context?.previousTenants) queryClient.setQueryData(studentKey, context.previousTenants);
      if (context?.previousUsers) queryClient.setQueryData(staffKey, context.previousUsers);
      toast.error(getApiErrorMessage(err, 'Failed to update user status'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    }
  });

  const canManageTarget = (targetRole: string, targetId: number) => {
    if (!currentUser) return false;
    if (currentUser.id === targetId) return true; // Can always edit self (theoretically)
    
    const isRoot = currentUser.role === 'super_admin';
    if (isRoot) return true; // Super Admin can manage anyone
    
    const isTopLevel = isTopLevelManagement(currentUser.role);
    if (isTopLevel && currentUser.role !== 'super_admin') {
        // Admins and Head Wardens can manage everything EXCEPT Admins or Super Admins
        // Note: Head Wardens can now manage Wardens too
        return !['admin', 'super_admin'].includes(targetRole);
    }

    const isWarden = currentUser.role === 'warden';
    if (isWarden) {
        // Regular Wardens can only manage students
        return targetRole === 'student';
    }
    
    return false;
  };

  // Real-time zero-refresh patching for user updates
  useWebSocketEvent('user_updated', (data: { id: number; is_active?: boolean; role?: string }) => {
    const { id, is_active, role } = data;
    if (!id) return;

    // 1. Patch tenants list (Students)
    const tenantKey = ['tenants', page, debouncedSearch, studentStatusFilter, collegeFilter];
    queryClient.setQueryData(tenantKey, (old: { results?: Tenant[] } | undefined) => {
        if (!old || !old.results) return old;
        return {
            ...old,
            results: old.results.map((t: Tenant) => 
                t.user.id === id ? { ...t, user: { ...t.user, is_active: is_active ?? t.user.is_active, role: role ?? t.user.role } } : t
            )
        };
    });

    // 2. Patch staff list
    const staffKey = ['users', staffStatusFilter, collegeFilter];
    queryClient.setQueryData(staffKey, (old: { results?: User[] } | User[] | undefined) => {
        if (!old) return old;
        const updateFunc = (u: User) => u.id === id ? { ...u, is_active: is_active ?? u.is_active, role: role ?? u.role } : u;
        if (old && 'results' in old && old.results) {
            return { ...old, results: old.results.map(updateFunc) };
        }
        if (Array.isArray(old)) {
            return old.map(updateFunc);
        }
        return old;
    });
  }, [page, debouncedSearch, studentStatusFilter, staffStatusFilter]);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
              <h1 className="text-3xl font-black flex items-center gap-2 text-foreground tracking-tight">
                <div className="p-2 bg-blue-100 rounded-2xl text-blue-600">
                    <Users className="h-6 w-6" />
                </div>
                User Management
              </h1>
              <p className="text-muted-foreground font-medium pl-1">Manage students, staff, and system users</p>
          </div>
        </div>
      
      <Tabs defaultValue="students" className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
             <TabsList className="bg-white p-1 rounded-2xl shadow-sm ring-1 ring-black/5 w-full sm:w-auto">
                <TabsTrigger value="students" className="rounded-xl flex-1 sm:flex-none">Students</TabsTrigger>
                <TabsTrigger value="staff" className="rounded-xl flex-1 sm:flex-none">Staff & Admins</TabsTrigger>
             </TabsList>
        </div>

        {/* STUDENTS TAB */}
        <TabsContent value="students" className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white/50 p-4 rounded-3xl border border-white shadow-xl backdrop-blur-md">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                    placeholder="Search by name, hall ticket..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 rounded-2xl border-0 bg-white shadow-sm ring-1 ring-black/5 h-12 text-base focus-visible:ring-primary"
                    />
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  {/* College Filter */}
                  <div className="min-w-[180px]">
                      <Select value={collegeFilter} onValueChange={setCollegeFilter}>
                          <SelectTrigger className="rounded-2xl border-0 bg-white shadow-sm ring-1 ring-black/5 h-12 px-4 focus:ring-primary">
                              <div className="flex items-center gap-2">
                                  <School className="h-4 w-4 text-primary" />
                                  <SelectValue placeholder="All Colleges" />
                              </div>
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl shadow-xl border-0">
                              <SelectItem value="all" className="rounded-xl my-1 mx-1">All Colleges</SelectItem>
                              {colleges.map((college) => (
                                  <SelectItem key={college.id} value={college.id.toString()} className="rounded-xl my-1 mx-1">
                                      {college.name}
                                  </SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>

                  <div className="flex bg-gray-50/50 rounded-2xl p-1.5 shadow-inner ring-1 ring-black/5 overflow-x-auto no-scrollbar">
                      {(['all', 'active', 'inactive'] as const).map((status) => (
                          <button
                              key={status}
                              onClick={() => setStudentStatusFilter(status)}
                              className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap ${
                                  studentStatusFilter === status 
                                  ? 'bg-white text-primary shadow-sm' 
                                  : 'text-muted-foreground hover:bg-gray-100/50 uppercase'
                              }`}
                          >
                              {status === 'active' ? '● Active' : status === 'inactive' ? '○ Inactive' : 'All Students'}
                          </button>
                      ))}
                  </div>

                  <div className="flex gap-2">
                      {canCreateStudent && (
                          <>
                              <input 
                                  type="file" 
                                  ref={fileInputRef} 
                                  className="hidden" 
                                  accept=".csv" 
                                  onChange={handleFileUpload}
                              />
                              <Button
                              variant="outline"
                              size="icon"
                              className="w-12 h-12 rounded-2xl border-0 shadow-sm bg-white font-bold hover:bg-gray-50 text-foreground group relative"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadMutation.isPending}
                              title="Bulk CSV Upload"
                              >
                                  <Upload className="h-5 w-5 group-hover:scale-110 transition-transform" />
                              </Button>
                              <Button onClick={() => setIsAddStudentOpen(true)} className="flex-1 h-12 px-6 rounded-2xl primary-gradient text-white font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
                                  <Plus className="h-5 w-5 mr-2" /> Student
                              </Button>
                          </>
                      )}
                  </div>
                </div>
            </div>

            <Card className="rounded-3xl border-0 shadow-sm overflow-hidden bg-white">
                <CardContent className="p-0">
                {isTenantsLoading ? (
                    <div className="p-6 space-y-4">
                         <Skeleton className="h-10 w-full" />
                         <Skeleton className="h-10 w-full" />
                         <Skeleton className="h-10 w-full" />
                    </div>
                ) : tenants.length > 0 ? (
                    <div className="overflow-x-auto">
                        {/* Desktop Table */}
                        <div className="hidden md:block">
                            <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead>Student</TableHead>
                                <TableHead>Room</TableHead>
                                <TableHead>College</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Address</TableHead>
                                <TableHead>Status</TableHead>
                                {isWarden(currentUser?.role || '') && <TableHead>Communication</TableHead>}
                                { (canElectHR || canEditStudent || canManageUsers) && <TableHead className="w-12"></TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tenants.map((tenant) => (
                                <TableRow key={tenant.id} className={!tenant.user.is_active ? 'opacity-50' : ''}>
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
                                    <TableCell>
                                        <div className="font-bold flex items-center gap-2">
                                            {tenant.room_number ? (
                                                <Badge className="bg-primary/10 text-primary border-primary/20 shadow-sm rounded-lg hover:bg-primary/20">Rm {tenant.room_number}</Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Unassigned</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <Badge variant="outline" className="rounded-lg border-0 bg-primary/10 text-primary font-bold w-fit">
                                                {tenant.user.college_code || 'N/A'}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[120px]">
                                                {tenant.user.college_name}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {tenant.user?.phone || '—'}
                                        <div className="text-xs text-muted-foreground">Parent: {tenant.father_phone || '-'}</div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                                    {tenant.city || tenant.address || '—'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <Badge className={`rounded-xl border-0 font-bold w-fit ${tenant.user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {tenant.user.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                            {!tenant.user.is_approved && (
                                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] font-black rounded-md px-1.5 h-4 w-fit">PENDING APPROVAL</Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                     {isWarden(currentUser?.role || "") && (
                                         <TableCell>
                                             <div className="flex items-center gap-2">
                                                 {tenant.parent_informed ? (
                                                     <Badge className="bg-emerald-100 text-emerald-700 border-0 rounded-lg text-[10px] h-6 font-bold px-2">YES</Badge>
                                                 ) : (
                                                     <Button 
                                                        size="sm" 
                                                        variant="outline" 
                                                        onClick={() => toggleParentInformed.mutate({ id: tenant.id, status: true })}
                                                        disabled={toggleParentInformed.isPending}
                                                        className="h-7 rounded-lg text-[10px] font-bold border-dashed hover:border-solid transition-all"
                                                     >
                                                         {toggleParentInformed.isPending ? "..." : "Mark Informed"}
                                                     </Button>
                                                 )}
                                             </div>
                                         </TableCell>
                                     )}
                                     { (canElectHR || canEditStudent || canManageUsers) && (
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="rounded-2xl shadow-xl border-0 p-2 min-w-[180px]">
                                                    {!tenant.user.is_approved && isWarden(currentUser?.role || '') && (
                                                        <DropdownMenuItem 
                                                            onClick={() => approveUserMutation.mutate(tenant.user.id)}
                                                            className="rounded-xl cursor-pointer py-2.5 text-emerald-600 font-bold bg-emerald-50 focus:bg-emerald-100 mb-1"
                                                        >
                                                            <BadgeCheck className="mr-2 h-4 w-4" /> Approve User
                                                        </DropdownMenuItem>
                                                    )}
                                                    {canEditStudent && (
                                                        <DropdownMenuItem 
                                                            onClick={() => setEditingTenant(tenant)}
                                                            className="rounded-xl cursor-pointer py-2.5"
                                                        >
                                                            <Edit className="mr-2 h-4 w-4" /> Edit Details
                                                        </DropdownMenuItem>
                                                    )}
                                                    
                                                    {canManageTarget(tenant.user.role, tenant.user.id) && (
                                                        <DropdownMenuItem 
                                                            onClick={() => toggleUserActiveMutation.mutate({ id: tenant.user.id, is_active: tenant.user.is_active })}
                                                            className="cursor-pointer font-bold"
                                                        >
                                                            {tenant.user.is_active ? (
                                                                <span className="text-red-500 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Deactivate User</span>
                                                            ) : (
                                                                <span className="text-green-600 flex items-center gap-2"><BadgeCheck className="w-4 h-4" /> Activate User</span>
                                                            )}
                                                        </DropdownMenuItem>
                                                    )}
                                                    
                                                    {canElectHR && (
                                                        <>
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
                                                        </>
                                                    )}
                                                    
                                                    {canDeleteStudent && canManageTarget(tenant.user.role, tenant.user.id) && tenant.user.id !== currentUser?.id && (
                                                        <DropdownMenuItem 
                                                            className="text-red-600 focus:text-red-600 cursor-pointer font-bold"
                                                            onClick={() => {
                                                                if (window.confirm(`Are you sure you want to delete student ${tenant.user?.name || tenant.user?.username}? This action cannot be undone.`)) {
                                                                    deleteUserMutation.mutate(tenant.user.id);
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Delete Student
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
                        
                         {/* Mobile Card List */}
                         <div className="md:hidden flex flex-col gap-4 p-4 bg-muted/5">
                              {tenants.map((tenant) => (
                                  <Card key={tenant.id} className="rounded-3xl border border-black/5 shadow-sm overflow-hidden bg-white active:scale-[0.98] transition-transform">
                                      <CardContent className="p-5">
                                          <div className="flex justify-between items-start mb-4">
                                              <div className="flex-1 min-w-0">
                                                  <div className="flex items-center flex-wrap gap-2">
                                                     <h4 className="font-black text-lg text-foreground truncate max-w-[150px]">{tenant.user?.name || 'Unnamed'}</h4>
                                                     {tenant.user?.is_student_hr && (
                                                         <Badge className="bg-primary text-white text-[10px] h-5 px-2 font-black rounded-lg">HR</Badge>
                                                     )}
                                                     {!tenant.user?.is_approved && (
                                                         <Badge className="bg-amber-100 text-amber-700 text-[10px] h-5 px-2 font-black rounded-lg border-amber-200">Pending</Badge>
                                                     )}
                                                  </div>
                                                  <p className="text-xs text-muted-foreground font-black tracking-widest uppercase mt-0.5 opacity-60">{tenant.user?.hall_ticket || tenant.user?.username}</p>
                                              </div>
                                          {isWarden(currentUser?.role || '') && (
                                         <TableCell>
                                             <div className="flex items-center gap-2">
                                                 {tenant.parent_informed ? (
                                                     <Badge className="bg-emerald-100 text-emerald-700 border-0 rounded-lg text-[10px] h-6 font-bold px-2">YES</Badge>
                                                 ) : (
                                                     <Button 
                                                        size="sm" 
                                                        variant="outline" 
                                                        onClick={() => toggleParentInformed.mutate({ id: tenant.id, status: true })}
                                                        disabled={toggleParentInformed.isPending}
                                                        className="h-7 rounded-lg text-[10px] font-bold border-dashed hover:border-solid transition-all"
                                                     >
                                                         {toggleParentInformed.isPending ? '...' : 'Mark Informed'}
                                                     </Button>
                                                 )}
                                             </div>
                                         </TableCell>
                                     )}
                                     { (canElectHR || canEditStudent || canManageUsers) && (
                                                 <DropdownMenu>
                                                     <DropdownMenuTrigger asChild>
                                                         <Button variant="ghost" size="icon" className="h-10 w-10 -mr-2 -mt-2 rounded-2xl bg-gray-50 flex-shrink-0">
                                                             <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                                                         </Button>
                                                     </DropdownMenuTrigger>
                                                     <DropdownMenuContent align="end" className="rounded-3xl shadow-2xl border-0 p-2 min-w-[200px]">
                                                         {!tenant.user?.is_approved && isWarden(currentUser?.role || '') && (
                                                              <DropdownMenuItem 
                                                                  onClick={() => approveUserMutation.mutate(tenant.user.id)}
                                                                  className="rounded-2xl cursor-pointer py-3 text-emerald-600 font-black mb-1 bg-emerald-50 focus:bg-emerald-100"
                                                              >
                                                                  <BadgeCheck className="mr-3 h-5 w-5" /> Approve & Activate
                                                              </DropdownMenuItem>
                                                         )}

                                                         {canEditStudent && (
                                                             <DropdownMenuItem onClick={() => setEditingTenant(tenant)} className="rounded-2xl cursor-pointer py-3 font-bold mb-1">
                                                                 <Edit className="mr-3 h-5 w-5" /> Edit Details
                                                             </DropdownMenuItem>
                                                         )}
                                                         
                                                         {canManageTarget(tenant.user.role, tenant.user.id) && (
                                                             <DropdownMenuItem 
                                                                 onClick={() => toggleUserActiveMutation.mutate({ id: tenant.user.id, is_active: tenant.user.is_active })}
                                                                 className="rounded-2xl cursor-pointer font-bold py-3 mb-1"
                                                             >
                                                                 {tenant.user.is_active ? (
                                                                     <span className="text-red-500 flex items-center gap-3"><ShieldAlert className="w-5 h-5" /> Deactivate User</span>
                                                                 ) : (
                                                                     <span className="text-emerald-600 flex items-center gap-3"><BadgeCheck className="w-5 h-5" /> Activate User</span>
                                                                 )}
                                                             </DropdownMenuItem>
                                                         )}
                                                         
                                                         {/* ... rest of dropdown items ... */}
                                                     </DropdownMenuContent>
                                                 </DropdownMenu>
                                              )}
                                          </div>

                                          {/* Stats Grid */}
                                          <div className="grid grid-cols-2 gap-3 mb-4">
                                              <div className="bg-primary/5 p-3 rounded-2xl border border-primary/10 flex flex-col justify-center min-w-0">
                                                  <span className="text-primary/60 font-black block text-[9px] uppercase tracking-wider mb-1">College</span>
                                                  <span className="text-primary font-black text-sm truncate">{tenant.user.college_code || 'N/A'}</span>
                                                  {tenant.user.college_name && (
                                                      <span className="text-[9px] text-primary/40 block truncate leading-tight mt-0.5">{tenant.user.college_name}</span>
                                                  )}
                                              </div>
                                              <div className="bg-black/5 p-3 rounded-2xl border border-black/5 flex flex-col justify-center min-w-0">
                                                  <span className="text-black/40 font-black block text-[9px] uppercase tracking-wider mb-1">Location</span>
                                                  <span className="text-black/80 font-black text-sm truncate">{tenant.room_number ? `Rm ${tenant.room_number}` : 'Unassigned'}</span>
                                              </div>
                                          </div>

                                          <div className="flex items-center justify-between mb-4">
                                              <div className="flex flex-col">
                                                 <span className="text-muted-foreground font-black text-[9px] uppercase tracking-wider mb-1">Contact</span>
                                                 <span className="text-foreground font-black text-sm">{tenant.user?.phone || '—'}</span>
                                              </div>
                                              <Badge className={`rounded-xl px-4 py-1.5 font-black text-[10px] border-0 shadow-sm transition-all ${tenant.user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                 {tenant.user.is_active ? 'Active' : 'Inactive'}
                                              </Badge>
                                          </div>

                                          {/* Parent Notification Logic - Warden Only */}
                                          {isWarden(currentUser?.role || '') && (
                                              <div className="mt-2 pt-4 border-t border-dashed border-black/5">
                                                  <div className="bg-gray-50/80 p-4 rounded-2xl flex flex-col gap-3">
                                                      <div className="flex items-center justify-between">
                                                          <div>
                                                              <h5 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 mb-0.5">Communication</h5>
                                                              <p className="text-xs font-bold text-foreground">Informed to parent?</p>
                                                          </div>
                                                          {tenant.parent_informed ? (
                                                              <Badge className="bg-emerald-500 text-white rounded-lg px-2 py-0.5 text-[9px] font-black animate-in fade-in zoom-in duration-300">
                                                                  YES
                                                              </Badge>
                                                          ) : (
                                                              <Badge className="bg-gray-200 text-gray-500 rounded-lg px-2 py-0.5 text-[9px] font-black">
                                                                  NO
                                                              </Badge>
                                                          )}
                                                      </div>
                                                      
                                                      {!tenant.parent_informed && (
                                                          <Button 
                                                              size="sm" 
                                                              onClick={() => toggleParentInformed.mutate({ id: tenant.id, status: true })}
                                                              disabled={toggleParentInformed.isPending}
                                                              className="w-full h-10 rounded-xl bg-primary text-white font-black text-[10px] uppercase tracking-widest shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 ease-out"
                                                          >
                                                              {toggleParentInformed.isPending ? 'Updating...' : 'Mark as Informed'}
                                                          </Button>
                                                      )}
                                                  </div>
                                              </div>
                                          )}
                                      </CardContent>
                                  </Card>
                              ))}
                         </div>
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

        {/* STAFF TAB - Refactored to Cards */}
        <TabsContent value="staff" className="space-y-6">
             <div className="flex justify-end p-1">
                   {canCreateStaff && (
                       <div className="flex items-center gap-4">
                            <div className="flex bg-white rounded-xl p-1 shadow-sm ring-1 ring-black/5">
                                {(['all', 'active', 'inactive'] as const).map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => setStaffStatusFilter(status)}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                            staffStatusFilter === status 
                                            ? 'bg-black text-white' 
                                            : 'text-muted-foreground hover:bg-gray-100'
                                        }`}
                                    >
                                        {status.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                            <Button onClick={() => setIsAddUserOpen(true)} className="rounded-xl primary-gradient text-white font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
                                <Plus className="h-4 w-4 mr-2" /> Add Staff/User
                            </Button>
                       </div>
                  )}
             </div>
             
             {Object.entries(
                staffUsers.reduce((acc: Record<string, User[]>, u: User) => {
                    const role = u.role;
                    if (!acc[role]) acc[role] = [];
                    acc[role].push(u);
                    return acc;
                }, {} as Record<string, User[]>)
             ).sort().map(([role, users]: [string, User[]]) => (
                <div key={role} className="space-y-4">
                    <div className="flex items-center gap-3 px-2">
                        <div className="h-8 w-1 rounded-full bg-primary" />
                        <h3 className="text-lg font-black uppercase tracking-tight text-foreground">
                            {role.replace('_', ' ')} <span className="text-muted-foreground text-sm font-bold ml-2 bg-neutral-100 px-2 py-0.5 rounded-full">{users.length}</span>
                        </h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         {users.map((u: User) => (
                             <Card key={u.id} className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden hover:shadow-md transition-all group">
                                 <CardContent className="p-5 flex flex-col gap-4">
                                     <div className="flex justify-between items-start">
                                         <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 font-bold text-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                             {u.name ? u.name.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                                         </div>
                                         <Badge className={`rounded-full px-3 font-bold border-0 ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {u.is_active ? 'Active' : 'Inactive'}
                                         </Badge>
                                     </div>
                                     
                                     <div>
                                         <h4 className="font-bold text-lg text-foreground truncate">{u.name || 'Unnamed User'}</h4>
                                         <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                                               @ {u.username}
                                            </p>
                                            {u.college_code && (
                                                <Badge variant="outline" className="text-[8px] h-4 rounded-md border-primary/10 bg-primary/5 text-primary">
                                                    {u.college_code}
                                                </Badge>
                                            )}
                                         </div>
                                     </div>
                                     
                                     <div className="pt-4 border-t border-dashed border-gray-100 flex flex-col gap-1 text-xs font-semibold text-muted-foreground/80">
                                          <div className="flex justify-between">
                                              <span>Phone</span>
                                              <span className="text-foreground">{u.phone || '—'}</span>
                                          </div>
                                          {u.email && (
                                              <div className="flex justify-between">
                                                  <span>Email</span>
                                                  <span className="text-foreground truncate max-w-[150px]">{u.email}</span>
                                              </div>
                                          )}
                                          
                                          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                                               <div className="flex gap-2">
                                                   {canManageTarget(u.role, u.id) && u.id !== currentUser?.id && (
                                                       <>
                                                           <Button 
                                                               variant="outline" 
                                                               size="sm" 
                                                               className="h-8 rounded-lg text-[10px] font-bold"
                                                               onClick={() => toggleUserActiveMutation.mutate({ id: u.id, is_active: u.is_active })}
                                                           >
                                                               {u.is_active ? 'Deactivate' : 'Activate'}
                                                           </Button>
                                                           {currentUser?.role === 'super_admin' && (
                                                               <Button 
                                                                   variant="ghost" 
                                                                   size="sm" 
                                                                   className="h-8 rounded-lg text-[10px] font-bold text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                   onClick={() => {
                                                                       if (window.confirm('Are you sure you want to delete this user?')) {
                                                                           deleteUserMutation.mutate(u.id);
                                                                       }
                                                                   }}
                                                               >
                                                                   Delete
                                                               </Button>
                                                           )}
                                                       </>
                                                   )}
                                               </div>
                                               <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => toast.info('Edit user coming soon')}>
                                                   <Edit className="h-3.5 w-3.5" />
                                               </Button>
                                          </div>
                                     </div>
                                 </CardContent>
                             </Card>
                         ))}
                    </div>
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
      
      {editingTenant && (
          <EditStudentDialog 
            open={!!editingTenant} 
            onOpenChange={(open) => !open && setEditingTenant(null)} 
            tenant={editingTenant}
          />
      )}
      
    </div>
  );
}
