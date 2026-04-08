import { UseFormReturn } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { College } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/lib/store';
import { isAdmin as checkIsAdmin } from '@/lib/rbac';

export interface UserFormData {
  first_name: string;
  last_name: string;
  username: string; // Used as hall_ticket for students
  registration_number?: string;
  phone_number: string;
  email: string;
  role: string;
  is_active: boolean;
  is_on_campus: boolean;
  custom_location?: string;
  student_type?: 'hosteller' | 'day_scholar';
  department?: string;
  year?: number;
  semester?: number;
  hostel?: string;
  college?: string; // ID
  college_code?: string; // used for student create
  // Parent info (students only)
  father_name?: string;
  father_phone?: string;
  mother_name?: string;
  mother_phone?: string;
  address?: string;
  // Security
  password?: string;
  password_confirm?: string;
}

interface UnifiedUserFormProps {
  form: UseFormReturn<UserFormData>;
  isLoading: boolean;
  isEdit?: boolean;
}

const ROLE_OPTIONS = [
    { value: 'student',        label: 'Student' },
    { value: 'warden',         label: 'Warden' },
    { value: 'head_warden',    label: 'Head Warden' },
    { value: 'gate_security',  label: 'Security' },
    { value: 'security_head',  label: 'Security Head' },
    { value: 'chef',           label: 'Chef' },
    { value: 'head_chef',      label: 'Head Chef' },
    { value: 'hr',             label: 'HR' },
    { value: 'staff',          label: 'Staff' },
    { value: 'admin',          label: 'Admin' },
    { value: 'super_admin',    label: 'Super Admin' },
    { value: 'principal',      label: 'Principal' },
    { value: 'director',       label: 'Director' },
    { value: 'hod',            label: 'HOD' },
    { value: 'pd',             label: 'PD' },
    { value: 'pt',             label: 'PT' },
];

