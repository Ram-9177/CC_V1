import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Badge } from '../../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Switch } from '../../ui/switch';
import { Plus, Send, Pin, Trash2, Bell, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { BackendNotice, createNotice, deleteNotice, listAllNotices, updateNotice } from '../../../lib/notices';
import { useSocketEvent } from '../../../lib/socket';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { broadcastNotification } from '../../../lib/notificationsClient';

interface Notice {
  id: string;
  title: string;
  content: string;
  category: 'GENERAL' | 'URGENT' | 'EVENT' | 'ANNOUNCEMENT';
  isPinned: boolean;
  postedAt: string;
}

export function NoticesManagement() {
  const [showForm, setShowForm] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selected, setSelected] = useState<Notice | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'GENERAL' as Notice['category'],
    isPinned: false,
    roles: [] as string[],
    attachments: '' as string, // comma-separated
    expiresAt: '' as string, // yyyy-mm-dd
  });

  const [filters, setFilters] = useState<{ role: string | 'ALL'; includeExpired: boolean }>({ role: 'ALL', includeExpired: false });

  function mapBackend(n: BackendNotice): Notice {
    const priority = n.priority || 'NORMAL';
    const category: Notice['category'] = priority === 'HIGH' ? 'URGENT' : priority === 'LOW' ? 'GENERAL' : 'ANNOUNCEMENT';
    return { id: n.id, title: n.title, content: n.content, category, isPinned: priority === 'HIGH', postedAt: n.createdAt };
  }

  async function refresh() {
    try {
      const params: any = {};
      if (filters.role && filters.role !== 'ALL') params.role = filters.role;
      if (filters.includeExpired) params.includeExpired = true;
      const data = await listAllNotices(params);
      setNotices(data.map(mapBackend));
    } catch (e) {
      // ignore for now
    }
  }

  useEffect(() => { refresh(); }, [filters.role, filters.includeExpired]);
  useSocketEvent('notice:created', () => refresh());
  useSocketEvent('notice:updated', () => refresh());
  useSocketEvent('notice:deleted', () => refresh());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const priority = formData.category === 'URGENT' ? 'HIGH' : formData.category === 'GENERAL' ? 'LOW' : 'NORMAL';
      const attachments = formData.attachments
        ? formData.attachments.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;
      const expiresAt = formData.expiresAt ? new Date(formData.expiresAt).toISOString() : undefined;
      await createNotice({ title: formData.title, content: formData.content, priority, roles: formData.roles.length ? formData.roles : undefined, attachments, expiresAt });
      await refresh();
      setFormData({ title: '', content: '', category: 'GENERAL', isPinned: false, roles: [], attachments: '', expiresAt: '' });
      setShowForm(false);
      toast.success('Notice posted successfully');
    } catch (err: any) {
      toast.error('Failed to post notice');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotice(id);
      await refresh();
      toast.success('Notice deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const togglePin = async (id: string) => {
    try {
      const n = notices.find(x => x.id === id);
      if (!n) return;
      const nextPriority = !n.isPinned ? 'HIGH' : 'NORMAL';
      await updateNotice(id, { priority: nextPriority as any });
      await refresh();
    } catch {
      toast.error('Failed to update');
    }
  };

  const getCategoryColor = (category: Notice['category']) => {
    switch (category) {
      case 'URGENT':
        return 'destructive';
      case 'EVENT':
        return 'default';
      case 'ANNOUNCEMENT':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl">Notice Management</h1>
          <p className="text-muted-foreground">Create and manage hostel notices</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          Create Notice
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={filters.role} onValueChange={(role: any) => setFilters(prev => ({ ...prev, role }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="STUDENT">Student</SelectItem>
                  <SelectItem value="WARDEN">Warden</SelectItem>
                  <SelectItem value="WARDEN_HEAD">Warden Head</SelectItem>
                  <SelectItem value="CHEF">Chef</SelectItem>
                  <SelectItem value="GATEMAN">Gateman</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Include Expired</Label>
              <div className="flex items-center h-10">
                <Switch checked={filters.includeExpired} onCheckedChange={(v: boolean) => setFilters(prev => ({ ...prev, includeExpired: !!v }))} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Notices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{notices.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pinned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-blue-600 dark:text-blue-400">
              {notices.filter(n => n.isPinned).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">
              {notices.filter(n => {
                const diff = Date.now() - new Date(n.postedAt).getTime();
                return diff < 7 * 24 * 60 * 60 * 1000;
              }).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Urgent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600 dark:text-red-400">
              {notices.filter(n => n.category === 'URGENT').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Notice</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Enter notice title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  placeholder="Enter notice content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Filter by title or content"
                  onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value })) as any}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value: Notice['category']) =>
                      setFormData({ ...formData, category: value })
                    }
                  >
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GENERAL">General</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                      <SelectItem value="EVENT">Event</SelectItem>
                      <SelectItem value="ANNOUNCEMENT">Announcement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pin">Pin to Top</Label>
                  <div className="flex items-center space-x-2 h-10">
                    <Switch
                      id="pin"
                      checked={formData.isPinned}
                      onCheckedChange={(checked: boolean) =>
                        setFormData({ ...formData, isPinned: checked })
                      }
                    />
                    <span className="text-sm text-muted-foreground">
                      {formData.isPinned ? 'Pinned' : 'Not pinned'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target Roles</Label>
                  <div className="flex flex-wrap gap-3">
                    {['STUDENT','WARDEN','WARDEN_HEAD','CHEF','GATEMAN'].map(r => (
                      <label key={r} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.roles.includes(r)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...formData.roles, r]
                              : formData.roles.filter(x => x !== r);
                            setFormData({ ...formData, roles: next });
                          }}
                        />
                        {r}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Leave empty to broadcast to students by default.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expires">Expires At</Label>
                  <Input id="expires" type="date" value={formData.expiresAt} onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Optional; notice is hidden after this date.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="attachments">Attachments (comma-separated URLs)</Label>
                <Textarea id="attachments" placeholder="https://... , https://..." value={formData.attachments} onChange={(e) => setFormData({ ...formData, attachments: e.target.value })} rows={2} />
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  <Send className="h-4 w-4" />
                  Post Notice
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Notices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {notices.map((notice) => (
              <div
                key={notice.id}
                className={`border rounded-lg p-5 min-h-16 ${notice.isPinned ? 'border-l-4 border-l-primary bg-accent/50' : ''}`}
                role="button"
                onClick={() => { setSelected(notice); setOpenDialog(true); }}
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{notice.title}</h3>
                      {notice.isPinned && (
                        <Pin className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{notice.content}</p>
                  </div>
                  <Badge variant={getCategoryColor(notice.category)}>
                    {notice.category}
                  </Badge>
                </div>

                <div className="flex items-center justify-between pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    Posted {new Date(notice.postedAt).toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); togglePin(notice.id); }}>
                      <Pin className="h-4 w-4" />
                      {notice.isPinned ? 'Unpin' : 'Pin'}
                    </Button>
                    <Button variant="ghost" onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); handleDelete(notice.id); }}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                    <Button variant="outline" onClick={async (e: React.MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      try {
                        const targetRole = (filters.role && filters.role !== 'ALL') ? filters.role : undefined;
                        await broadcastNotification({
                          role: targetRole,
                          title: notice.title,
                          body: notice.content.slice(0, 120),
                          url: '/student/notices',
                          filters: targetRole === 'STUDENT' ? { excludeOutpass: true } : undefined,
                        });
                        toast.success('Push sent');
                      } catch { toast.error('Failed to send push'); }
                    }}>
                      <Bell className="h-4 w-4" />
                      Send Push
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <div className="pt-2">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const pageSize = 10;
                    const currentCount = notices.length;
                    const more = await listAllNotices({
                      role: filters.role === 'ALL' ? undefined : filters.role,
                      includeExpired: filters.includeExpired,
                      q: (filters as any).q,
                      limit: pageSize,
                      offset: currentCount,
                    });
                    setNotices((prev) => [...prev, ...more.map(mapBackend)]);
                  } catch {}
                }}
              >
                Load more
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.title || 'Notice'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Posted {selected ? new Date(selected.postedAt).toLocaleString() : ''}</div>
            <div className="border rounded-lg p-4 bg-card text-card-foreground whitespace-pre-wrap text-wrap">
              {selected?.content}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { if (selected) navigator.clipboard.writeText(`${window.location.origin}/student/notices`); }}>
              <Link2 className="h-4 w-4" /> Copy Link
            </Button>
            <Button onClick={() => setOpenDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
