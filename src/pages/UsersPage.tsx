import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';

interface Tenant {
  id: number;
  guardian_name?: string;
  guardian_phone?: string;
  emergency_contact?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  created_at: string;
  user: {
    id: number;
    name: string;
    hall_ticket?: string;
    username: string;
    role: string;
    registration_number?: string;
    phone?: string;
  };
}

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: tenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ['tenants'],
    queryFn: async () => {
      const response = await api.get('/users/tenants/');
      return response.data.results || response.data;
    },
  });

  const filteredTenants = useMemo(() => {
    if (!tenants) return [];
    if (!searchQuery) return tenants;
    const term = searchQuery.toLowerCase();
    return tenants.filter((tenant) =>
      [
        tenant.user?.name,
        tenant.user?.hall_ticket,
        tenant.user?.username,
        tenant.user?.registration_number,
        tenant.city,
        tenant.state,
      ].some((value) => value?.toLowerCase().includes(term))
    );
  }, [tenants, searchQuery]);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="h-8 w-8" />
          Tenants
        </h1>
        <p className="text-muted-foreground">View tenant profiles and guardians</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, hall ticket, or registration number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading tenants...</div>
          ) : filteredTenants.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Guardian</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <div className="font-medium">{tenant.user?.name || tenant.user?.username}</div>
                        <div className="text-sm text-muted-foreground">
                          Hall Ticket: {tenant.user?.hall_ticket || tenant.user?.username}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Reg: {tenant.user?.registration_number || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div>{tenant.user?.phone || '—'}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div>{tenant.guardian_name || '—'}</div>
                        <div>{tenant.guardian_phone || ''}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div>{tenant.address || '—'}</div>
                        <div>{tenant.city || ''}{tenant.state ? `, ${tenant.state}` : ''}</div>
                        <div>{tenant.pincode || ''}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No tenants found</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
