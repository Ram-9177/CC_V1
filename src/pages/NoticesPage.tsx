import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Plus, Pin, Calendar, User, X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { getApiErrorMessage, cn } from '@/lib/utils';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { SEO } from '@/components/common/SEO';
import { BrandedLoading } from '@/components/common/BrandedLoading';
import type { Notice, Building } from '@/types';

export default function NoticesPage() {
  useRealtimeQuery('notice_created', 'notices');
  useRealtimeQuery('notice_updated', 'notices');
  useRealtimeQuery('notice_deleted', 'notices');

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'medium',
    category: 'general',
    is_pinned: false,
    target_audience: 'all',
    target_building: undefined as string | undefined,
    external_link: '',
    image: null as File | null,
  });

  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const canManage = ['admin', 'super_admin', 'warden', 'head_warden', 'chef', 'head_chef'].includes(user?.role || '') || user?.is_student_hr;

  const { data: buildings } = useQuery<Building[]>({
    queryKey: ['buildings'],
    queryFn: async () => {
      const response = await api.get('/rooms/buildings/');
      return response.data.results || response.data;
    },
    enabled: canManage,
  });

  const { data: notices, isLoading } = useQuery<Notice[]>({
    queryKey: ['notices'],
    queryFn: async () => {
      const response = await api.get('/notices/notices/');
      return response.data.results || response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = new FormData();
      payload.append('title', formData.title);
      payload.append('content', formData.content);
      payload.append('priority', formData.priority);
      payload.append('category', formData.category);
      payload.append('is_pinned', String(formData.is_pinned));
      payload.append('target_audience', formData.target_audience);
      
      if (formData.target_building) {
        payload.append('target_building', formData.target_building);
      }
      if (formData.external_link) {
        payload.append('external_link', formData.external_link);
      }
      if (formData.image) {
        payload.append('image', formData.image);
      }

      await api.post('/notices/notices/', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      toast.success('Notice created successfully');
      setCreateDialogOpen(false);
      setFormData({
        title: '',
        content: '',
        priority: 'medium',
        category: 'general',
        is_pinned: false,
        target_audience: 'all',
        target_building: undefined,
        external_link: '',
        image: null,
      });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to create notice'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/notices/notices/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      toast.success('Notice deleted successfully');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete notice'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title?.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!formData.content?.trim()) {
      toast.error('Content is required');
      return;
    }
    
    if (formData.target_audience === 'block' && !formData.target_building) {
      toast.error('Building is required for block-specific notices');
      return;
    }
    
    createMutation.mutate();
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-black text-white border-0 font-bold">High Priority</Badge>;
      case 'medium':
        return <Badge className="bg-primary/20 text-black border border-primary/30 font-bold">Medium Priority</Badge>;
      case 'low':
        return <Badge className="bg-muted text-foreground border border-border font-bold">Low Priority</Badge>;
      default:
        return <Badge className="bg-muted text-foreground font-bold">{priority}</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      general: 'bg-primary/10 text-black border-primary/20 font-bold',
      academic: 'bg-secondary text-black border-border font-bold',
      hostel: 'bg-primary/20 text-black border-primary/30 font-bold',
      event: 'bg-muted text-black border-border font-bold',
      urgent: 'bg-black text-white border-0 font-bold',
    };
    return (
      <Badge className={colors[category] || 'bg-muted text-black border-border font-bold'}>
        {category.charAt(0).toUpperCase() + category.slice(1)}
      </Badge>
    );
  };

  const getAudienceBadge = (audience: string, buildingName?: string) => {
    if (audience === 'block') {
      return <Badge variant="outline" className="text-[10px] font-bold border-primary text-primary">Block: {buildingName || 'Specific'}</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px] font-bold capitalize">{audience}</Badge>;
  };

  // Sort notices: pinned first, then by created_at descending
  const sortedNotices = notices
    ?.slice()
    .sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const getNoticeTheme = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'from-red-500/10 to-transparent border-red-200';
      case 'high': return 'from-primary/10 to-transparent border-primary/20';
      case 'medium': return 'from-primary/10 to-transparent border-primary/20';
      default: return 'from-slate-500/5 to-transparent border-slate-200';
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <SEO 
        title="Notice Board" 
        description="Stay updated with the latest announcements, emergency alerts, and community notices from SMG Hostel management."
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold flex items-center gap-2 text-foreground">
              <Bell className="h-8 w-8" />
              Notice Board
            </h1>
            <p className="text-muted-foreground">Stay updated with the latest announcements</p>
          </div>
        {canManage && (
          <Button onClick={() => setCreateDialogOpen(true)} className="bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/30 hover:shadow-md smooth-transition rounded-lg active:scale-95 transition-all px-4 sm:px-6 h-10 sm:h-auto">
            <Plus className="h-4 w-4 mr-2" />
            Create Notice
          </Button>
        )}
      </div>

      {/* Notices List */}
      <div className="space-y-4">
        {isLoading ? (
          <BrandedLoading message="Fetching bulletin updates..." />
        ) : sortedNotices && sortedNotices.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
            {sortedNotices.map((notice: Notice) => (
              <Card
                key={notice.id}
                className={cn(
                  "group relative overflow-hidden rounded-3xl border transition-all duration-300 hover:shadow-2xl hover:-translate-y-1",
                  notice.is_pinned 
                    ? "border-primary shadow-lg shadow-primary/10 bg-gradient-to-br from-primary/5 to-white" 
                    : `bg-gradient-to-br ${getNoticeTheme(notice.priority)} bg-white shadow-xl shadow-black/5`
                )}
              >
                {notice.is_pinned && (
                  <div className="absolute top-0 left-0 w-full h-1 primary-gradient" />
                )}
                
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        {notice.is_pinned && (
                          <div className="bg-primary/20 p-1.5 rounded-lg">
                            <Pin className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <CardTitle className="text-xl font-black tracking-tight text-foreground group-hover:text-black transition-colors">
                          {notice.title}
                        </CardTitle>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        {getPriorityBadge(notice.priority)}
                        {getCategoryBadge(notice.category)}
                        {getAudienceBadge(notice.target_audience, notice.target_building_details?.name)}
                        {notice.is_pinned && (
                          <Badge className="bg-black text-white font-black uppercase tracking-tighter text-[10px] rounded-full px-3">Featured</Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 shrink-0">
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
                          onClick={() => deleteMutation.mutate(notice.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {notice.image && (
                    <div className="w-full h-48 sm:h-64 rounded-xl overflow-hidden mb-4 bg-muted/20">
                      <img src={notice.image} alt={notice.title} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground font-medium pr-4">
                    {notice.content}
                  </p>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t border-dashed border-border/60">
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5 bg-muted/30 px-2.5 py-1 rounded-full border border-border/50">
                        <User className="h-3 w-3" />
                        <span className="font-bold">
                          {notice.created_by.name} · <span className="uppercase tracking-tighter opacity-70">{notice.created_by.role}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        <span className="font-bold">{new Date(notice.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                       {notice.external_link && (
                          <Button
                            size="sm"
                            className="rounded-full px-6 font-black uppercase tracking-widest text-[10px] primary-gradient text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:scale-105 transition-all"
                            onClick={() => window.open(notice.external_link, '_blank')}
                          >
                            Open Link / Form
                          </Button>
                       )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Bell}
            title="No notices available"
            description="Check back later for updates and announcements"
            variant="info"
            action={
              canManage ? (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Notice
                </Button>
              ) : undefined
            }
          />
        )}
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-[2rem] text-black">
          <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-6 py-4 border-b">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                <Bell className="h-6 w-6 text-primary" />
                Create New Notice
              </DialogTitle>
              <DialogDescription className="font-medium">
                Publish a new announcement for the hostel community.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Title *</Label>
                <Input
                  id="title"
                  placeholder="Important: Water Supply Update"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary px-4 font-medium"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Content *</Label>
                <Textarea
                  id="content"
                  placeholder="Details of the announcement..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={5}
                  className="rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary p-4 font-medium min-h-[150px]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="audience" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Target Audience</Label>
                  <Select
                    value={formData.target_audience}
                    onValueChange={(value) => setFormData({ ...formData, target_audience: value, target_building: undefined })}
                  >
                    <SelectTrigger id="audience" className="h-12 rounded-2xl border-0 bg-gray-50 focus:ring-primary px-4 font-medium">
                      <SelectValue placeholder="Select audience" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-gray-100 shadow-2xl">
                      <SelectItem value="all" className="font-medium">Everyone</SelectItem>
                      <SelectItem value="students" className="font-medium">Students Only</SelectItem>
                      <SelectItem value="wardens" className="font-medium">Wardens Only</SelectItem>
                      <SelectItem value="chefs" className="font-medium">Chefs Only</SelectItem>
                      <SelectItem value="staff" className="font-medium">All Staff</SelectItem>
                      <SelectItem value="admins" className="font-medium">Administrative Team</SelectItem>
                      <SelectItem value="block" className="font-medium">Block-Specific</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.target_audience === 'block' && (
                  <div className="space-y-2">
                    <Label htmlFor="building" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Select Block/Building</Label>
                    <Select
                      value={formData.target_building}
                      onValueChange={(value) => setFormData({ ...formData, target_building: value })}
                    >
                      <SelectTrigger id="building" className="h-12 rounded-2xl border-0 bg-gray-50 focus:ring-primary px-4 font-medium">
                        <SelectValue placeholder="Select building" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-gray-100 shadow-2xl">
                        {buildings?.map((b: Building) => (
                          <SelectItem key={b.id} value={b.id.toString()} className="font-medium">{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="priority" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger id="priority" className="h-12 rounded-2xl border-0 bg-gray-50 focus:ring-primary px-4 font-medium">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-gray-100 shadow-2xl">
                      <SelectItem value="low" className="font-medium">Low</SelectItem>
                      <SelectItem value="medium" className="font-medium">Medium</SelectItem>
                      <SelectItem value="high" className="font-medium">High</SelectItem>
                      <SelectItem value="urgent" className="font-medium">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger id="category" className="h-12 rounded-2xl border-0 bg-gray-50 focus:ring-primary px-4 font-medium">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-gray-100 shadow-2xl">
                      <SelectItem value="general" className="font-medium">General</SelectItem>
                      <SelectItem value="academic" className="font-medium">Academic</SelectItem>
                      <SelectItem value="hostel" className="font-medium">Hostel</SelectItem>
                      <SelectItem value="event" className="font-medium">Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-primary/5 p-4 rounded-[1.5rem] border border-dashed border-primary/20">
                <input
                  type="checkbox"
                  id="is_pinned"
                  checked={formData.is_pinned}
                  onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                  className="h-5 w-5 rounded-lg border-primary accent-primary"
                />
                <Label htmlFor="is_pinned" className="text-sm font-black uppercase tracking-widest text-primary cursor-pointer">
                  Pin this notice to top
                </Label>
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="external_link" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Attachment / Form Link (Optional)</Label>
                <Input
                  id="external_link"
                  placeholder="https://forms.gle/your-form"
                  value={formData.external_link}
                  onChange={(e) => setFormData({ ...formData, external_link: e.target.value })}
                  className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary px-4 font-medium"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Banner Image (Optional)</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setFormData({ ...formData, image: file });
                    }}
                    className="cursor-pointer file:mr-4 file:py-2 file:px-6 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all rounded-2xl border-0 bg-gray-50"
                  />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur-md pt-4 px-6 pb-6 -mx-6 -mb-6 border-t flex flex-col gap-3">
              <Button 
                type="submit" 
                disabled={createMutation.isPending} 
                className="w-full h-14 primary-gradient text-white font-black text-lg uppercase tracking-wider rounded-2xl shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
              >
                {createMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Plus className="mr-2 h-5 w-5" />}
                {createMutation.isPending ? 'Publishing...' : 'Create Notice'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCreateDialogOpen(false)} className="font-bold text-muted-foreground">Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
