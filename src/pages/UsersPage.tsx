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

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Reset page when search changes
  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data: queryData, isLoading } = useQuery({
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

  const tenants: Tenant[] = queryData?.results || (Array.isArray(queryData) ? queryData : []);
  const totalCount = queryData?.count || 0;
  const hasNextPage = !!queryData?.next;

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
            Tenants
            </h1>
            <p className="text-muted-foreground">View tenant profiles and manage students</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
             <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".csv" 
                onChange={handleFileUpload}
             />
             <Button
               variant="outline"
               className="w-full sm:w-auto"
               onClick={() => fileInputRef.current?.click()}
               disabled={uploadMutation.isPending}
             >
                <Upload className="h-4 w-4 mr-2" />
                {uploadMutation.isPending ? 'Uploading...' : 'Bulk Upload CSV'}
             </Button>
             <Button className="w-full sm:w-auto" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Student
             </Button>
        </div>
      </div>

      <AddStudentDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, hall ticket, or registration number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border-b">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-36" />
                </div>
              ))}
            </div>
          ) : tenants.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>College</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Parent</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((tenant) => (
                      <TableRow key={tenant.id}>
                        <TableCell>
                          <div className="font-medium">{tenant.user?.name || tenant.user?.username}</div>
                          <div className="text-sm text-muted-foreground">
                            Hall Ticket: {tenant.user?.hall_ticket || tenant.user?.username}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Reg: {tenant.user?.registration_number || '—'}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <Badge variant="outline">{tenant.college_code || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div>{tenant.user?.phone || '—'}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div><span className="font-semibold text-xs">F:</span> {tenant.father_name || '—'} ({tenant.father_phone || '-'})</div>
                          {tenant.mother_name && <div><span className="font-semibold text-xs">M:</span> {tenant.mother_name} ({tenant.mother_phone || '-'})</div>}
                          {tenant.guardian_name && <div><span className="font-semibold text-xs">G:</span> {tenant.guardian_name} ({tenant.guardian_phone || '-'})</div>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div>{tenant.address || '—'}</div>
                          <div>{tenant.city || ''}{tenant.state ? `, ${tenant.state}` : ''}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(tenant.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List View */}
              <div className="lg:hidden space-y-4">
                {tenants.map((tenant) => (
                  <Card key={tenant.id} className="overflow-hidden border shadow-sm rounded-2xl bg-card">
                    <CardHeader className="p-4 bg-muted/20 border-b">
                       <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-base leading-tight">{tenant.user?.name || tenant.user?.username}</div>
                            <div className="text-[10px] text-muted-foreground font-mono mt-1">HT: {tenant.user?.hall_ticket || tenant.user?.username}</div>
                          </div>
                          <Badge variant="secondary" className="bg-card/80">{tenant.college_code || 'N/A'}</Badge>
                       </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                       <div className="grid grid-cols-2 gap-4 text-xs">
                          <div className="space-y-1">
                             <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Student Contact</p>
                             <div className="font-semibold">{tenant.user?.phone || 'No Phone'}</div>
                          </div>
                          <div className="space-y-1">
                             <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Parent Contact</p>
                             <div className="font-semibold">{tenant.father_phone || 'No Phone'}</div>
                             {tenant.father_name && <div className="text-[10px] text-muted-foreground">F: {tenant.father_name}</div>}
                             {tenant.mother_phone && <div className="text-[10px] mt-1">{tenant.mother_phone} (M: {tenant.mother_name})</div>}
                          </div>
                       </div>
                       
                       <div className="pt-2 border-t border-muted/50">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">Address</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                             {tenant.address || 'No Address Provided'}
                             {tenant.city && `, ${tenant.city}`}
                          </p>
                       </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={Users}
              title="No tenants found"
              description={searchQuery ? "Try adjusting your search criteria" : "No tenants have been added yet"}
              variant="default"
              action={
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Tenant
                </Button>
              }
            />
          )}
        </CardContent>
        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <div className="text-xs font-medium text-slate-500">
                Page {page} • {totalCount || 0} items
            </div>
            <div className="flex gap-2">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || isLoading}
                    className="h-8 px-3 text-xs"
                >
                    Previous
                </Button>
                <div className="flex items-center justify-center px-2 min-w-[2rem] text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded h-8">
                    {page}
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => p + 1)}
                    disabled={!hasNextPage || isLoading}
                    className="h-8 px-3 text-xs"
                >
                    Next
                </Button>
            </div>
        </div>
      </Card>
    </div>
  );
}
