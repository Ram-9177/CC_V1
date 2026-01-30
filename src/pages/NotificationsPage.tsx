import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  notification_type: 'alert' | 'info' | 'warning' | 'error';
  is_read: boolean;
  action_url?: string;
  created_at: string;
}

interface NotificationPreference {
  id: number;
  email_alerts: boolean;
  email_info: boolean;
  push_alerts: boolean;
  push_info: boolean;
}

export default function NotificationsPage() {
  const [prefsOpen, setPrefsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery<NotificationItem[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await api.get('/notifications/notifications/');
      return response.data.results || response.data;
    },
  });

  const { data: unreadCount } = useQuery<{ unread_count: number }>({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const response = await api.get('/notifications/notifications/unread_count/');
      return response.data;
    },
  });

  const { data: preferences } = useQuery<NotificationPreference>({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const response = await api.get('/notifications/preferences/my_preferences/');
      return response.data;
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      await api.post('/notifications/notifications/mark_all_as_read/');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      toast.success('All notifications marked as read');
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to mark all as read'));
    },
  });

  const markOneMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/notifications/notifications/${id}/mark_as_read/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to update notification'));
    },
  });

  const savePrefsMutation = useMutation({
    mutationFn: async (payload: NotificationPreference) => {
      await api.put('/notifications/preferences/my_preferences/', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success('Preferences updated');
      setPrefsOpen(false);
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to update preferences'));
    },
  });

  const getTypeBadge = (type: NotificationItem['notification_type']) => {
    const colorMap: Record<string, string> = {
      alert: 'bg-red-100 text-red-800',
      info: 'bg-blue-100 text-blue-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-orange-100 text-orange-800',
    };
    return <Badge className={colorMap[type] || 'bg-gray-100 text-gray-800'}>{type}</Badge>;
  };

  const [prefsDraft, setPrefsDraft] = useState<NotificationPreference | null>(null);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Notifications
          </h1>
          <p className="text-muted-foreground">View and manage alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => {
            setPrefsDraft(preferences || null);
            setPrefsOpen(true);
          }}>
            <Settings className="h-4 w-4 mr-2" />
            Preferences
          </Button>
          <Button onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isPending}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark All Read
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{notifications?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Unread</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{unreadCount?.unread_count ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">Loading notifications...</CardContent>
        </Card>
      ) : notifications && notifications.length > 0 ? (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card key={notification.id} className={notification.is_read ? '' : 'border-primary'}>
              <CardHeader className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2">
                    <CardTitle className="text-lg">{notification.title}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      {getTypeBadge(notification.notification_type)}
                      {!notification.is_read && <Badge className="bg-primary text-primary-foreground">Unread</Badge>}
                    </div>
                  </div>
                  {!notification.is_read && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markOneMutation.mutate(notification.id)}
                      disabled={markOneMutation.isPending}
                    >
                      Mark Read
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground whitespace-pre-line">{notification.message}</p>
                <div className="text-xs text-muted-foreground">
                  {new Date(notification.created_at).toLocaleString()}
                </div>
                {notification.action_url && (
                  <a
                    href={notification.action_url}
                    className="text-sm text-primary underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    View details
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">No notifications found</CardContent>
        </Card>
      )}

      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Notification Preferences</DialogTitle>
            <DialogDescription>Control email and push alert settings.</DialogDescription>
          </DialogHeader>
          {prefsDraft ? (
            <div className="space-y-4 py-4">
              {[
                { key: 'email_alerts', label: 'Email alerts' },
                { key: 'email_info', label: 'Email informational updates' },
                { key: 'push_alerts', label: 'Push alerts' },
                { key: 'push_info', label: 'Push informational updates' },
              ].map((item) => (
                <label key={item.key} className="flex items-center justify-between gap-4 text-sm">
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={prefsDraft[item.key as keyof NotificationPreference] as boolean}
                    onChange={(e) =>
                      setPrefsDraft({
                        ...prefsDraft,
                        [item.key]: e.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                </label>
              ))}
            </div>
          ) : (
            <div className="py-4 text-sm text-muted-foreground">Loading preferences...</div>
          )}
          <DialogFooter>
            <Button
              onClick={() => prefsDraft && savePrefsMutation.mutate(prefsDraft)}
              disabled={!prefsDraft || savePrefsMutation.isPending}
            >
              Save Preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
