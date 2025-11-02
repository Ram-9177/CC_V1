import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Switch } from '../../ui/switch';
import { useAuth } from '../../../lib/context';
import type { College, FeatureFlag, FeatureScope, Tenant } from '../../../lib/types';
import { listTenants, listColleges } from '../../../lib/tenants';
import { deleteFeature, listFeatures, upsertFeature } from '../../../lib/features';
import { useSocketEvent } from '../../../lib/socket';
import { toast } from 'sonner';

export function FeaturesManagement() {
  const { role } = useAuth();
  const [scope, setScope] = useState<FeatureScope>('TENANT');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [scopeId, setScopeId] = useState<string>('');
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [newKey, setNewKey] = useState('');

  const canEdit = role === 'SUPER_ADMIN';

  async function refreshTenants() {
    try {
      const t = await listTenants();
      setTenants(t);
      if (!scopeId && t.length) setScopeId(t[0].id);
    } catch (e) { console.error(e); }
  }
  async function refreshColleges(tId?: string) {
    try {
      const list = await listColleges(tId);
      setColleges(list);
      if (scope === 'COLLEGE' && !scopeId && list.length) setScopeId(list[0].id);
    } catch (e) { console.error(e); }
  }
  async function refreshFlags() {
    if (!scopeId) return;
    try {
      const f = await listFeatures(scope, scopeId);
      setFlags(f);
    } catch (e) { console.error(e); }
  }

  useEffect(() => { refreshTenants(); }, []);
  useEffect(() => { if (scope === 'COLLEGE') refreshColleges(); }, [scope]);
  useEffect(() => { refreshFlags(); }, [scope, scopeId]);

  useSocketEvent('feature:updated', (payload?: any) => {
    // if update matches current scopeId or global admin change, refresh
    refreshFlags();
  }, canEdit);

  const tenantOptions = useMemo(() => tenants.map(t => ({ id: t.id, label: `${t.name} (${t.code})` })), [tenants]);
  const collegeOptions = useMemo(() => colleges.map(c => ({ id: c.id, label: `${c.name} (${c.code})` })), [colleges]);

  async function handleToggle(flag: FeatureFlag, enabled: boolean) {
    try {
      await upsertFeature({ scope, scopeId, key: flag.key, enabled, config: flag.config });
      toast.success('Feature updated');
      await refreshFlags();
    } catch (e) {
      toast.error('Failed to update feature');
    }
  }

  async function handleAdd() {
    const key = newKey.trim();
    if (!key) return;
    try {
      await upsertFeature({ scope, scopeId, key, enabled: true });
      setNewKey('');
      toast.success('Feature added');
      await refreshFlags();
    } catch (e) {
      toast.error('Failed to add feature');
    }
  }

  async function handleDelete(flag: FeatureFlag) {
    try {
      await deleteFeature(flag.id);
      toast.success('Feature removed');
      await refreshFlags();
    } catch (e) {
      toast.error('Failed to delete feature');
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4 items-end">
            <div>
              <Label>Scope</Label>
              <Select value={scope} onValueChange={(v) => { setScope(v as FeatureScope); setScopeId(''); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TENANT">Tenant</SelectItem>
                  <SelectItem value="COLLEGE">College</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scope === 'TENANT' ? (
              <div>
                <Label>Tenant</Label>
                <Select value={scopeId} onValueChange={(v) => { setScopeId(v); refreshFlags(); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantOptions.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Tenant</Label>
                  <Select onValueChange={(v) => { refreshColleges(v); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenantOptions.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>College</Label>
                  <Select value={scopeId} onValueChange={(v) => { setScopeId(v); refreshFlags(); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select college" />
                    </SelectTrigger>
                    <SelectContent>
                      {collegeOptions.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div className="border rounded-lg divide-y">
            {flags.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">No features yet.</div>
            )}
            {flags.map((f) => (
              <div key={f.id} className="flex items-center justify-between p-4 gap-4">
                <div>
                  <div className="font-medium">{f.key}</div>
                  <div className="text-xs text-muted-foreground">{f.scope} • {f.scopeId.slice(0,8)}…</div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={!!f.enabled} onCheckedChange={(v) => handleToggle(f, v)} disabled={!canEdit} />
                  <Button variant="outline" size="sm" onClick={() => handleDelete(f)} disabled={!canEdit}>Delete</Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>New feature key</Label>
              <Input placeholder="e.g., gatePass" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
            </div>
            <Button onClick={handleAdd} disabled={!newKey.trim() || !scopeId || !canEdit}>Add</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
