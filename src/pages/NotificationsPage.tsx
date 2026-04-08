import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';
import { getApiErrorMessage, cn } from '@/lib/utils';
import { useNotification } from '@/hooks/useWebSocket';
import { ListSkeleton } from '@/components/common/PageSkeleton';
import {
  useNotificationsList,
  useUnreadCount,
  useNotificationPreferences,
  useMarkAllAsRead,
  useMarkAsRead,
  useClearAllNotifications,
  useUpdateNotificationPreferences,
} from '@/hooks/features/useNotifications';
import { api } from '@/lib/api';
import type { Notification as NotificationItem } from '@/types';

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

  const { data: notifications, isLoading, refetch: refetchNotifications } = useNotificationsList();

  useNotification('notification', () => {
    refetchNotifications();
    queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
  });

  const { data: unreadCount } = useUnreadCount();

  const { data: preferences } = useNotificationPreferences();

  const markAllMutation = useMarkAllAsRead();
  const markOneMutation = useMarkAsRead();
  const clearAllMutation = useClearAllNotifications();
  const savePrefsMutation = useUpdateNotificationPreferences();

  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast.error('Web Push is not supported in this browser.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Permission for notifications was denied.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const padding = '='.repeat((4 - ('BDeljqv6rsFCaNrz7uUY-oB3OAvCc_6AMTBI9pMeJYMSISdUUcRjkwa9bBHJYXi9WVY3bTeSG-N2HMlv_OZSLSU'.length % 4)) % 4);
        const base64 = ('BDeljqv6rsFCaNrz7uUY-oB3OAvCc_6AMTBI9pMeJYMSISdUUcRjkwa9bBHJYXi9WVY3bTeSG-N2HMlv_OZSLSU' + padding)
          .replace(/-/g, '+')
          .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: outputArray
        });
      }

      const p256dh = subscription.getKey('p256dh');
      const auth = subscription.getKey('auth');

      const toBase64Url = (buffer: ArrayBuffer | null) => {
        if (!buffer) return '';
        const base64 = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(buffer))));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      };

      await api.post('/notifications/webpush/subscribe/', {
        endpoint: subscription.endpoint,
        p256dh_key: toBase64Url(p256dh),
        auth_key: toBase64Url(auth),
      });

      toast.success('Native device push notifications enabled!');
    } catch (error) {
      console.error(error);
      toast.error(getApiErrorMessage(error, 'Failed to setup push notifications.'));
    }
  };

  const [prefsDraft, setPrefsDraft] = useState<NotificationPreference | null>(null);

  return (
    <div className="w-full mx-auto px-0 py-0 min-h-[calc(100vh-4rem)] flex flex-col relative">
      {/* Requirement 1, 2, 4: Sticky Header Section */}
      <div className="sticky top-14 z-30 bg-[#0B0B0C]/90 backdrop-blur-xl border-b border-blue-500/10 py-4 px-4 sm:px-6 rounded-t-2xl flex items-center justify-between shadow-[0_4px_20px_-10px_rgba(59,130,246,0.15)] -mx-4 sm:-mx-6 mb-6">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold flex items-center gap-2 text-white">
            <Bell className="h-6 w-6 text-blue-400" />
            Notifications
          </h1>
          <p className="text-[10px] text-blue-400/80 uppercase font-black tracking-widest hidden sm:block mt-1">
            {unreadCount?.unread_count ?? 0} Unread Alerts
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Requirement 3: Mobile secondary actions as icon buttons */}
          <Button 
            variant="ghost" 
            size="icon"
            aria-label="Open notification preferences"
            className="rounded-xl text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 sm:hidden"
            onClick={() => {
              setPrefsDraft(preferences || null);
              setPrefsOpen(true);
            }}
          >
            <Settings className="h-5 w-5" />
          </Button>

          {/* Device Push Button - sm+ */}
          <Button 
            variant="outline"
            size="sm"
            className="border-blue-500/20 text-blue-400 hover:text-white hover:bg-blue-500/20 font-bold rounded-xl hidden md:flex active:scale-95 transition-all text-xs"
            onClick={subscribeToPush}
          >
            <Bell className="h-3.5 w-3.5 mr-2" />
            Enable Push
          </Button>

          {/* Requirement 2: Dismiss All Button in header */}
          <Button 
            className="bg-blue-500 text-white font-bold uppercase text-[10px] tracking-widest border-0 rounded-xl shadow-md hover:bg-blue-600 hover:shadow-blue-500/20 hover:shadow-lg active:scale-95 transition-all h-10 px-6"
            onClick={() => markAllMutation.mutate(undefined, {
              onSuccess: () => toast.success('All notifications marked as read'),
              onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'Failed to mark all as read')),
            })} 
            disabled={markAllMutation.isPending || (notifications?.length === 0)}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
            Dismiss All
          </Button>
        </div>
      </div>

      <div className="py-6 space-y-6 flex-1">
        {/* Secondary Actions Row for mobile/tablet */}
        <div className="flex sm:flex-row flex-col gap-3 md:hidden">
           <Button 
            variant="outline"
            className="flex-1 border-primary/20 text-primary font-bold rounded-sm h-12 active:scale-95 transition-all"
            onClick={subscribeToPush}
          >
            <Bell className="h-4 w-4 mr-2" />
            Enable Device Push
          </Button>
          <Button 
            variant="outline"
            className="flex-1 border-border text-foreground font-bold rounded-sm h-12 active:scale-95 transition-all sm:flex hidden"
            onClick={() => {
              setPrefsDraft(preferences || null);
              setPrefsOpen(true);
            }}
          >
            <Settings className="h-4 w-4 mr-2" />
            Preferences
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{notifications?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Unread</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{unreadCount?.unread_count ?? 0}</div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : notifications && notifications.length > 0 ? (
          <div className="space-y-4 pb-20">
            {notifications.map((notification) => (
              <SwipeableNotificationCard
                key={notification.id}
                notification={notification}
                onMarkRead={(id) => markOneMutation.mutate(id, {
                  onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'Failed to update notification')),
                })}
                isPending={markOneMutation.isPending}
              />
            ))}

            <div className="pt-4 flex justify-center">
              <Button 
                variant="outline" 
                className="text-rose-500 border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition-all font-bold text-xs px-6 py-2 rounded-sm shadow-sm"
                onClick={() => clearAllMutation.mutate(undefined, {
                  onSuccess: () => toast.success('All notifications cleared'),
                  onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'Failed to clear all notifications')),
                })}
                disabled={clearAllMutation.isPending}
              >
                Clear All Notifications
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Bell}
            title="No notifications"
            description="You're all caught up! New notifications will appear here"
            variant="success"
          />
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
                className="primary-gradient text-white font-semibold hover:opacity-90 smooth-transition"
                onClick={() => prefsDraft && savePrefsMutation.mutate(prefsDraft as unknown as Record<string, unknown>, {
                  onSuccess: () => { toast.success('Preferences updated'); setPrefsOpen(false); },
                  onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'Failed to update preferences')),
                })}
                disabled={!prefsDraft || savePrefsMutation.isPending}
              >
                Save Preferences
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function SwipeableNotificationCard({ 
  notification, 
  onMarkRead, 
  isPending 
}: { 
  notification: NotificationItem; 
  onMarkRead: (id: number) => void; 
  isPending: boolean;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isSwipingRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isSwipingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current === null || startYRef.current === null) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startXRef.current;
    const diffY = currentY - startYRef.current;

    if (isSwipingRef.current) {
      setOffsetX(diffX);
      if (Math.abs(diffX) > 10) {
        e.stopPropagation();
      }
      return;
    }

    if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
      isSwipingRef.current = true;
      setOffsetX(diffX);
    }
  };

  const handleTouchEnd = () => {
    if (Math.abs(offsetX) > 120) {
      if (!notification.is_read) {
        onMarkRead(notification.id);
      }
    }
    setOffsetX(0);
    startXRef.current = null;
    startYRef.current = null;
    isSwipingRef.current = false;
  };

  const getTypeBadge = (type: NotificationItem['notification_type']) => {
    const colorMap: Record<string, string> = {
      alert: 'alert-gradient text-white font-black uppercase text-[10px] tracking-widest px-3 py-1',
      info: 'bg-primary/10 text-primary border-primary/20 font-bold px-3 py-1',
      warning: 'bg-amber-100 text-amber-700 border-amber-200 font-bold px-3 py-1',
      error: 'bg-red-500 text-white border-0 font-bold px-3 py-1 animate-pulse shadow-lg shadow-red-500/20',
    };
    return <Badge className={cn(colorMap[type] || 'bg-muted/40 text-black border-muted font-bold px-3 py-1')}>{type}</Badge>;
  };

  return (
    <div 
      className="relative touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ 
        transform: `translateX(${offsetX}px)`, 
        transition: offsetX === 0 ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
        opacity: Math.max(1 - Math.abs(offsetX) / 300, 0.5)
      }}
    >
      <Card className={notification.is_read ? 'opacity-80' : 'border-primary shadow-md'}>
        <CardHeader className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <CardTitle className="text-lg">{notification.title}</CardTitle>
              <div className="flex flex-wrap gap-2">
                {getTypeBadge(notification.notification_type)}
                {!notification.is_read && <Badge className="bg-primary text-white border-0 font-bold">Unread</Badge>}
              </div>
            </div>
            {!notification.is_read && (
              <Button
                size="sm"
                className="bg-white shadow-md shadow-black/5 text-primary font-black uppercase text-[10px] tracking-widest hover:shadow-lg active:scale-95 transition-all !border-0"
                onClick={() => onMarkRead(notification.id)}
                disabled={isPending}
              >
                Mark Read
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground whitespace-pre-line">{notification.message}</p>
          <div className="flex items-center justify-between mt-4">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {new Date(notification.created_at).toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Swipe Indicators */}
      {offsetX !== 0 && (
        <div 
          className={cn(
            "absolute inset-y-0 flex items-center justify-center w-20 text-white font-black text-[10px] uppercase transition-opacity",
            offsetX > 0 ? "left-0 bg-emerald-500" : "right-0 bg-primary"
          )}
          style={{ 
            transform: offsetX > 0 ? 'translateX(-100%)' : 'translateX(100%)' 
          }}
        >
          {notification.is_read ? 'DISMISS' : 'MARK READ'}
        </div>
      )}
    </div>
  );
}
