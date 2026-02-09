import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, Upload, Plus } from 'lucide-react';
import { useDebounce } from '@/hooks/useCommon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { api } from '@/lib/api';
import { AddStudentDialog } from '@/components/modals/AddStudentDialog';

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
  };
}

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AddUserDialog } from '@/components/modals/AddUserDialog';

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

  // Reset page when search changes
  React.useEffect(() => {
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
  const tenantsCount = tenantData?.count || 0;
  
  // Data for All Users (Staff/Admin)
  const { data: usersData, isLoading: isUsersLoading } = useQuery({
    queryKey: ['users', page, debouncedSearch],
    queryFn: async () => {
        const response = await api.get('/users/');
        // Allow client-side filtering for simplicity if API doesn't support generic search yet
        // Ideally backend should support ?search= on /users/
        return response.data;
    },
  });
  
  // Filter out students from the general user list for the "Staff" tab
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
      onError: (err: any) => {
          toast.error(err.response?.data?.error || 'Upload failed');
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
            <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
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
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadMutation.isPending}
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        CSV Upload
                    </Button>
                    <Button onClick={() => setIsAddStudentOpen(true)}>
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
                            <TableHead>Parent</TableHead>
                            <TableHead>Address</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tenants.map((tenant) => (
                            <TableRow key={tenant.id}>
                                <TableCell>
                                <div className="font-medium">{tenant.user?.name || tenant.user?.username}</div>
                                <div className="text-sm text-muted-foreground">
                                    HT: {tenant.user?.hall_ticket || tenant.user?.username}
                                </div>
                                </TableCell>
                                <TableCell><Badge variant="outline">{tenant.college_code || 'N/A'}</Badge></TableCell>
                                <TableCell className="text-sm">{tenant.user?.phone || '—'}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                <div><span className="font-semibold text-xs">F:</span> {tenant.father_name || '—'} ({tenant.father_phone || '-'})</div>
                                {tenant.mother_name && <div><span className="font-semibold text-xs">M:</span> {tenant.mother_name} ({tenant.mother_phone || '-'})</div>}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                                {tenant.address || '—'}
                                </TableCell>
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
        <TabsContent value="staff" className="space-y-4">
             <div className="flex justify-end mb-4">
                 <Button onClick={() => setIsAddUserOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Add Staff/User
                 </Button>
             </div>
             
             <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Username</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {staffUsers.map((u: User) => (
                                <TableRow key={u.id}>
                                    <TableCell className="font-medium">{u.username}</TableCell>
                                    <TableCell><Badge>{u.role}</Badge></TableCell>
                                    <TableCell>{u.name || '-'}</TableCell>
                                    <TableCell>{u.phone || '-'}</TableCell>
                                    <TableCell>
                                        <Badge variant={u.is_active ? 'secondary' : 'destructive'}>
                                            {u.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {staffUsers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No staff users found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
             </Card>
        </TabsContent>
        
      </Tabs>

      <AddStudentDialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen} />
      <AddUserDialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen} />
      
    </div>
  );
}
