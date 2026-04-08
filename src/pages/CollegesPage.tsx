import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Search, Power, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ListSkeleton } from '@/components/common/PageSkeleton';
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
import { DeleteConfirmation } from '@/components/common/DeleteConfirmation';

interface College {
  id: number;
  name: string;
  code: string;
  city: string;
  state: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  is_active: boolean;
  disabled_reason?: string;
  user_count?: number;
  created_at: string;
}

interface PlatformAnalytics {
  platform: {
    total_colleges: number;
    active_colleges: number;
    inactive_colleges: number;
    total_users: number;
    active_users: number;
    students: number;
    staff: number;
    gate_passes_today: number;
  };
  generated_at: string;
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
  const isSuperAdmin = user?.role === 'super_admin';
  const queryClient = useQueryClient();
  const [toggleTarget, setToggleTarget] = useState<College | null>(null);
  const [toggleReason, setToggleReason] = useState('');
  const [collegeToDelete, setCollegeToDelete] = useState<College | null>(null);

  const { data: colleges, isLoading } = useQuery<College[]>({
    queryKey: ['colleges'],
    queryFn: async () => {
      const response = await api.get('/colleges/colleges/');
      return response.data.results || response.data;
    },
  });

  const {
    data: platformAnalytics,
    isLoading: isPlatformAnalyticsLoading,
    isError: isPlatformAnalyticsError,
    error: platformAnalyticsError,
    refetch: refetchPlatformAnalytics,
  } = useQuery<PlatformAnalytics>({
    queryKey: ['platform-analytics'],
    enabled: isSuperAdmin,
    retry: 1,
    staleTime: 60_000,
    queryFn: async () => {
      const response = await api.get('/colleges/platform-analytics/');
      return response.data;
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

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      await api.post(`/colleges/colleges/${id}/toggle_active/`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colleges'] });
      const wasActive = toggleTarget?.is_active;
      toast.success(wasActive ? 'College has been disabled. All users are now locked out.' : 'College has been re-enabled. Users can access again.');
      setToggleTarget(null);
      setToggleReason('');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to toggle college status'));
    },
  });

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2 text-foreground">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-primary/5 rounded-sm border border-primary/10 shadow-sm">
                <img 
                  src="/pwa/icon.svg" 
                  alt="Logo" 
                  loading="lazy"
                  className="h-10 w-10 rounded-sm object-cover"
                />
              </div>
              <h1 className="text-3xl font-bold">Colleges</h1>
            </div>
            <p className="text-muted-foreground">Manage affiliated colleges</p>
          </div>
        {isSuperAdmin && (
          <Button onClick={() => setCreateDialogOpen(true)} className="bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/30 hover:shadow-md smooth-transition rounded-sm active:scale-95 transition-all">
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

      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Platform Snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            {isPlatformAnalyticsLoading ? (
              <ListSkeleton rows={1} />
            ) : isPlatformAnalyticsError ? (
              <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-medium text-destructive">
                  Could not load platform analytics.
                </p>
                <p className="text-xs text-muted-foreground">
                  {getApiErrorMessage(platformAnalyticsError, 'Check that you are signed in as super admin and the API is reachable.')}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => void refetchPlatformAnalytics()}>
                  Retry
                </Button>
              </div>
            ) : platformAnalytics ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Total Colleges</p>
                  <p className="text-2xl font-bold">{platformAnalytics.platform.total_colleges}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Active Colleges</p>
                  <p className="text-2xl font-bold">{platformAnalytics.platform.active_colleges}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{platformAnalytics.platform.total_users}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Passes Today</p>
                  <p className="text-2xl font-bold">{platformAnalytics.platform.gate_passes_today}</p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card className="border-none lg:border shadow-none lg:shadow-sm bg-transparent lg:bg-card overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <ListSkeleton rows={6} />
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
                      <TableHead>Status</TableHead>
                      <TableHead>Contact</TableHead>
                      {isSuperAdmin && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredColleges.map((college) => (
                      <TableRow key={college.id}>
                        <TableCell className="font-medium">{college.name}</TableCell>
                        <TableCell>{college.code}</TableCell>
                        <TableCell>{college.city}</TableCell>
                        <TableCell>{college.state}</TableCell>
                        <TableCell>
                          <Badge className={college.is_active 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-none font-bold'
                            : 'bg-red-50 text-red-700 border-red-200 shadow-none font-bold'
                          }>
                            {college.is_active ? '🟢 Active' : '🔴 Disabled'}
                          </Badge>
                          {college.user_count !== undefined && (
                            <span className="text-[10px] text-muted-foreground ml-2">{college.user_count} users</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div>{college.contact_email || '—'}</div>
                          <div>{college.contact_phone || ''}</div>
                        </TableCell>
                        {isSuperAdmin && (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setToggleTarget(college)}
                                className={college.is_active 
                                  ? 'text-red-600 border-red-200 hover:bg-red-50 font-bold'
                                  : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50 font-bold'
                                }
                              >
                                <Power className="h-3.5 w-3.5 mr-1" />
                                {college.is_active ? 'Disable' : 'Enable'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCollegeToDelete(college)}
                                disabled={deleteMutation.isPending}
                                className="text-black border-black font-bold hover:bg-black hover:text-white"
                              >
                                Delete
                              </Button>
                            </div>
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
                  <Card key={college.id} className="overflow-hidden border shadow-sm rounded-sm bg-card">
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
                          className={college.is_active 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-none font-bold'
                            : 'bg-red-50 text-red-700 border-red-200 shadow-none font-bold'
                          }
                        >
                          {college.is_active ? '🟢 Active' : '🔴 Disabled'}
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

                      {isSuperAdmin ? (
                        <div className="pt-2 border-t border-muted/50 space-y-2">
                          <Button
                            variant="outline"
                            className={`w-full font-bold ${college.is_active 
                              ? 'text-red-600 border-red-200 hover:bg-red-50'
                              : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                            }`}
                            onClick={() => setToggleTarget(college)}
                          >
                            <Power className="h-4 w-4 mr-2" />
                            {college.is_active ? 'Disable College' : 'Enable College'}
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full text-foreground border-black font-bold hover:bg-black hover:text-white"
                            onClick={() => setCollegeToDelete(college)}
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
                isSuperAdmin ? (
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

      {/* Toggle Active Confirmation Dialog */}
      <Dialog open={!!toggleTarget} onOpenChange={(open) => { if (!open) { setToggleTarget(null); setToggleReason(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {toggleTarget?.is_active ? (
                <><AlertTriangle className="h-5 w-5 text-red-500" /> Disable College</>
              ) : (
                <><Power className="h-5 w-5 text-emerald-500" /> Enable College</>
              )}
            </DialogTitle>
            <DialogDescription>
              {toggleTarget?.is_active
                ? `Disabling "${toggleTarget?.name}" will lock out ALL ${toggleTarget?.user_count || 0} users. They will see a disconnection message on login.`
                : `Re-enabling "${toggleTarget?.name}" will restore access for all users.`
              }
            </DialogDescription>
          </DialogHeader>
          {toggleTarget?.is_active && (
            <div className="space-y-2">
              <Label htmlFor="disable_reason">Reason (optional — shown to users)</Label>
              <Input
                id="disable_reason"
                placeholder="e.g. Scheduled maintenance, End of semester..."
                value={toggleReason}
                onChange={(e) => setToggleReason(e.target.value)}
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setToggleTarget(null); setToggleReason(''); }}>
              Cancel
            </Button>
            <Button
              onClick={() => toggleTarget && toggleActiveMutation.mutate({ id: toggleTarget.id, reason: toggleReason })}
              disabled={toggleActiveMutation.isPending}
              className={toggleTarget?.is_active
                ? 'bg-red-600 hover:bg-red-700 text-white font-bold'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold'
              }
            >
              {toggleActiveMutation.isPending ? 'Processing...' : (toggleTarget?.is_active ? 'Disable College' : 'Enable College')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmation
        isOpen={!!collegeToDelete}
        onClose={() => setCollegeToDelete(null)}
        onConfirm={() => {
          if (!collegeToDelete) return;
          deleteMutation.mutate(collegeToDelete.id, {
            onSuccess: () => setCollegeToDelete(null),
          });
        }}
        isLoading={deleteMutation.isPending}
        title="Delete College"
        description="This will permanently remove the college and unlink related references. This action cannot be undone."
        itemName={collegeToDelete?.name}
      />
    </div>
  );
}