export function UnifiedUserForm({ form, isLoading, isEdit = false }: UnifiedUserFormProps) {
  const { register, watch, setValue, formState: { errors } } = form;
  const currentUser = useAuthStore((state) => state.user);
  const isSystemAdmin = checkIsAdmin(currentUser?.role);

  const selectedRole = watch('role') || 'student';
  const selectedCollege = watch('college') || watch('college_code');
  const isOnCampus = watch('is_on_campus');
  
  const isStudent = selectedRole === 'student';

  const { data: colleges = [] } = useQuery<College[]>({
    queryKey: ['colleges'],
    queryFn: async () => {
      const res = await api.get('/colleges/colleges/');
      return res.data.results || res.data;
    }
  });

  const { data: hostels = [] } = useQuery<{id: number, name: string}[]>({
    queryKey: ['hostels'],
    queryFn: async () => {
      const res = await api.get('/rooms/hostels/');
      return res.data.results || res.data;
    }
  });

  const inputClass = "rounded-sm border-0 bg-gray-50 h-11 px-4 focus-visible:ring-primary font-medium";
  const labelClass = "text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1";
  const sectionTitleClass = "text-[10px] font-black uppercase tracking-[0.2em] text-primary border-b border-primary/10 pb-1 mt-6 first:mt-0";

  return (
    <div className="space-y-6">
      {/* Identity Section */}
      <div className="space-y-4">
        <h4 className={sectionTitleClass}>Identity & Access</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className={labelClass}>First Name *</Label>
            <Input {...register('first_name', { required: 'Required' })} disabled={isLoading} className={inputClass} />
            {errors.first_name && <p className="text-[10px] text-red-500 font-bold">{errors.first_name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Last Name *</Label>
            <Input {...register('last_name', { required: 'Required' })} disabled={isLoading} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className={labelClass}>{isStudent ? 'Hall Ticket / Roll No *' : 'Username *'}</Label>
            <Input {...register('username', { required: 'Required' })} disabled={isLoading || isEdit} className={`${inputClass} ${isEdit ? 'opacity-60' : ''}`} />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>System Role *</Label>
            <Select onValueChange={(val) => setValue('role', val)} value={selectedRole} disabled={isLoading || (!isSystemAdmin && isEdit)}>
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="Select Role" />
              </SelectTrigger>
              <SelectContent className="rounded-sm shadow-2xl border-0">
                {ROLE_OPTIONS.filter(r => isSystemAdmin || r.value === 'student').map((role) => (
                  <SelectItem key={role.value} value={role.value} className="rounded-sm">{role.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Contact Section */}
      <div className="space-y-4 pt-4 border-t border-dashed">
        <h4 className={sectionTitleClass}>Contact Details</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className={labelClass}>Email Address *</Label>
            <Input type="email" {...register('email', { required: 'Required' })} disabled={isLoading} className={inputClass} />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Phone Number *</Label>
            <Input {...register('phone_number', { required: 'Required' })} disabled={isLoading} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Institutional Section */}
      <div className="space-y-4 pt-4 border-t border-dashed">
        <h4 className={sectionTitleClass}>Affiliation</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className={labelClass}>College *</Label>
            <Select onValueChange={(val) => {
                setValue('college', val);
                setValue('college_code', colleges.find(c => c.id.toString() === val)?.code);
            }} value={selectedCollege} disabled={isLoading}>
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="Select College" />
              </SelectTrigger>
              <SelectContent className="rounded-sm shadow-2xl border-0">
                {colleges.map((college) => (
                  <SelectItem key={college.id} value={college.id.toString()} className="rounded-sm">{college.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isStudent && (
             <div className="space-y-2">
                <Label className={labelClass}>Department</Label>
                <Input {...register('department')} disabled={isLoading} className={inputClass} placeholder="e.g. CSE" />
             </div>
          )}
        </div>
        
        {isStudent && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
             <div className="space-y-2">
                <Label className={labelClass}>Residency Type</Label>
                <Select onValueChange={(val: 'hosteller' | 'day_scholar') => setValue('student_type', val)} value={watch('student_type')}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Hosteller" />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm border-0 bg-white shadow-2xl">
                    <SelectItem value="hosteller">Hosteller</SelectItem>
                    <SelectItem value="day_scholar">Day Scholar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
             <div className="space-y-2">
                <Label className={labelClass}>Department</Label>
                <Input {...register('department')} disabled={isLoading} className={inputClass} placeholder="e.g. CSE" />
             </div>
             <div className="space-y-2">
                <Label className={labelClass}>Year</Label>
                <Select onValueChange={(val) => setValue('year', Number(val))} value={watch('year')?.toString()} disabled={isLoading}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm border-0 bg-white shadow-2xl">
                    {[1,2,3,4,5].map(y => (
                      <SelectItem key={y} value={y.toString()}>{y}{y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} Year</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
             </div>
             <div className="space-y-2">
                <Label className={labelClass}>Semester</Label>
                <Select onValueChange={(val) => setValue('semester', Number(val))} value={watch('semester')?.toString()} disabled={isLoading}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Select Sem" />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm border-0 bg-white shadow-2xl">
                    {[1,2,3,4,5,6,7,8,9,10].map(s => (
                      <SelectItem key={s} value={s.toString()}>Semester {s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
             </div>
          </div>
        )}
        
        {['warden', 'chef', 'gate_security'].some(r => selectedRole.includes(r)) && (
            <div className="space-y-2">
              <Label className={labelClass}>Assigned Hostel</Label>
              <Select onValueChange={(val) => setValue('hostel', val)} value={watch('hostel')} disabled={isLoading}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="Select Hostel" />
                </SelectTrigger>
                <SelectContent className="rounded-sm border-0">
                  {hostels.map((h) => (
                    <SelectItem key={h.id} value={h.id.toString()}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
        )}
      </div>

      {/* Campus Presence (Students & Staff) */}
      <div className="space-y-4 pt-4 border-t border-dashed">
        <h4 className={sectionTitleClass}>Campus Presence</h4>
        <div className="flex items-center justify-between p-4 rounded-sm bg-gray-50 border border-gray-100">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold">Staying on Campus?</Label>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Required for hostel allocation</p>
            </div>
            <input type="checkbox" {...register('is_on_campus')} className="w-10 h-10 accent-primary cursor-pointer" />
        </div>
        {isOnCampus && (
            <div className="space-y-2">
              <Label className={labelClass}>Custom Location (if any)</Label>
              <Input {...register('custom_location')} placeholder="e.g. Rehab, Guest House" disabled={isLoading} className={inputClass} />
            </div>
        )}
      </div>

      {/* Parent Info (Students) */}
      {isStudent && (
        <div className="space-y-4 pt-4 border-t border-dashed">
          <h4 className={sectionTitleClass}>Parent Details</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={labelClass}>Father's Name *</Label>
              <Input {...register('father_name')} disabled={isLoading} className={inputClass} />
            </div>
            <div className="space-y-2">
              <Label className={labelClass}>Father's Phone *</Label>
              <Input {...register('father_phone')} disabled={isLoading} className={inputClass} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Permanent Address *</Label>
            <Input {...register('address')} disabled={isLoading} className={inputClass} />
          </div>
        </div>
      )}

      {/* Password reset for Add Only */}
      {!isEdit && (
        <div className="space-y-4 pt-4 border-t border-dashed">
          <h4 className={sectionTitleClass}>Security</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={labelClass}>Password *</Label>
              <Input type="password" {...register('password', { required: 'Required', minLength: 8 })} disabled={isLoading} className={inputClass} />
            </div>
            <div className="space-y-2">
              <Label className={labelClass}>Confirm *</Label>
              <Input type="password" {...register('password_confirm', { required: 'Required' })} disabled={isLoading} className={inputClass} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
