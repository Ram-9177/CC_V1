import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Loader2, UserCog, User, Phone, Mail, Shield, MapPin,
  Users2, Building2, Lock, CheckCircle2, XCircle, Key
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import type { College } from '@/types';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface TenantMini {
  id: number;
  father_name?: string;
  father_phone?: string;
  mother_name?: string;
  mother_phone?: string;
  guardian_name?: string;
  guardian_phone?: string;
  blood_group?: string;
  emergency_contact?: string;
  warden_contact?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  college_code?: string;
}

export interface EditableUser {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  name: string;
  email?: string;
  phone?: string;           // mapped from phone_number
  phone_number?: string;
  role: string;
  registration_number?: string;
  is_active: boolean;
  is_approved: boolean;
  college?: number | null;
  college_name?: string | null;
  college_code?: string | null;
  is_on_campus?: boolean;
  custom_location?: string;
  tenant?: TenantMini;
  tenant_id?: number;
}

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: EditableUser;
}

interface FormValues {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  registration_number: string;
  role: string;
  college: string;
  is_active: string;
  is_approved: string;
  is_on_campus: string;
  custom_location: string;
  // Tenant
  father_name: string;
  father_phone: string;
  mother_name: string;
  mother_phone: string;
  guardian_name: string;
  guardian_phone: string;
  blood_group: string;
  emergency_contact: string;
  warden_contact: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  // Password reset
  new_password: string;
  confirm_password: string;
}

const ROLE_OPTIONS = [
  { value: 'student',        label: 'Student' },
  { value: 'warden',         label: 'Warden' },
  { value: 'head_warden',    label: 'Head Warden' },
  { value: 'gate_security',  label: 'Gate Security' },
  { value: 'security_head',  label: 'Security Head' },
  { value: 'chef',           label: 'Chef' },
  { value: 'head_chef',      label: 'Head Chef' },
  { value: 'hr',             label: 'HR' },
  { value: 'admin',          label: 'Admin' },
  { value: 'super_admin',    label: 'Super Admin' },
];

const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];

/* ─── Field helper ───────────────────────────────────────────────────────── */

