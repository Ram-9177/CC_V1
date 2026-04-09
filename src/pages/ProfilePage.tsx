import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Home, Lock, Edit2, Download, ChevronDown, Building2, DoorOpen } from 'lucide-react';
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
import { isTopLevelManagement, isWarden } from '@/lib/rbac';
import { DigitalCard } from '@/components/profile/DigitalCard';
import { Role, GatePass, User as UserType } from '@/types';
import { useRealtimeQuery } from '@/hooks/useWebSocket';

interface UserProfile {
  id: string | number;
  username: string;
  email: string;
  hall_ticket?: string;
  name: string;
  phone?: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  room?: {
    id: number;
    room_number: string;
    floor: number;
    room_type: string;
    building: string;
  };
  college?: {
    id: number;
    name: string;
  };
  date_joined: string;
  last_login?: string;
  year?: number;
  semester?: number;
  risk_status?: 'low' | 'medium' | 'high' | 'critical' | null;
  risk_score?: number;
}

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [mobileEditOpen, setMobileEditOpen] = useState(false);
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
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();
  const canManageUsers = isTopLevelManagement(user?.role);
  const isStudent = user?.role === 'student';

  const storeUser = useAuthStore((s) => s.user);
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: async () => {
      // Use the proper auth profile endpoint that returns the complete user structure
      const response = await api.get('/auth/profile/');
      return response.data;
    },
    initialData: storeUser ? {
      id: storeUser.id,
      name: [storeUser.first_name, storeUser.last_name].filter(Boolean).join(' '),
      hall_ticket: storeUser.registration_number || storeUser.hall_ticket,
      phone: storeUser.phone,
      role: storeUser.role || 'student',
      room: storeUser.room_number ? { id: 0, room_number: storeUser.room_number, floor: 0, room_type: '', building: '' } : undefined,
      college: typeof storeUser.college === 'object' && storeUser.college ? storeUser.college : storeUser.college ? { id: 0, name: String(storeUser.college) } : undefined,
      date_joined: '',
    } as unknown as UserProfile : undefined,
    staleTime: 1000 * 30,
  });

  const { data: activeGatePass } = useQuery<GatePass | null>({
    queryKey: ['active-gate-pass', storeUser?.id],
    queryFn: async () => {
      const response = await api.get('/gate-passes/active_pass/');
      return response.data;
    },
    enabled: isStudent,
    staleTime: 1000 * 60,
  });

  useRealtimeQuery(
    ['gate_pass_status_changed', 'gatepass_updated', 'gate_pass_updated'],
    [['active-gate-pass', storeUser?.id], ['profile']]
  );

  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.name?.split(' ')[0] || storeUser?.first_name || '',
        last_name: profile.name?.split(' ').slice(1).join(' ') || storeUser?.last_name || '',
        phone: profile.phone || '',
      });
    }
  }, [profile, storeUser]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const allowPhoneUpdate =
        isWarden(user?.role) || isTopLevelManagement(user?.role) || user?.role === 'admin';
      const payload: Record<string, string> = {
        first_name: data.first_name,
        last_name: data.last_name,
      };
      if (allowPhoneUpdate && data.phone.trim()) {
        payload.phone_number = data.phone.trim();
      }
      const response = await api.patch(`/auth/users/${profile?.id}/`, payload);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setUser(data);
      toast.success('Profile updated successfully');
      setIsEditing(false);
    },
    onError: (error: unknown) => {
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
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    },
    onError: (error: unknown) => {
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
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'CSV upload failed'));
    },
  });

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordData.new_password) {
      toast.error('Please enter a new password');
      return;
    }
    // Automatically use new_password as confirm_password to simplify UI
    const payload = {
      ...passwordData,
      confirm_password: passwordData.new_password,
    };
    changePasswordMutation.mutate(payload);
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/auth/users/download_template/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'student_upload_template.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
       toast.error('Failed to download template');
    }
  };

    const displayName = profile?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '—';
  const initials = displayName.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || 'U';
  const hallTicket = profile?.hall_ticket?.toUpperCase() || storeUser?.registration_number?.toUpperCase();

  const canEditPhone = isWarden(user?.role) || isTopLevelManagement(user?.role) || user?.role === 'admin';
  const canEditNames = !isStudent || !hallTicket;

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB.');
      return;
    }

    const formData = new FormData();
    formData.append('profile_picture', file);

    setIsUploadingPhoto(true);
    try {
      const response = await api.post('/auth/users/update_profile_picture/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const updatedUser: UserType = {
        ...(storeUser as UserType),
        profile_picture: response.data.profile_picture
      };
      
      setUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Display picture updated');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Upload failed'));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  return (
    <div className="page-frame max-w-4xl pb-14 sm:pb-16">
      {/* ── MOBILE VIEW ── */}
      <div className="md:hidden stack-relaxed">
        <div className="flex items-center justify-between px-1">
          <div>
            <h1 className="page-title">{isStudent ? 'Digital Identity' : 'My Profile'}</h1>
            <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">SMG Institutional Protocol</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black border border-slate-200">
            {initials}
          </div>
        </div>

        <div className="flex flex-col items-center">
          {profile && (
            <DigitalCard 
              user={profile as unknown as UserType} 
              gatePass={activeGatePass} 
              isUploading={isUploadingPhoto}
              onUploadClick={handleUploadClick}
            />
          )}
        </div>

        <div className="space-y-3">
           <Button
            variant="outline"
            className="w-full rounded-xl h-12 font-black flex items-center justify-between px-4 border border-slate-200 shadow-none active:scale-[0.98] transition-all"
            onClick={() => setMobileEditOpen(!mobileEditOpen)}
          >
            <span className="flex items-center gap-3">
              <div className="p-2 bg-secondary/50 rounded-xl">
                 <Edit2 className="h-4 w-4" />
              </div>
              Account Settings
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${mobileEditOpen ? 'rotate-180' : ''}`} />
          </Button>

          {mobileEditOpen && (
            <div className="space-y-3 animate-in fade-in duration-500">
               <Card className="rounded-xl border border-slate-200 bg-white shadow-none overflow-hidden">
                <CardHeader className="pb-2 border-b border-dashed border-border/50">
                   <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <User className="h-4 w-4" /> Personal Profile
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest ml-1">First Name</Label>
                      <Input
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        className="h-12 rounded-sm text-sm font-bold bg-muted/30 border-0"
                        readOnly={!canEditNames}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Last Name</Label>
                      <Input
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        className="h-12 rounded-sm text-sm font-bold bg-muted/30 border-0"
                        readOnly={!canEditNames}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1 flex items-center justify-between">
                      Mobile Number
                      {!canEditPhone && <span className="text-[8px] text-rose-500 font-bold bg-rose-50 px-2 py-0.5 rounded-sm border border-rose-100 uppercase">System Locked</span>}
                    </Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      disabled={!canEditPhone}
                      className="h-12 rounded-sm text-sm font-bold bg-muted/30 border-0"
                    />
                  </div>
                  
                  {isStudent && storeUser?.tenant && (
                    <div className="pt-3 mt-1 border-t border-dashed border-border/50 space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Guardian & Official Info</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Father Name</Label>
                          <p className="text-xs font-bold text-slate-800 bg-muted/20 px-3 py-2 rounded-sm">{storeUser.tenant.father_name || '—'}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Father Phone</Label>
                          <p className="text-xs font-bold text-slate-800 bg-muted/20 px-3 py-2 rounded-sm">{storeUser.tenant.father_phone || '—'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Blood Group</Label>
                          <p className="text-xs font-bold text-slate-800 bg-muted/20 px-3 py-2 rounded-sm">{storeUser.tenant.blood_group || '—'}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Emergency</Label>
                          <p className="text-xs font-bold text-slate-800 bg-muted/20 px-3 py-2 rounded-sm">{storeUser.tenant.emergency_contact || '—'}</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Permanent Address</Label>
                        <p className="text-xs font-bold text-slate-800 bg-muted/20 px-3 py-2 rounded-sm text-balance leading-relaxed">
                          {storeUser.tenant.address || '—'}
                          {storeUser.tenant.city && `, ${storeUser.tenant.city}`}
                          {storeUser.tenant.pincode && ` - ${storeUser.tenant.pincode}`}
                        </p>
                      </div>
                      <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest text-center mt-2 bg-rose-50 p-2 rounded-sm">🔒 Contact Warden to update these details</p>
                    </div>
                  )}
                  <Button
                    className="w-full rounded-xl h-11 font-black primary-gradient text-white shadow-none"
                    onClick={handleUpdateProfile}
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? 'SYNCHRONIZING...' : 'UPDATE PROFILE'}
                  </Button>
                </CardContent>
              </Card>

               <Card className="rounded-xl border border-slate-200 bg-[#0F172A] text-white shadow-none overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                    <Lock className="h-4 w-4" /> Security Protocol
                  </h3>
                  <form onSubmit={handleChangePassword} className="space-y-3">
                    <Input
                      type="password"
                      placeholder="Current password"
                      value={passwordData.current_password}
                      onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                      className="h-12 rounded-sm text-sm font-bold bg-white/5 border-0"
                      required
                    />
                    <Input
                      type="password"
                      placeholder="New password"
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                      className="h-12 rounded-sm text-sm font-bold bg-white/5 border-0"
                      required
                    />
                    <Button type="submit" className="w-full rounded-xl h-11 font-black bg-primary text-white shadow-none" disabled={changePasswordMutation.isPending}>
                      {changePasswordMutation.isPending ? 'PROCESSING...' : 'UPDATE PASSWORD'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* ── DESKTOP VIEW ── */}
      <div className="hidden md:flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="page-title flex items-center gap-3">
              <User className="h-10 w-10 text-primary" />
              Institutional Profile
            </h1>
            <p className="page-lead">Manage your identity and security settings</p>
          </div>
          <div className="flex gap-3">
             <Badge variant="outline" className="px-4 py-2 rounded-sm border-primary/20 bg-primary/5 text-primary font-black uppercase tracking-widest text-[10px]">
                Active Session
             </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
           <div className="lg:col-span-2 flex flex-col items-center gap-4">
              {profile && (
                <DigitalCard 
                  user={profile as unknown as UserType} 
                  gatePass={activeGatePass} 
                  isUploading={isUploadingPhoto}
                  onUploadClick={handleUploadClick}
                />
              )}
              <p className="text-xs text-muted-foreground text-center max-w-[280px] font-medium leading-relaxed">
                Your Digital ID is your primary credential within the SMG CampusCore Network. Keep your profile updated for seamless gate verification.
              </p>
           </div>

           <div className="lg:col-span-3">
              <Tabs defaultValue="profile" className="w-full space-y-4">
                <TabsList className="grid w-full grid-cols-2 h-12">
                  <TabsTrigger value="profile" className="rounded-lg font-black text-xs uppercase tracking-widest">Personal Details</TabsTrigger>
                  <TabsTrigger value="security" className="rounded-lg font-black text-xs uppercase tracking-widest">Security & Tools</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-4">
                   <Card className="rounded-xl border border-slate-200 shadow-none overflow-hidden">
                      <CardHeader className="bg-muted/10 border-b border-border/40 py-4">
                        <div className="flex justify-between items-center">
                           <CardTitle className="text-xl font-black">Identity Information</CardTitle>
                           {!isEditing ? (
                              <Button variant="outline" size="sm" className="rounded-xl font-bold" onClick={() => setIsEditing(true)}>
                                <Edit2 className="h-4 w-4 mr-2" /> Edit Info
                              </Button>
                           ) : (
                              <div className="flex gap-2">
                                <Button variant="ghost" size="sm" className="rounded-xl font-bold" onClick={() => setIsEditing(false)}>Cancel</Button>
                                <Button size="sm" className="rounded-xl font-bold shadow-none" onClick={handleUpdateProfile}>Save Changes</Button>
                              </div>
                           )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-5 space-y-5">
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                               <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">First name</Label>
                               <Input 
                                  value={formData.first_name} 
                                  onChange={e => setFormData({...formData, first_name: e.target.value})}
                                  disabled={!isEditing || !canEditNames}
                                  className="h-12 rounded-sm bg-muted/20 border-0 font-bold"
                               />
                            </div>
                            <div className="space-y-2">
                               <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Last name</Label>
                               <Input 
                                  value={formData.last_name} 
                                  onChange={e => setFormData({...formData, last_name: e.target.value})}
                                  disabled={!isEditing || !canEditNames}
                                  className="h-12 rounded-sm bg-muted/20 border-0 font-bold"
                               />
                            </div>
                         </div>
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Contact Number</Label>
                            <Input 
                               value={formData.phone} 
                               onChange={e => setFormData({...formData, phone: e.target.value})}
                               disabled={!isEditing || !canEditPhone}
                               className="h-12 rounded-sm bg-muted/20 border-0 font-bold"
                            />
                         </div>

                         {isStudent && storeUser?.tenant && (
                            <div className="pt-5 border-t border-slate-100 space-y-4">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Guardian & Official Documentation</h4>
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Father Name</Label>
                                  <p className="h-12 flex items-center px-4 rounded-sm bg-muted/10 font-bold border border-border/20">{storeUser.tenant.father_name || '—'}</p>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Father Phone</Label>
                                  <p className="h-12 flex items-center px-4 rounded-sm bg-muted/10 font-bold border border-border/20">{storeUser.tenant.father_phone || '—'}</p>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Blood Group</Label>
                                  <p className="h-12 flex items-center px-4 rounded-sm bg-muted/10 font-bold border border-border/20">{storeUser.tenant.blood_group || '—'}</p>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Emergency Number</Label>
                                  <p className="h-12 flex items-center px-4 rounded-sm bg-muted/10 font-bold border border-border/20">{storeUser.tenant.emergency_contact || '—'}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Permanent Address</Label>
                                  <p className="p-4 rounded-sm bg-muted/10 font-bold border border-border/20 text-balance min-h-[4rem]">
                                    {storeUser.tenant.address || '—'}
                                    {storeUser.tenant.city && `, ${storeUser.tenant.city}`}
                                    {storeUser.tenant.pincode && ` - ${storeUser.tenant.pincode}`}
                                  </p>
                                </div>
                                <div className="flex flex-col justify-end pb-2">
                                  <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 flex items-center gap-3 w-full">
                                    <Lock className="w-5 h-5 text-rose-500 flex-shrink-0" />
                                    <p className="text-xs font-bold text-rose-600 leading-tight">These official details are locked. Please contact your Warden or Administration to update.</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                         )}


                         {isStudent && (
                            <div className="pt-5 border-t border-dashed border-border flex flex-wrap gap-6 mb-4">
                               <div className="space-y-1">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Department</p>
                                  <p className="font-black flex items-center gap-2">{storeUser?.department || '—'}</p>
                               </div>
                               <div className="space-y-1">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Academic Year</p>
                                  <p className="font-black flex items-center gap-2">{profile?.year || storeUser?.year || '—'}{profile?.year || storeUser?.year ? (profile?.year === 1 ? 'st' : profile?.year === 2 ? 'nd' : profile?.year === 3 ? 'rd' : 'th') : ''} Year</p>
                               </div>
                               <div className="space-y-1">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current Semester</p>
                                  <p className="font-black flex items-center gap-2">Semester {profile?.semester || storeUser?.semester || '—'}</p>
                               </div>
                            </div>
                         )}

                         {profile?.room && (
                            <div className="pt-5 border-t border-dashed border-border flex flex-wrap gap-6">
                               <div className="space-y-1">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Placement</p>
                                  <p className="font-black flex items-center gap-2"><Home className="h-4 w-4 text-primary" /> Room {profile.room.room_number}</p>
                               </div>
                               <div className="space-y-1">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Structure</p>
                                  <p className="font-black flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> {profile.room.building || 'Main Block'}</p>
                               </div>
                               <div className="space-y-1">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Level</p>
                                  <p className="font-black flex items-center gap-2"><DoorOpen className="h-4 w-4 text-primary" /> Floor {profile.room.floor}</p>
                               </div>
                            </div>
                         )}
                      </CardContent>
                   </Card>
                </TabsContent>

                <TabsContent value="security" className="space-y-4">
                   <Card className="rounded-xl border border-slate-200 shadow-none">
                      <CardHeader className="py-4 border-b border-border/40">
                         <CardTitle className="text-xl font-black">Authentication Shield</CardTitle>
                      </CardHeader>
                      <CardContent className="p-5 space-y-4">
                        <form onSubmit={handleChangePassword} className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Current Security Password</Label>
                            <Input type="password" value={passwordData.current_password} onChange={e => setPasswordData({...passwordData, current_password: e.target.value})} className="h-12 rounded-sm" required />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">New Strategic Password</Label>
                            <Input type="password" value={passwordData.new_password} onChange={e => setPasswordData({...passwordData, new_password: e.target.value})} className="h-12 rounded-sm" required />
                          </div>
                          <Button type="submit" className="w-full h-11 rounded-xl font-black primary-gradient text-white shadow-none" disabled={changePasswordMutation.isPending}>
                            {changePasswordMutation.isPending ? 'REPLACING...' : 'UPDATE CREDENTIALS'}
                          </Button>
                        </form>
                      </CardContent>
                   </Card>

                   {canManageUsers && (
                      <Card className="rounded-xl border border-slate-200 shadow-none bg-muted/5">
                        <CardHeader className="py-4 border-b border-border/40">
                           <CardTitle className="text-xl font-black flex items-center gap-3"><Download className="h-5 w-5 text-primary" /> Infrastructure Backup</CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                           <p className="text-sm text-muted-foreground font-medium text-black">Download a complete snapshot of the system database (JSON.GZ). This should only be performed over secure institutional networks.</p>
                           <Button 
                              variant="outline" 
                              className="w-full h-11 rounded-xl font-black border border-primary/20 hover:bg-primary/5 shadow-none"
                              onClick={async () => {
                                toast.info('Preparing system snapshot...');
                                try {
                                  const response = await api.get('/core/backup/download/', { responseType: 'blob' });
                                  const url = window.URL.createObjectURL(new Blob([response.data]));
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.setAttribute('download', `system_backup_${new Date().getTime()}.json.gz`);
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  window.URL.revokeObjectURL(url);
                                  toast.success('System backup successfully extracted');
                                } catch { toast.error('Backup protocol failed'); }
                              }}
                           >
                             START SYSTEM EXPORT
                           </Button>
                        </CardContent>
                      </Card>
                   )}

                   {canManageUsers && (
                      <Card className="rounded-xl border border-slate-200 shadow-none">
                        <CardHeader className="py-4 border-b border-border/40">
                           <CardTitle className="text-xl font-black">Bulk Student Enrollment</CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                           <div className="flex flex-col sm:flex-row gap-3">
                              <Button variant="outline" className="rounded-xl font-bold" onClick={handleDownloadTemplate}>Get Template</Button>
                              <Input type="file" accept=".csv" className="rounded-xl" onChange={e => setCsvFile(e.target.files?.[0] || null)} />
                              <Button disabled={!csvFile || bulkUploadMutation.isPending} className="rounded-xl font-black shadow-none" onClick={() => csvFile && bulkUploadMutation.mutate(csvFile)}>
                                {bulkUploadMutation.isPending ? 'Uploading...' : 'Upload CSV'}
                              </Button>
                           </div>
                           {uploadResult && (
                              <div className="p-3 bg-muted/30 rounded-xl text-xs font-mono border border-slate-200">
                                 <p className="font-black text-primary mb-2">UPLOAD SYNC COMPLETE</p>
                                 <p>CREATED: {uploadResult.created}</p>
                                 {uploadResult.errors.length > 0 && <p className="text-destructive mt-1">ERRORS DETECTED: {uploadResult.errors.length}</p>}
                              </div>
                           )}
                        </CardContent>
                      </Card>
                   )}
                </TabsContent>
              </Tabs>
           </div>
        </div>
      </div>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />
    </div>
  );
}
