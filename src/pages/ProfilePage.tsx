import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Home, Calendar, Lock, Edit2, Save, X, QrCode, ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

interface UserProfile {
  id: number;
  hall_ticket?: string;
  name: string;
  phone?: string;
  role: string;
  room?: {
    id: number;
    room_number: string;
    floor: number;
    room_type: string;
  };
  college?: {
    id: number;
    name: string;
  };
  date_joined: string;
  last_login?: string;
  risk_status?: 'safe' | 'warning' | 'critical' | 'blacklisted' | null;
  risk_score?: number;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
  });
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<{
    created: number;
    errors: Array<{ row: number; error: string }>;
    generated_passwords: Array<{ username: string; password: string }>;
  } | null>(null);

  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();
  const canManageUsers = ['admin', 'super_admin'].includes(user?.role || '');

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await api.get('/profile/');
      return response.data;
    },
  });

  // Update form data when profile is loaded
  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.name?.split(' ')[0] || '',
        last_name: profile.name?.split(' ').slice(1).join(' ') || '',
        phone: profile.phone || '',
      });
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Use PATCH so we don't need to send required fields like username/registration_number.
      const response = await api.patch(`/auth/users/${profile?.id}/`, {
        first_name: data.first_name,
        last_name: data.last_name,
        phone_number: data.phone,
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setUser(data);
      toast.success('Profile updated successfully');
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to update profile'));
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: typeof passwordData) => {
      await api.put('/auth/users/change_password/', {
        old_password: data.current_password,
        new_password: data.new_password,
        new_password_confirm: data.confirm_password,
      });
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to change password'));
    },
  });

  const bulkUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/auth/users/bulk_upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: (data) => {
      setUploadResult(data);
      toast.success(`Users created: ${data.created}`);
      setCsvFile(null);
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'CSV upload failed'));
    },
  });

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwordData.new_password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }
    changePasswordMutation.mutate(passwordData);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'hall_ticket',
      'first_name',
      'last_name',
      'role',
      'phone_number',
      'password',
    ];
    const csvContent = `${headers.join(',')}\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'users-template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const getRoleBadge = (role: string) => {
    const label =
      role
        ?.split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ') || 'User';

    const colors: Record<string, string> = {
      super_admin: 'bg-primary/10 text-primary border-primary/30',
      admin: 'bg-primary/10 text-primary border-primary/30',
      head_warden: 'bg-secondary text-secondary-foreground border-secondary',
      warden: 'bg-secondary text-secondary-foreground border-secondary',
      security_head: 'bg-muted/40 text-foreground border-border',
      gate_security: 'bg-muted/40 text-foreground border-border',
      chef: 'bg-muted/40 text-foreground border-border',
      staff: 'bg-muted/40 text-foreground border-border',
      student: 'bg-primary/10 text-primary border-primary/30',
    };
    return (
      <Badge variant="outline" className={colors[role] || 'bg-muted/40 text-foreground border-border'}>
        {label}
      </Badge>
    );
  };

  const formatMaybeDate = (value?: string, includeTime = false) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    if (includeTime) {
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const displayName =
    profile?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '—';
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'U';
  const hallTicket = profile?.hall_ticket?.toUpperCase();

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <User className="h-8 w-8 text-primary" />
          My Profile
        </h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      {profile ? (
        <Card className="relative overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  {initials}
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-bold leading-none">{displayName}</h2>
                    {getRoleBadge(profile.role)}
                    {profile.risk_status && profile.risk_status !== 'safe' && (
                        <Badge variant={profile.risk_status === 'critical' ? 'destructive' : 'secondary'} className="gap-1 ml-2">
                            {profile.risk_status === 'critical' ? <ShieldAlert className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                            Risk: {profile.risk_status} ({profile.risk_score || 0})
                        </Badge>
                    )}
                    {profile.risk_status === 'safe' && (
                        <Badge variant="outline" className="gap-1 ml-2 text-emerald-600 border-emerald-200 bg-emerald-50">
                            <ShieldCheck className="w-3 h-3" /> Safe
                        </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {hallTicket ? (
                      <span className="inline-flex items-center rounded-full border border-border bg-secondary/30 px-2.5 py-0.5 text-xs font-mono font-semibold tracking-widest uppercase">
                        {hallTicket}
                      </span>
                    ) : null}
                    {profile.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        {profile.phone}
                      </span>
                    ) : null}
                    {profile.room?.room_number ? (
                      <span className="inline-flex items-center gap-1">
                        <Home className="h-4 w-4" />
                        Room {profile.room.room_number}
                      </span>
                    ) : null}
                    {profile.college?.name ? (
                      <span className="truncate max-w-[260px]">{profile.college.name}</span>
                    ) : null}
                  </div>
                </div>
              </div>
              
              <Button 
                variant="outline" 
                className="hidden sm:flex gap-2 border-primary/20 text-primary hover:bg-primary/5"
                onClick={() => navigate('/digital-id')}
              >
                <QrCode className="h-4 w-4" />
                View Digital ID
              </Button>

              <div className="grid grid-cols-2 gap-4 sm:gap-6 text-sm">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Member Since
                  </p>
                  <p className="font-bold">{formatMaybeDate(profile.date_joined)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Last Login
                  </p>
                  <p className="font-bold">{formatMaybeDate(profile.last_login, true)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">Profile Information</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* Profile Information Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border">
              <CardTitle className="text-xl sm:text-2xl">Personal Information</CardTitle>
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      if (profile) {
                        setFormData({
                          first_name: profile.name?.split(' ')[0] || '',
                          last_name: profile.name?.split(' ').slice(1).join(' ') || '',
                          phone: profile.phone || '',
                        });
                      }
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleUpdateProfile}
                    disabled={updateProfileMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  Loading profile...
                </div>
              ) : profile ? (
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="first_name">First Name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="first_name"
                            value={formData.first_name}
                            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                            disabled={!isEditing}
                            className="pl-9"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last_name">Last Name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="last_name"
                            value={formData.last_name}
                            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                            disabled={!isEditing}
                            className="pl-9"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            disabled={!isEditing}
                            className="pl-9"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <div className="flex items-center h-10">
                          {getRoleBadge(profile.role)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {profile.room && (
                    <div className="pt-4 border-t">
                      <Label className="text-base font-semibold mb-3 block">Room Details</Label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <Label className="text-sm text-muted-foreground">Room Number</Label>
                          <div className="flex items-center gap-2">
                            <Home className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{profile.room.room_number}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm text-muted-foreground">Floor</Label>
                          <span className="font-medium block">Floor {profile.room.floor}</span>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm text-muted-foreground">Room Type</Label>
                          <span className="font-medium block capitalize">
                            {profile.room.room_type}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {profile.college && (
                    <div className="pt-4 border-t">
                      <Label className="text-base font-semibold mb-3 block">
                        College Information
                      </Label>
                      <div className="space-y-1">
                        <Label className="text-sm text-muted-foreground">College Name</Label>
                        <span className="font-medium block">{profile.college.name}</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <Label className="text-base font-semibold mb-3 block">Account Details</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-sm text-muted-foreground">Member Since</Label>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {formatMaybeDate(profile.date_joined)}
                          </span>
                        </div>
                      </div>
                      {profile.last_login && (
                        <div className="space-y-1">
                          <Label className="text-sm text-muted-foreground">Last Login</Label>
                          <span className="font-medium block">
                            {formatMaybeDate(profile.last_login, true)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </form>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Failed to load profile
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current_password">Current Password</Label>
                  <Input
                    id="current_password"
                    type="password"
                    value={passwordData.current_password}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, current_password: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new_password">New Password</Label>
                  <Input
                    id="new_password"
                    type="password"
                    value={passwordData.new_password}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, new_password: e.target.value })
                    }
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 8 characters long
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm_password">Confirm New Password</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    value={passwordData.confirm_password}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, confirm_password: e.target.value })
                    }
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={changePasswordMutation.isPending}
                >
                  {changePasswordMutation.isPending ? 'Changing Password...' : 'Change Password'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {canManageUsers && (
            <Card className="overflow-hidden">
              <div className="h-1 bg-primary/60" />
              <CardHeader className="bg-muted/30 border-b border-border">
                <CardTitle className="text-xl sm:text-2xl">Bulk User Upload (CSV)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Upload a CSV with user details to create login accounts.</p>
                  <p>Required columns: hall_ticket, first_name, last_name.</p>
                  <p>Optional columns: role, phone_number, password.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button type="button" variant="outline" onClick={handleDownloadTemplate}>
                    Download Template
                  </Button>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  />
                  <Button
                    type="button"
                    disabled={!csvFile || bulkUploadMutation.isPending}
                    onClick={() => csvFile && bulkUploadMutation.mutate(csvFile)}
                  >
                    {bulkUploadMutation.isPending ? 'Uploading...' : 'Upload CSV'}
                  </Button>
                </div>

                {uploadResult && (
                  <div className="space-y-3">
                    <div className="text-sm">
                      Created users: <span className="font-medium">{uploadResult.created}</span>
                    </div>

                    {uploadResult.generated_passwords?.length > 0 && (
                      <div className="text-sm">
                        <p className="font-medium">Generated passwords:</p>
                        <ul className="list-disc pl-5">
                          {uploadResult.generated_passwords.map((item) => (
                            <li key={item.username}>{item.username}: {item.password}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {uploadResult.errors?.length > 0 && (
                      <div className="text-sm text-destructive">
                        <p className="font-medium">Errors:</p>
                        <ul className="list-disc pl-5">
                          {uploadResult.errors.map((err, idx) => (
                            <li key={`${err.row}-${idx}`}>Row {err.row}: {err.error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
