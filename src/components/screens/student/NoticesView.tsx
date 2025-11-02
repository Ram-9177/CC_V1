import { useEffect, useState, type MouseEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Bell, Pin, Calendar, User } from 'lucide-react';
import { listMyNotices, BackendNotice, markAllRead, markRead } from '../../../lib/notices';
import { useSocketEvent } from '../../../lib/socket';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';

interface Notice {
  id: string;
  title: string;
  content: string;
  category: 'GENERAL' | 'URGENT' | 'EVENT' | 'ANNOUNCEMENT';
  isPinned: boolean;
  postedBy: string;
  postedAt: string;
  expiresAt?: string;
  read?: boolean;
}

export function NoticesView() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [openNotice, setOpenNotice] = useState<Notice | null>(null);

  function mapNotice(n: BackendNotice): Notice {
    const priority = n.priority || 'NORMAL';
    const category: Notice['category'] = priority === 'HIGH' ? 'URGENT' : priority === 'LOW' ? 'GENERAL' : 'ANNOUNCEMENT';
    const postedBy = n.author ? `${n.author.firstName ?? ''} ${n.author.lastName ?? ''}`.trim() || 'System' : 'System';
    return {
      id: n.id,
      title: n.title,
      content: n.content,
      category,
      isPinned: priority === 'HIGH',
      postedBy,
      postedAt: n.createdAt,
      expiresAt: n.expiresAt ?? undefined,
      read: (n as any).read ?? false,
    };
  }

  async function refresh() {
    try {
      const data = await listMyNotices();
      setNotices(data.map(mapNotice));
    } catch (e) {
      // optional: surface error via toast in future
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // Live updates on notice events
  useSocketEvent('notice:created', () => refresh());
  useSocketEvent('notice:updated', () => refresh());
  useSocketEvent('notice:deleted', () => refresh());

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

  const pinnedNotices = notices.filter(n => n.isPinned);
  const regularNotices = notices.filter(n => !n.isPinned);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl">Notices</h1>
          <p className="text-muted-foreground">Stay updated with hostel announcements</p>
        </div>
        <Button variant="outline" onClick={async () => { try { await markAllRead(); await refresh(); } catch {} }}>
          <Bell className="h-4 w-4" />
          Mark All Read
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
            <div className="text-2xl">{pinnedNotices.length}</div>
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
      </div>

      {pinnedNotices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pin className="h-5 w-5" />
              Pinned Notices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pinnedNotices.map((notice) => (
                <div
                  key={notice.id}
                  className="border-l-4 border-primary bg-accent/50 rounded-r-lg p-4 cursor-pointer hover:bg-accent"
                  onClick={() => setOpenNotice(notice)}
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className={`font-medium ${!notice.read ? 'font-semibold' : ''} text-wrap`}>
                      {!notice.read && <span className="inline-block w-2 h-2 rounded-full bg-primary mr-2 align-middle" />}
                      {notice.title}
                    </h3>
                    <Badge variant={getCategoryColor(notice.category)}>
                      {notice.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 text-wrap">{notice.content}</p>
                  {(notice as any).attachments?.length ? (
                    <div className="mt-2 space-y-1">
                      {(notice as any).attachments.map((href: string, idx: number) => (
                        <a key={idx} href={href} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                          Attachment {idx + 1}
                        </a>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {notice.postedBy}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(notice.postedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Notices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {regularNotices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No notices at the moment</p>
              </div>
            ) : (
              regularNotices.map((notice) => (
                <div
                  key={notice.id}
                  className={`border rounded-lg p-4 hover:bg-accent transition-colors ${!notice.read ? 'bg-accent/30' : ''} cursor-pointer`}
                  onClick={() => setOpenNotice(notice)}
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className={`font-medium ${!notice.read ? 'font-semibold' : ''} text-wrap`}>
                      {!notice.read && <span className="inline-block w-2 h-2 rounded-full bg-primary mr-2 align-middle" />}
                      {notice.title}
                    </h3>
                    <Badge variant={getCategoryColor(notice.category)}>
                      {notice.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 text-wrap">{notice.content}</p>
                  {(notice as any).attachments?.length ? (
                    <div className="mt-2 space-y-1">
                      {(notice as any).attachments.map((href: string, idx: number) => (
                        <a key={idx} href={href} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                          Attachment {idx + 1}
                        </a>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {notice.postedBy}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(notice.postedAt).toLocaleDateString()}
                    </div>
                  </div>
                  {!notice.read && (
                    <div className="pt-2">
                      <Button size="sm" variant="outline" onClick={async (e: MouseEvent) => { e.stopPropagation(); try { await markRead(notice.id); await refresh(); } catch {} }}>
                        Mark Read
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
