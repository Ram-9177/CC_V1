import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Plus, Pin, Calendar, User, Loader2, X } from 'lucide-react';
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
  DialogFooter,
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
  });

  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const canManage = ['admin', 'super_admin', 'warden', 'head_warden', 'chef'].includes(user?.role || '') || user?.is_student_hr;

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
    mutationFn: async (data: Record<string, unknown>) => {
      await api.post('/notices/notices/', data);
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
    
    createMutation.mutate(formData);
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
      case 'high': return 'from-orange-500/10 to-transparent border-orange-200';
      case 'medium': return 'from-primary/10 to-transparent border-primary/20';
      default: return 'from-slate-500/5 to-transparent border-slate-200';
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold flex items-center gap-2 text-foreground">
              <Bell className="h-8 w-8" />
              Notice Board
            </h1>
            <p className="text-muted-foreground">Stay updated with the latest announcements</p>
          </div>
        {canManage && (
          <Button onClick={() => setCreateDialogOpen(true)} className="bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/30 hover:shadow-lg hover:shadow-primary/40 smooth-transition rounded-lg active:scale-95 transition-all px-4 sm:px-6 h-10 sm:h-auto">
            <Plus className="h-4 w-4 mr-2" />
            Create Notice
          </Button>
        )}
      </div>

      {/* Notices List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="grid gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse rounded-3xl h-48 bg-muted/20" />
            ))}
          </div>
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

      {/* Create Notice Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Create New Notice</DialogTitle>
            <DialogDescription>
              Create a new notice to be displayed for your target audience
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter notice title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Content *</Label>
                <Textarea
                  id="content"
                  placeholder="Enter notice content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={6}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="audience">Target Audience</Label>
                  <Select
                    value={formData.target_audience}
                    onValueChange={(value) => setFormData({ ...formData, target_audience: value, target_building: undefined })}
                  >
                    <SelectTrigger id="audience">
                      <SelectValue placeholder="Select audience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Everyone</SelectItem>
                      <SelectItem value="students">Students Only</SelectItem>
                      <SelectItem value="wardens">Wardens Only</SelectItem>
                      <SelectItem value="chefs">Chefs Only</SelectItem>
                      <SelectItem value="staff">All Staff</SelectItem>
                      <SelectItem value="block">Block-Specific</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.target_audience === 'block' && (
                  <div className="space-y-2">
                    <Label htmlFor="building">Select Block/Building</Label>
                    <Select
                      value={formData.target_building}
                      onValueChange={(value) => setFormData({ ...formData, target_building: value })}
                    >
                      <SelectTrigger id="building">
                        <SelectValue placeholder="Select building" />
                      </SelectTrigger>
                      <SelectContent>
                        {buildings?.map((b: Building) => (
                          <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger id="priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="academic">Academic</SelectItem>
                      <SelectItem value="hostel">Hostel</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2 bg-muted/30 p-3 rounded-xl border border-dashed">
                <input
                  type="checkbox"
                  id="is_pinned"
                  checked={formData.is_pinned}
                  onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="is_pinned" className="font-bold cursor-pointer text-xs uppercase tracking-wider">
                  Pin this notice to the top (Highlights for everyone)
                </Label>
              </div>

              <div className="space-y-2 pt-2 border-t border-dashed">
                <Label htmlFor="external_link">Attachment / Form Link (Optional)</Label>
                <Input
                  id="external_link"
                  placeholder="e.g. https://forms.gle/..."
                  value={formData.external_link}
                  onChange={(e) => setFormData({ ...formData, external_link: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground font-medium">Add a Google Form, PDF link, or external website for this announcement.</p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="border-black text-foreground font-bold hover:bg-muted"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/30 hover:shadow-lg hover:shadow-primary/40 smooth-transition rounded-lg active:scale-95 transition-all">
                {createMutation.isPending ? 'Creating...' : 'Create Notice'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
