import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { HallticketChip } from '../../HallticketChip';
import { HighSearch, SearchResult } from '../../HighSearch';
import { Users, Search, Plus, Download, Upload, Filter } from 'lucide-react';
import { CSVImport } from '../../CSVImport';
import { bulkImportUsersFromCsvText, exportUsers as apiExportUsers, listUsers, type UserListItem } from '../../../lib/users';
import { useAuth } from '../../../lib/context';
import { hasBackend } from '../../../lib/config';
import { searchUsersLite } from '../../../lib/search';
import { useSocketEvent } from '../../../lib/socket';

export function UsersManagement() {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [showImport, setShowImport] = useState(false);
  const { role } = useAuth();
  const [users, setUsers] = useState<UserListItem[]>([]);

  const stats = {
    total: users.length,
    students: users.filter(u => u.role === 'STUDENT').length,
    wardens: users.filter(u => u.role === 'WARDEN').length,
    gatemen: users.filter(u => u.role === 'GATEMAN').length,
    chefs: users.filter(u => u.role === 'CHEF').length,
    admins: users.filter(u => u.role === 'SUPER_ADMIN').length,
  };

  const refresh = useCallback(async () => {
    if (!hasBackend()) return;
    try {
      const list = await listUsers({ role: selectedRole });
      setUsers(list);
    } catch {}
  }, [selectedRole]);

  useEffect(() => {
    let mounted = true;
    (async () => { if (mounted) await refresh(); })();
    return () => { mounted = false; };
  }, [refresh]);

  // Realtime: refetch on user changes
  useSocketEvent('user:created', refresh, true);
  useSocketEvent('user:updated', refresh, true);
  useSocketEvent('user:deleted', refresh, true);
  useSocketEvent('user:imported', refresh, true);

  const mockUsers = [
    { hallticket: 'HT001', name: 'Ravi Kumar', role: 'STUDENT', phone: '9876543210', status: 'active' },
    { hallticket: 'WARDEN001', name: 'Dr. Ramesh', role: 'WARDEN', phone: '9876543201', status: 'active' },
    { hallticket: 'GATEMAN001', name: 'Kumar', role: 'GATEMAN', phone: '9876543202', status: 'active' },
    { hallticket: 'CHEF001', name: 'Prasad', role: 'CHEF', phone: '9876543203', status: 'active' },
    { hallticket: 'ADMIN001', name: 'Admin User', role: 'SUPER_ADMIN', phone: '9876543204', status: 'active' },
  ];

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'STUDENT':
        return 'default';
      case 'WARDEN':
        return 'secondary';
      case 'GATEMAN':
        return 'outline';
      case 'CHEF':
        return 'outline';
      case 'SUPER_ADMIN':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl">User Management</h1>
          <p className="text-muted-foreground">Manage all system users</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={async () => {
            try {
              const csv = await apiExportUsers();
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'users_export.csv';
              a.click();
              URL.revokeObjectURL(url);
            } catch {}
          }}>
            <Plus className="h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-6">
        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setSelectedRole('all')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setSelectedRole('STUDENT')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.students}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setSelectedRole('WARDEN')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Wardens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.wardens}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setSelectedRole('GATEMAN')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Gatemen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.gatemen}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setSelectedRole('CHEF')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Chefs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.chefs}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setSelectedRole('SUPER_ADMIN')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.admins}</div>
          </CardContent>
        </Card>
      </div>

      <HighSearch
        placeholder="Search users by hallticket, name, phone..."
        onSearch={async (q) => {
          if (!q) return setSearchResults([]);
          if (hasBackend()) {
            try {
              const users = await searchUsersLite(q, 10);
              setSearchResults(users.map(u => ({
                hallticket: u.hallticket,
                name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.hallticket,
                userId: u.id,
                room: u.roomNumber ? `${u.hostelBlock || ''}-${u.roomNumber}`.replace(/^-/,'') : undefined,
                hostel: u.hostelBlock,
                phone: u.phoneNumber,
                tags: [u.role],
              })));
              return;
            } catch {}
          }
          setSearchResults([]);
        }}
        results={searchResults}
        onSelect={(result) => console.log('Selected:', result)}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Users</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4" />
                Filters
              </Button>
              <Button variant="outline" size="sm" onClick={async () => {
                try {
                  const csv = await apiExportUsers();
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'users_export.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {}
              }}>
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <HallticketChip hallticket={user.hallticket} name={[user.firstName, user.lastName].filter(Boolean).join(' ') || user.hallticket} />
                    <div className="flex items-center gap-2">
                      <Badge variant={getRoleBadgeColor(user.role)}>
                        {user.role}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{user.phoneNumber}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <CSVImport
        open={showImport}
        onClose={() => setShowImport(false)}
        canAssignStaffRoles={true}
        onImport={async (rows: any[]) => {
          const header = ['hallticket','firstName','lastName','phoneNumber','email','roomNumber','hostelBlock','role','password'];
          const csv = [header.join(','), ...rows.map((r: any) => [
            (r.hallticket || '').toString().trim().toUpperCase(),
            r.firstName || '',
            r.lastName || '',
            (r.phoneNumber || '').toString().trim(),
            (r.email || '').toString().trim().toLowerCase(),
            r.roomNumber || '',
            r.hostelBlock || '',
            ((r.role || 'STUDENT').toString().trim().toUpperCase().replace(/[-\s]/g, '_')),
            r.password || 'changeme123']
            .map((v) => String(v).replace(/\n/g, ' ')).join(',')
          )].join('\n');
          await bulkImportUsersFromCsvText(csv);
          setShowImport(false);
          await refresh();
        }}
      />
    </div>
  );
}
