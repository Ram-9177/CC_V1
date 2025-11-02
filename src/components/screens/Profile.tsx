import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { useAuth } from '../../lib/context';
import { API_URL, getAuthToken, hasBackend, ANDROID_APK_URL, ANDROID_TWA_URL } from '../../lib/config';
import { enableWebPush } from '../../lib/pwaPush';
import { enableAndroidPush, isAndroidNative } from '../../lib/androidPush';
import { listMyTokens, deleteDeviceToken } from '../../lib/notificationsClient';
import { Button } from '../ui/button';
import { usePWAInstall } from '../../lib/usePWAInstall';

export function Profile() {
  const { user, role } = useAuth();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<any[]>([]);
  const [notifMsg, setNotifMsg] = useState<string | null>(null);
  const [androidMsg, setAndroidMsg] = useState<string | null>(null);
  const { canInstall, promptInstall, platformHints } = usePWAInstall();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        if (hasBackend()) {
          const token = getAuthToken();
          const res = await fetch(new URL(`/users/${user.id}`, API_URL).toString(), {
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (!cancelled) setProfile(data);
        } else {
          if (!cancelled) setProfile(user);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    (async () => {
      if (!hasBackend()) return;
      try { setTokens(await listMyTokens()); } catch {}
    })();
  }, []);

  async function handleEnableWebPush() {
    setNotifMsg(null);
    const res = await enableWebPush();
    if (!res.ok) setNotifMsg(`Notifications failed: ${res.reason}`);
    else {
      setNotifMsg('Notifications enabled');
      try { setTokens(await listMyTokens()); } catch {}
    }
  }

  async function handleDeleteToken(id: string) {
    await deleteDeviceToken(id).catch(() => {});
    try { setTokens(await listMyTokens()); } catch {}
  }

  async function handleEnableAndroidPush() {
    setAndroidMsg(null);
    const res = await enableAndroidPush();
    if (!res.ok) setAndroidMsg(`Android push failed: ${res.reason}`);
    else {
      setAndroidMsg('Android push enabled');
      try { setTokens(await listMyTokens()); } catch {}
    }
  }

  const rows: Array<[string, any]> = [
    ['Role', role],
    ['Hallticket', profile?.hallticket || '—'],
    ['Name', [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || profile?.name || '—'],
    ['Email', profile?.email || '—'],
    ['Phone', profile?.phoneNumber || profile?.phone || '—'],
    ['Hostel Block', profile?.hostelBlock || '—'],
    ['Room Number', profile?.roomNumber || '—'],
    ['Bed Label', profile?.bedLabel || '—'],
    ['Created', profile?.createdAt || '—'],
    ['Updated', profile?.updatedAt || '—'],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">My Profile</h1>
        <p className="text-muted-foreground">View your personal details and hostel allocation.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">User Details <Badge variant="outline">{role}</Badge></CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}
          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border rounded p-2 bg-background">
                  <div className="text-sm text-muted-foreground">{label}</div>
                  <div className="font-medium">{String(value)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Get the App</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {canInstall && (
              <Button onClick={() => promptInstall()}>Install App (PWA)</Button>
            )}
            {!canInstall && platformHints.isIOS && (
              <div className="text-sm text-muted-foreground">
                On iOS: tap the Share button and choose "Add to Home Screen" to install.
              </div>
            )}
            {ANDROID_APK_URL && (
              <Button asChild variant="outline">
                <a href={ANDROID_APK_URL} target="_blank" rel="noreferrer">Download Android APK</a>
              </Button>
            )}
            {ANDROID_TWA_URL && (
              <Button asChild variant="secondary">
                <a href={ANDROID_TWA_URL} target="_blank" rel="noreferrer">Open in Play Store</a>
              </Button>
            )}
            {!canInstall && !platformHints.isIOS && !ANDROID_APK_URL && !ANDROID_TWA_URL && (
              <div className="text-sm text-muted-foreground">Install option will appear on supported browsers.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Button onClick={handleEnableWebPush}>Enable Web Push (PWA)</Button>
            {notifMsg && <span className="text-sm text-muted-foreground">{notifMsg}</span>}
          </div>
          {isAndroidNative() && (
            <div className="flex items-center gap-2">
              <Button onClick={handleEnableAndroidPush} variant="secondary">Enable Android Push</Button>
              {androidMsg && <span className="text-sm text-muted-foreground">{androidMsg}</span>}
            </div>
          )}
          <div>
            <div className="text-sm text-muted-foreground mb-2">Registered Devices</div>
            <div className="space-y-2">
              {tokens.length === 0 && <div className="text-sm text-muted-foreground">No devices registered</div>}
              {tokens.map((t) => (
                <div key={t.id} className="flex items-center justify-between border rounded p-2">
                  <div className="text-sm">
                    <div className="font-medium">{t.platform}</div>
                    <div className="text-muted-foreground text-xs">{new Date(t.createdAt).toLocaleString()}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleDeleteToken(t.id)}>Remove</Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
