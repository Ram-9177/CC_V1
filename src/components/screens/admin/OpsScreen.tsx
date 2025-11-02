import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { API_URL, getAuthToken, hasBackend } from '../../../lib/config';

export function OpsScreen() {
  const [health, setHealth] = useState<any | null>(null);
  const [metrics, setMetrics] = useState<string>('');
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendTitle, setSendTitle] = useState('Test Notification');
  const [sendBody, setSendBody] = useState('This is a test');
  const [sendUrl, setSendUrl] = useState('/');
  const [sendResult, setSendResult] = useState<any | null>(null);
  const [bTitle, setBTitle] = useState('Announcement');
  const [bBody, setBBody] = useState('Hello all');
  const [bUrl, setBUrl] = useState('/');
  const [bRole, setBRole] = useState<string>('');
  const [bHostelId, setBHostelId] = useState<string>('');
  const [broadcastResult, setBroadcastResult] = useState<any | null>(null);
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [limit, setLimit] = useState<number>(20);

  async function load(p: number = page) {
    if (!hasBackend()) return;
    setLoading(true);
    try {
      const token = getAuthToken();
      const h = await fetch(new URL('/health', API_URL).toString(), { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } }).then(r => r.json());
      setHealth(h);
      const m = await fetch(new URL('/metrics', API_URL).toString(), { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } }).then(r => r.text());
      setMetrics(m);
      const a = await fetch(new URL(`/notifications/audit?page=${p}&limit=${limit}`, API_URL).toString(), { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } }).then(r => r.json());
      setAudits(a.items || []);
      setTotal(a.total || 0);
      setPage(a.page || p);
      setLimit(a.limit || limit);
    } catch (e) {} finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function sendTest() {
    if (!hasBackend()) return;
    const token = getAuthToken();
    const res = await fetch(new URL('/notifications/test', API_URL).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ title: sendTitle, body: sendBody, url: sendUrl }),
    });
    const json = await res.json().catch(() => ({}));
    setSendResult(json);
  }

  async function sendBroadcast() {
    if (!hasBackend()) return;
    const token = getAuthToken();
    const res = await fetch(new URL('/notifications/broadcast', API_URL).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ title: bTitle, body: bBody, url: bUrl, role: bRole || undefined, hostelId: bHostelId || undefined }),
    });
    const json = await res.json().catch(() => ({}));
    setBroadcastResult(json);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl">Operations</h1>
          <p className="text-muted-foreground">Health, metrics, and recent notification audits</p>
        </div>
  <Button onClick={() => load()} disabled={loading}>Refresh</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Health</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(health, null, 2)}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Metrics</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs whitespace-pre overflow-auto max-h-80">{metrics || 'No metrics'}</pre>
          {/* Simple parsed highlights */}
          {metrics && (
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              {(() => {
                try {
                  const lines = metrics.split('\n').filter(l => l && !l.startsWith('#'));
                  const map: Record<string, string> = {};
                  for (const l of lines) {
                    const [k, v] = l.split(/\s+/);
                    if (k && v && !(k in map)) map[k] = v;
                  }
                  const items = [
                    ['process_start_time_seconds', map['process_start_time_seconds']],
                    ['process_cpu_user_seconds_total', map['process_cpu_user_seconds_total']],
                    ['process_cpu_system_seconds_total', map['process_cpu_system_seconds_total']],
                    ['nodejs_eventloop_lag_min_seconds', map['nodejs_eventloop_lag_min_seconds']],
                    ['http_requests_total', map['http_requests_total'] || map['http_requests_count']],
                  ].filter(([, v]) => typeof v !== 'undefined');
                  return items.map(([k, v]) => (
                    <div key={k} className="border rounded p-2 bg-background flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-mono">{v}</span></div>
                  ));
                } catch { return null; }
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notification Audits</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Send Test Notification</div>
              <input className="border rounded p-2 w-full" placeholder="Title" value={sendTitle} onChange={e => setSendTitle(e.target.value)} />
              <input className="border rounded p-2 w-full" placeholder="Body" value={sendBody} onChange={e => setSendBody(e.target.value)} />
              <input className="border rounded p-2 w-full" placeholder="URL (on click)" value={sendUrl} onChange={e => setSendUrl(e.target.value)} />
              <Button onClick={sendTest}>Send to Me</Button>
              {sendResult && <div className="text-xs text-muted-foreground">{JSON.stringify(sendResult)}</div>}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Broadcast Notification</div>
              <input className="border rounded p-2 w-full" placeholder="Title" value={bTitle} onChange={e => setBTitle(e.target.value)} />
              <input className="border rounded p-2 w-full" placeholder="Body" value={bBody} onChange={e => setBBody(e.target.value)} />
              <input className="border rounded p-2 w-full" placeholder="URL (on click)" value={bUrl} onChange={e => setBUrl(e.target.value)} />
              <input className="border rounded p-2 w-full" placeholder="Role (e.g. STUDENT) optional" value={bRole} onChange={e => setBRole(e.target.value)} />
              <input className="border rounded p-2 w-full" placeholder="Hostel ID optional" value={bHostelId} onChange={e => setBHostelId(e.target.value)} />
              <Button variant="secondary" onClick={sendBroadcast}>Broadcast</Button>
              {broadcastResult && <div className="text-xs text-muted-foreground">{JSON.stringify(broadcastResult)}</div>}
            </div>
          </div>
          {audits.length === 0 ? (
            <div className="text-sm text-muted-foreground">No audit records</div>
          ) : (
            <div className="space-y-2">
              {audits.map((a) => (
                <div key={a.id} className="border rounded p-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{a.status}</span>
                    <span className="text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">recipient: {a.recipient || '—'} topic: {a.topic || '—'}</div>
                  {a.error && <div className="text-xs text-red-600">{a.error}</div>}
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-muted-foreground">Page {page} of {Math.max(1, Math.ceil(total / limit) || 1)} • Total {total}</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>Prev</Button>
                  <Button size="sm" variant="outline" disabled={page >= Math.ceil(total / limit) || loading} onClick={() => load(page + 1)}>Next</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
