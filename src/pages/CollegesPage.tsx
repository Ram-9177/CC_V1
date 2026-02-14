import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

interface College {
  id: number;
  name: string;
  code: string;
  city: string;
  state: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  created_at: string;
}

export default function CollegesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    city: '',
    state: '',
    contact_email: '',
    contact_phone: '',
    website: '',
  });

  const user = useAuthStore((state) => state.user);
  const isAdmin = ['admin', 'super_admin'].includes(user?.role || '');
  const queryClient = useQueryClient();

  const { data: colleges, isLoading } = useQuery<College[]>({
    queryKey: ['colleges'],
    queryFn: async () => {
      const response = await api.get('/colleges/colleges/');
      return response.data.results || response.data;
    },
  });

  const filteredColleges = useMemo(() => {
    if (!colleges) return [];
    if (!searchQuery) return colleges;
    const term = searchQuery.toLowerCase();
    return colleges.filter((college) =>
      [college.name, college.code, college.city, college.state].some((value) =>
        value?.toLowerCase().includes(term)
      )
    );
  }, [colleges, searchQuery]);

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/colleges/colleges/', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colleges'] });
      toast.success('College created successfully');
      setCreateDialogOpen(false);
      setFormData({
        name: '',
        code: '',
        city: '',
        state: '',
        contact_email: '',
        contact_phone: '',
        website: '',
      });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to create college'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/colleges/colleges/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colleges'] });
      toast.success('College deleted');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete college'));
    },
  });

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2 text-foreground">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              Colleges
            </h1>
            <p className="text-muted-foreground">Manage affiliated colleges</p>
          </div>
        {isAdmin && (
          <Button onClick={() => setCreateDialogOpen(true)} className="primary-gradient text-white font-semibold hover:opacity-90 smooth-transition">
            <Plus className="h-4 w-4 mr-2" />
            Add College
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-none lg:border shadow-none lg:shadow-sm bg-transparent lg:bg-card overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border-b">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-28" />
                  <div className="flex-1" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : filteredColleges.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Contact</TableHead>
                      {isAdmin && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredColleges.map((college) => (
                      <TableRow key={college.id}>
                        <TableCell className="font-medium">{college.name}</TableCell>
                        <TableCell>{college.code}</TableCell>
                        <TableCell>{college.city}</TableCell>
                        <TableCell>{college.state}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div>{college.contact_email || '—'}</div>
                          <div>{college.contact_phone || ''}</div>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteMutation.mutate(college.id)}
                              disabled={deleteMutation.isPending}
                              className="text-black border-black font-bold hover:bg-black hover:text-white"
                            >
                              Delete
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List View */}
              <div className="lg:hidden space-y-4">
                {filteredColleges.map((college) => (
                  <Card key={college.id} className="overflow-hidden border shadow-sm rounded-2xl bg-card">
                    <CardHeader className="p-4 bg-muted/20 border-b">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-base leading-tight truncate">
                            {college.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-1">
                            {college.city}{college.state ? `, ${college.state}` : ''}
                          </div>
                        </div>
                        <Badge
                          className="bg-primary text-foreground border-0 font-bold font-mono"
                        >
                          {college.code}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div className="grid grid-cols-1 gap-3 text-xs">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                            Contact
                          </p>
                          <div className="text-muted-foreground">
                            <div className="truncate">{college.contact_email || '—'}</div>
                            <div>{college.contact_phone || '—'}</div>
                          </div>
                        </div>

                        {college.website ? (
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                              Website
                            </p>
                            <div className="text-muted-foreground truncate">{college.website}</div>
                          </div>
                        ) : null}
                      </div>

                      {isAdmin ? (
                        <div className="pt-2 border-t border-muted/50">
                          <Button
                            variant="outline"
                            className="w-full text-foreground border-black font-bold hover:bg-black hover:text-white"
                            onClick={() => deleteMutation.mutate(college.id)}
                            disabled={deleteMutation.isPending}
                          >
                            Delete College
                          </Button>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={Building2}
              title="No colleges found"
              description={searchQuery ? "Try adjusting your search criteria" : "No colleges have been registered yet"}
              variant="default"
              action={
                isAdmin ? (
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First College
                  </Button>
                ) : undefined
              }
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add College</DialogTitle>
            <DialogDescription>Register a new college.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Contact Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <Input
                    id="contact_phone"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending} className="primary-gradient text-white font-semibold hover:opacity-90 smooth-transition">
                Save College
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