function Field({
  label, id, children, required,
}: { label: string; id?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function EditUserDialog({ open, onOpenChange, user }: EditUserDialogProps) {
  const [saving, setSaving] = useState(false);
  const [resettingPw, setResettingPw] = useState(false);
  const queryClient = useQueryClient();

  const isStudent = user.role === 'student';
  const hasTenant = !!user.tenant;

  const defaultValues: FormValues = {
    first_name: user.first_name || user.name.split(' ')[0] || '',
    last_name: user.last_name || user.name.split(' ').slice(1).join(' ') || '',
    email: user.email || '',
    phone_number: user.phone_number || user.phone || '',
    registration_number: user.registration_number || user.username || '',
    role: user.role || 'student',
    college: user.college?.toString() || '',
    is_active: user.is_active ? 'true' : 'false',
    is_approved: user.is_approved ? 'true' : 'false',
    is_on_campus: user.is_on_campus ? 'true' : 'false',
    custom_location: user.custom_location || '',
    father_name: user.tenant?.father_name || '',
    father_phone: user.tenant?.father_phone || '',
    mother_name: user.tenant?.mother_name || '',
    mother_phone: user.tenant?.mother_phone || '',
    guardian_name: user.tenant?.guardian_name || '',
    guardian_phone: user.tenant?.guardian_phone || '',
    blood_group: user.tenant?.blood_group || '',
    emergency_contact: user.tenant?.emergency_contact || '',
    warden_contact: user.tenant?.warden_contact || '',
    address: user.tenant?.address || '',
    city: user.tenant?.city || '',
    state: user.tenant?.state || '',
    pincode: user.tenant?.pincode || '',
    new_password: '',
    confirm_password: '',
  };

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<FormValues>({ defaultValues });

  useEffect(() => {
    if (open) reset(defaultValues);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  const { data: colleges = [] } = useQuery<College[]>({
    queryKey: ['colleges'],
    queryFn: async () => {
      const res = await api.get('/colleges/colleges/');
      return res.data.results || res.data;
    },
  });

  const watchedRole = watch('role');
  const watchedIsOnCampus = watch('is_on_campus');
  const watchedCollege = watch('college');
  const watchedBloodGroup = watch('blood_group');

  /* ── Submit ── */
  const onSubmit = async (data: FormValues) => {
    setSaving(true);
    try {
      // 1. Patch core user fields
      await api.patch(`/auth/users/${user.id}/`, {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone_number: data.phone_number,
        registration_number: data.registration_number,
        role: data.role,
        college: data.college ? parseInt(data.college) : null,
        is_active: data.is_active === 'true',
        is_approved: data.is_approved === 'true',
        is_on_campus: data.is_on_campus === 'true',
        custom_location: data.custom_location,
      });

      // 2. Patch tenant if applicable
      if (hasTenant && user.tenant) {
        await api.patch(`/users/tenants/${user.tenant.id}/`, {
          father_name: data.father_name,
          father_phone: data.father_phone,
          mother_name: data.mother_name,
          mother_phone: data.mother_phone,
          guardian_name: data.guardian_name,
          guardian_phone: data.guardian_phone,
          blood_group: data.blood_group,
          emergency_contact: data.emergency_contact,
          warden_contact: data.warden_contact,
          address: data.address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
        });
      }

      toast.success(`Updated ${user.name} successfully`);
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to save changes'));
    } finally {
      setSaving(false);
    }
  };

  /* ── Password Reset ── */
  const handlePasswordReset = async () => {
    const pw = watch('new_password');
    const cpw = watch('confirm_password');
    if (!pw || pw.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (pw !== cpw) {
      toast.error('Passwords do not match');
      return;
    }
    setResettingPw(true);
    try {
      await api.post(`/auth/users/${user.id}/admin_reset_password/`, { new_password: pw });
      toast.success('Password reset successfully');
      setValue('new_password', '');
      setValue('confirm_password', '');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Password reset failed'));
    } finally {
      setResettingPw(false);
    }
  };

  /* ── Render ── */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[92dvh] overflow-hidden p-0 border-0 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white border-b px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0">
            <UserCog className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-black tracking-tight">Edit User</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {user.name} · <span className="font-mono">{user.username}</span>
                <Badge className="ml-2 text-[9px] font-black uppercase" variant="outline">{user.role}</Badge>
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <Badge className={`text-[9px] font-black ${user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {user.is_active ? 'Active' : 'Inactive'}
            </Badge>
            {!user.is_approved && (
              <Badge className="text-[9px] font-black bg-amber-100 text-amber-700">Pending Approval</Badge>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full overflow-hidden">
          <Tabs defaultValue="personal" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-6 mt-4 mb-2 bg-slate-100 rounded-xl p-1 shrink-0 w-auto self-start">
              <TabsTrigger value="personal" className="rounded-lg text-xs font-bold gap-1.5">
                <User className="h-3.5 w-3.5" /> Personal
              </TabsTrigger>
              <TabsTrigger value="account" className="rounded-lg text-xs font-bold gap-1.5">
                <Shield className="h-3.5 w-3.5" /> Account
              </TabsTrigger>
              {isStudent && hasTenant && (
                <TabsTrigger value="family" className="rounded-lg text-xs font-bold gap-1.5">
                  <Users2 className="h-3.5 w-3.5" /> Family
                </TabsTrigger>
              )}
              <TabsTrigger value="address" className="rounded-lg text-xs font-bold gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Address
              </TabsTrigger>
              <TabsTrigger value="security" className="rounded-lg text-xs font-bold gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Security
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-0">

              {/* ── PERSONAL TAB ── */}
              <TabsContent value="personal" className="space-y-5 mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="First Name" id="first_name" required>
                    <Input id="first_name" {...register('first_name', { required: 'Required' })}
                      className="h-10 rounded-lg bg-slate-50 border-slate-200 font-medium text-sm" />
                    {errors.first_name && <p className="text-[10px] text-red-500 mt-0.5">{errors.first_name.message}</p>}
                  </Field>
                  <Field label="Last Name" id="last_name" required>
                    <Input id="last_name" {...register('last_name', { required: 'Required' })}
                      className="h-10 rounded-lg bg-slate-50 border-slate-200 font-medium text-sm" />
                    {errors.last_name && <p className="text-[10px] text-red-500 mt-0.5">{errors.last_name.message}</p>}
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Email" id="email" required>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input id="email" type="email" {...register('email', { required: 'Required' })}
                        className="h-10 rounded-lg bg-slate-50 border-slate-200 font-medium text-sm pl-9" />
                    </div>
                    {errors.email && <p className="text-[10px] text-red-500 mt-0.5">{errors.email.message}</p>}
                  </Field>
                  <Field label="Phone Number" id="phone" required>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input id="phone" {...register('phone_number', { required: 'Required' })}
                        className="h-10 rounded-lg bg-slate-50 border-slate-200 font-medium text-sm pl-9" />
                    </div>
                    {errors.phone_number && <p className="text-[10px] text-red-500 mt-0.5">{errors.phone_number.message}</p>}
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Registration / Hall Ticket No." id="reg_no" required>
                    <Input id="reg_no" {...register('registration_number', { required: 'Required' })}
                      className="h-10 rounded-lg bg-slate-50 border-slate-200 font-mono text-sm" />
                    {errors.registration_number && <p className="text-[10px] text-red-500 mt-0.5">{errors.registration_number.message}</p>}
                  </Field>
                  <Field label="College" id="college">
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 z-10" />
                      <Select value={watchedCollege} onValueChange={(v) => setValue('college', v)}>
                        <SelectTrigger className="h-10 rounded-lg bg-slate-50 border-slate-200 text-sm font-medium pl-9">
                          <SelectValue placeholder="Select College" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="none" className="text-sm rounded-lg">No College</SelectItem>
                          {colleges.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()} className="text-sm rounded-lg">{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </Field>
                </div>

                {/* Blood group — only for students */}
                {isStudent && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Blood Group">
                      <Select value={watchedBloodGroup} onValueChange={(v) => setValue('blood_group', v)}>
                        <SelectTrigger className="h-10 rounded-lg bg-slate-50 border-slate-200 text-sm font-medium">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {BLOOD_GROUPS.map((g) => (
                            <SelectItem key={g} value={g} className="text-sm rounded-lg">{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Emergency Contact">
                      <Input {...register('emergency_contact')}
                        className="h-10 rounded-lg bg-slate-50 border-slate-200 font-mono text-sm" />
                    </Field>
                  </div>
                )}
              </TabsContent>

              {/* ── ACCOUNT TAB ── */}
              <TabsContent value="account" className="space-y-5 mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Role" id="role" required>
                    <Select value={watchedRole} onValueChange={(v) => setValue('role', v)}>
                      <SelectTrigger className="h-10 rounded-lg bg-slate-50 border-slate-200 text-sm font-medium">
                        <SelectValue placeholder="Select Role" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r.value} value={r.value} className="text-sm rounded-lg">{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Username (Hall Ticket)">
                    <Input value={user.username} disabled
                      className="h-10 rounded-lg bg-slate-100 border-slate-200 font-mono text-sm opacity-60 cursor-not-allowed" />
                    <p className="text-[9px] text-muted-foreground mt-0.5">Username cannot be changed</p>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Account Status" required>
                    <Select value={watch('is_active')} onValueChange={(v) => setValue('is_active', v)}>
                      <SelectTrigger className="h-10 rounded-lg bg-slate-50 border-slate-200 text-sm font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="true" className="text-sm rounded-lg text-emerald-700 font-bold">
                          <span className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" /> Active</span>
                        </SelectItem>
                        <SelectItem value="false" className="text-sm rounded-lg text-red-600 font-bold">
                          <span className="flex items-center gap-2"><XCircle className="h-3.5 w-3.5" /> Inactive</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Approval Status" required>
                    <Select value={watch('is_approved')} onValueChange={(v) => setValue('is_approved', v)}>
                      <SelectTrigger className="h-10 rounded-lg bg-slate-50 border-slate-200 text-sm font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="true" className="text-sm rounded-lg text-emerald-700 font-bold">
                          <span className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" /> Approved</span>
                        </SelectItem>
                        <SelectItem value="false" className="text-sm rounded-lg text-amber-600 font-bold">
                          <span className="flex items-center gap-2"><XCircle className="h-3.5 w-3.5" /> Pending</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {/* Campus Presence */}
                <div className="border border-slate-100 rounded-xl p-4 space-y-3 bg-slate-50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Campus Presence</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">Staying on Campus?</p>
                      <p className="text-[10px] text-muted-foreground">Enable if student lives in hostel</p>
                    </div>
                    <Select value={watchedIsOnCampus} onValueChange={(v) => setValue('is_on_campus', v)}>
                      <SelectTrigger className="h-9 w-28 rounded-lg bg-white border-slate-200 text-sm font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="true" className="text-sm">Yes</SelectItem>
                        <SelectItem value="false" className="text-sm">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {watchedIsOnCampus === 'true' && (
                    <Field label="Custom Location (optional)">
                      <Input {...register('custom_location')} placeholder="e.g. Rehab, Guest House"
                        className="h-10 rounded-lg bg-white border-slate-200 text-sm" />
                    </Field>
                  )}
                </div>
              </TabsContent>

              {/* ── FAMILY TAB (students only) ── */}
              {isStudent && hasTenant && (
                <TabsContent value="family" className="space-y-5 mt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Father's Name">
                      <Input {...register('father_name')} className="h-10 rounded-lg bg-slate-50 border-slate-200 text-sm font-medium" />
                    </Field>
                    <Field label="Father's Phone">
                      <Input {...register('father_phone')} className="h-10 rounded-lg bg-slate-50 border-slate-200 text-sm font-mono" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Mother's Name">
                      <Input {...register('mother_name')} className="h-10 rounded-lg bg-slate-50 border-slate-200 text-sm font-medium" />
                    </Field>
                    <Field label="Mother's Phone">
                      <Input {...register('mother_phone')} className="h-10 rounded-lg bg-slate-50 border-slate-200 text-sm font-mono" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Guardian's Name">
                      <Input {...register('guardian_name')} className="h-10 rounded-lg bg-slate-50 border-slate-200 text-sm font-medium" />
                    </Field>
                    <Field label="Guardian's Phone">
                      <Input {...register('guardian_phone')} className="h-10 rounded-lg bg-slate-50 border-slate-200 text-sm font-mono" />
                    </Field>
                  </div>
                  <Field label="Warden Contact (for this student)">
                    <Input {...register('warden_contact')} className="h-10 rounded-lg bg-slate-50 border-slate-200 text-sm font-mono" />
                  </Field>
                </TabsContent>
              )}

              {/* ── ADDRESS TAB ── */}
              <TabsContent value="address" className="space-y-4 mt-2">
                <Field label="Full Address">
                  <Input {...register('address')} className="h-10 rounded-lg bg-slate-50 border-slate-200 text-sm font-medium" />
                </Field>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="City">
                    <Input {...register('city')} className="h-10 rounded-lg bg-slate-50 border-slate-200 text-sm" />
                  </Field>
                  <Field label="State">
                    <Input {...register('state')} className="h-10 rounded-lg bg-slate-50 border-slate-200 text-sm" />
                  </Field>
                  <Field label="Pincode">
                    <Input {...register('pincode')} className="h-10 rounded-lg bg-slate-50 border-slate-200 text-sm font-mono" />
                  </Field>
                </div>
              </TabsContent>

              {/* ── SECURITY TAB ── */}
              <TabsContent value="security" className="space-y-5 mt-2">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs font-black text-amber-800 flex items-center gap-2 mb-1">
                    <Key className="h-3.5 w-3.5" /> Password Reset
                  </p>
                  <p className="text-[10px] text-amber-700">
                    As super admin you can forcefully reset this user's password. The user will need to change it on next login.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="New Password">
                    <Input type="password" {...register('new_password')}
                      placeholder="Min 8 characters"
                      className="h-10 rounded-lg bg-slate-50 border-slate-200 text-sm" />
                  </Field>
                  <Field label="Confirm Password">
                    <Input type="password" {...register('confirm_password')}
                      className="h-10 rounded-lg bg-slate-50 border-slate-200 text-sm" />
                  </Field>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePasswordReset}
                  disabled={resettingPw}
                  className="w-full h-10 rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50 font-black text-xs uppercase tracking-widest"
                >
                  {resettingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Key className="h-3.5 w-3.5 mr-2" /> Reset Password Now</>}
                </Button>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Account Info</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div><span className="font-bold">User ID:</span> {user.id}</div>
                    <div><span className="font-bold">Username:</span> {user.username}</div>
                    <div><span className="font-bold">Role:</span> {user.role}</div>
                    <div><span className="font-bold">College:</span> {user.college_name || '—'}</div>
                  </div>
                </div>
              </TabsContent>
            </div>

            {/* Sticky footer */}
            <div className="shrink-0 bg-white border-t px-6 py-4 flex gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="h-10 rounded-xl font-bold text-xs text-muted-foreground uppercase tracking-widest hover:bg-slate-50 px-5"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 h-10 rounded-xl bg-primary text-white font-black uppercase tracking-widest text-xs shadow-md active:scale-95 transition-all"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save All Changes'}
              </Button>
            </div>
          </Tabs>
        </form>
      </DialogContent>
    </Dialog>
  );
}
