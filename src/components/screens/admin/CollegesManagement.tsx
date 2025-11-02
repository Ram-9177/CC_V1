import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../lib/context';
import { createCollege, listColleges, listTenants } from '../../../lib/tenants';
import type { College, Tenant } from '../../../lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { useSocketEvent } from '../../../lib/socket';

export function CollegesManagement() {
  const { role } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [colleges, setColleges] = useState<College[]>([]);
  const [form, setForm] = useState({ code: '', name: '', address: '' });
  const [loading, setLoading] = useState(false);

  const refreshTenants = async () => { try { setTenants(await listTenants()); } catch {} };
  const refreshColleges = async () => { try { setColleges(await listColleges(selectedTenant || undefined)); } catch {} };

  useEffect(() => { refreshTenants(); }, []);
  useEffect(() => { refreshColleges(); }, [selectedTenant]);
  useSocketEvent('college:created', refreshColleges);
  useSocketEvent('college:updated', refreshColleges);
  useSocketEvent('college:deleted', refreshColleges);

  if (role !== 'SUPER_ADMIN') return <div>Unauthorized</div>;

  const onCreate = async () => {
    if (!selectedTenant || !form.code || !form.name) return;
    setLoading(true);
    try {
      await createCollege({ tenantId: selectedTenant, code: form.code.trim(), name: form.name.trim(), address: form.address.trim() });
      setForm({ code: '', name: '', address: '' });
      await refreshColleges();
    } finally { setLoading(false); }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader><CardTitle>Create College</CardTitle></CardHeader>
        <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-5">
          <Select value={selectedTenant} onValueChange={setSelectedTenant}>
            <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
            <SelectContent>
              {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.code})</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Code (unique)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Address (optional)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Button onClick={onCreate} disabled={loading || !selectedTenant}>Create</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Colleges {selectedTenant ? `for ${tenants.find(t => t.id === selectedTenant)?.name}` : ''} ({colleges.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-2">Tenant</th>
                  <th className="p-2">Code</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Address</th>
                </tr>
              </thead>
              <tbody>
                {colleges.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-muted/30">
                    <td className="p-2">{c.tenant?.name} ({c.tenant?.code})</td>
                    <td className="p-2 font-mono">{c.code}</td>
                    <td className="p-2">{c.name}</td>
                    <td className="p-2">{c.address || '-'}</td>
                  </tr>
                ))}
                {colleges.length === 0 && (
                  <tr><td className="p-4 text-muted-foreground" colSpan={4}>No colleges yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
