import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/context';
import { createTenant, listTenants } from '../../../lib/tenants';
import type { Tenant } from '../../../lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { useSocketEvent } from '../../../lib/socket';

export function TenantsManagement() {
  const { role } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [form, setForm] = useState({ code: '', name: '', contactEmail: '' });
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    try { setTenants(await listTenants()); } catch {}
  };

  useEffect(() => { refresh(); }, []);
  useSocketEvent('tenant:created', refresh);
  useSocketEvent('tenant:updated', refresh);
  useSocketEvent('tenant:deleted', refresh);

  if (role !== 'SUPER_ADMIN') return <div>Unauthorized</div>;

  const onCreate = async () => {
    if (!form.code || !form.name) return;
    setLoading(true);
    try {
      await createTenant({ code: form.code.trim(), name: form.name.trim(), contactEmail: form.contactEmail.trim() });
      setForm({ code: '', name: '', contactEmail: '' });
      await refresh();
    } finally { setLoading(false); }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader><CardTitle>Create Tenant</CardTitle></CardHeader>
        <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-4">
          <Input placeholder="Code (unique)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Contact Email (optional)" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
          <Button onClick={onCreate} disabled={loading}>Create</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tenants ({tenants.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-2">Code</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-muted/30">
                    <td className="p-2 font-mono">{t.code}</td>
                    <td className="p-2">{t.name}</td>
                    <td className="p-2">{t.contactEmail || '-'}</td>
                    <td className="p-2">{new Date(t.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {tenants.length === 0 && (
                  <tr><td className="p-4 text-muted-foreground" colSpan={4}>No tenants yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
