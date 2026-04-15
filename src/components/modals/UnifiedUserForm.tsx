import { UseFormReturn } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { College, Building } from '@/types';
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
  assigned_hostels?: Array<number | string>;
  assigned_blocks?: Array<number | string>;
  assigned_gate_locations?: Array<number | string>;
  can_access_all_blocks?: boolean;
  assigned_floors?: number[];
  assigned_floors_by_block?: Record<string, number[]>;
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
  const selectedHostelIds = (watch('assigned_hostels') || []).map(String);
  const selectedBlockIds = (watch('assigned_blocks') || []).map(String);
  const selectedGateLocationIds = (watch('assigned_gate_locations') || []).map(String);
  const assignedFloorsByBlock = watch('assigned_floors_by_block') || {};
  
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

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['buildings', selectedCollege],
    queryFn: async () => {
      if (!selectedCollege) return [];
      const res = await api.get(`/rooms/buildings/?college=${selectedCollege}`);
      return res.data.results || res.data;
    },
    enabled: !!selectedCollege
  });

  const { data: gateLocations = [] } = useQuery<Array<{id: number; name: string; code?: string; is_active?: boolean}>>({
    queryKey: ['gate-locations', selectedCollege],
    queryFn: async () => {
      if (!selectedCollege) return [];
      const res = await api.get(`/gate-passes/locations/?college=${selectedCollege}&is_active=true`);
      return res.data.results || res.data;
    },
    enabled: !!selectedCollege && selectedRole === 'gate_security'
  });

  const inputClass = "rounded-sm border-0 bg-gray-50 h-11 px-4 focus-visible:ring-primary font-medium";
  const labelClass = "text-xs font-bold uppercase tracking-normal text-muted-foreground ml-1";
  const sectionTitleClass = "text-[10px] font-black uppercase tracking-normal text-primary border-b border-primary/10 pb-1 mt-6 first:mt-0";

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
            <Select onValueChange={(val) => {
              setValue('role', val);
              if (val !== 'gate_security') {
                setValue('assigned_gate_locations', []);
              }
            }} value={selectedRole} disabled={isLoading || (!isSystemAdmin && isEdit)}>
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="Select Role" />
              </SelectTrigger>
              <SelectContent className="rounded-sm shadow-2xl border-0">
                {ROLE_OPTIONS.filter((r) => {
                  if (isSystemAdmin) return true;
                  if (currentUser?.role === 'head_warden') return ['student', 'warden', 'hr', 'staff'].includes(r.value);
                  if (currentUser?.role === 'head_chef') return r.value === 'chef';
                  if (currentUser?.role === 'security_head') return r.value === 'gate_security';
                  return r.value === 'student';
                }).map((role) => (
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

      {/* Staff Features (Only for Non-Students) */}
      {!isStudent && (
        <div className="space-y-4 pt-4 border-t border-dashed">
          <h4 className={sectionTitleClass}>Staff Information</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={labelClass}>Department / Unit</Label>
              <Input {...register('department')} disabled={isLoading} className={inputClass} placeholder="e.g. Hostel Management" />
            </div>
            <div className="space-y-2">
              <Label className={labelClass}>Employee / Registration ID</Label>
              <Input {...register('registration_number')} disabled={isLoading} className={inputClass} placeholder="Optional" />
            </div>
          </div>
        </div>
      )}

      {/* Institutional Section */}
      <div className="space-y-4 pt-4 border-t border-dashed">
        <h4 className={sectionTitleClass}>Affiliation</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className={labelClass}>College *</Label>
            <Select onValueChange={(val) => {
                setValue('college', val);
                setValue('college_code', colleges.find(c => c.id.toString() === val)?.code);
            }} value={selectedCollege} disabled={isLoading || !isSystemAdmin}>
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
          {isStudent && (
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
        
        {/* Multi-Hostel Assignment (Head Warden / Custom Roles) */}
        {['head_warden', 'warden', 'chef', 'gate_security'].includes(selectedRole) && (
            <div className="space-y-4 pt-4">
              <h4 className={sectionTitleClass}>Hostel Assignment</h4>
              <div className="space-y-2">
                <Label className={labelClass}>Assigned Hostels *</Label>
                <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50 rounded-sm border max-h-[160px] overflow-y-auto">
                  {hostels.map((h) => (
                    <div key={h.id} className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id={`hostel-${h.id}`}
                        checked={selectedHostelIds.includes(String(h.id))}
                        onChange={(e) => {
                          const current = watch('assigned_hostels') || [];
                          if (e.target.checked) {
                            setValue('assigned_hostels', [...current, h.id]);
                          } else {
                            setValue('assigned_hostels', current.filter(id => String(id) !== String(h.id)));
                          }
                        }}
                        className="w-4 h-4 rounded text-primary border-gray-300 focus:ring-primary"
                      />
                      <label htmlFor={`hostel-${h.id}`} className="text-sm font-medium cursor-pointer truncate">
                        {h.name}
                      </label>
                    </div>
                  ))}
                  {hostels.length === 0 && (
                    <p className="text-[10px] text-muted-foreground uppercase font-bold italic col-span-2 text-center py-2">
                      No hostels found
                    </p>
                  )}
                </div>
              </div>
            </div>
        )}

        {selectedRole === 'gate_security' && (
          <div className="space-y-4 pt-4">
            <h4 className={sectionTitleClass}>Gate Location Assignment</h4>
            <div className="space-y-2">
              <Label className={labelClass}>Assigned Gate Locations</Label>
              <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50 rounded-sm border max-h-[160px] overflow-y-auto">
                {gateLocations.map((location) => (
                  <div key={location.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`gate-location-${location.id}`}
                      checked={selectedGateLocationIds.includes(String(location.id))}
                      onChange={(e) => {
                        const current = watch('assigned_gate_locations') || [];
                        if (e.target.checked) {
                          setValue('assigned_gate_locations', [...current, location.id]);
                        } else {
                          setValue('assigned_gate_locations', current.filter(id => String(id) !== String(location.id)));
                        }
                      }}
                      className="w-4 h-4 rounded text-primary border-gray-300 focus:ring-primary"
                    />
                    <label htmlFor={`gate-location-${location.id}`} className="text-sm font-medium cursor-pointer truncate">
                      {location.name}
                    </label>
                  </div>
                ))}
                {gateLocations.length === 0 && (
                  <p className="text-[10px] text-muted-foreground uppercase font-bold italic col-span-2 text-center py-2">
                    No gate locations found
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Assigned Blocks (Warden/HR/Management) */}
        {['warden', 'hr', 'head_warden'].includes(selectedRole) && (
          <div className="space-y-4 pt-4">
            <h4 className={sectionTitleClass}>Assignment & Scope</h4>
            <div className="space-y-2">
              <Label className={labelClass}>Assign Blocks (Buildings)</Label>
              <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50 rounded-sm border max-h-[160px] overflow-y-auto">
                {buildings.map((building) => (
                  <div key={building.id} className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id={`block-${building.id}`}
                      checked={selectedBlockIds.includes(String(building.id))}
                      onChange={(e) => {
                        const current = watch('assigned_blocks') || [];
                        const currentMap = { ...(watch('assigned_floors_by_block') || {}) };
                        if (e.target.checked) {
                          setValue('assigned_blocks', [...current, building.id]);
                          if (!currentMap[String(building.id)]) {
                            currentMap[String(building.id)] = [];
                          }
                        } else {
                          setValue('assigned_blocks', current.filter(id => String(id) !== String(building.id)));
                          delete currentMap[String(building.id)];
                        }
                        setValue('assigned_floors_by_block', currentMap);
                      }}
                      className="w-4 h-4 rounded text-primary border-gray-300 focus:ring-primary"
                    />
                    <label htmlFor={`block-${building.id}`} className="text-sm font-medium cursor-pointer truncate">
                      {building.name} ({building.code})
                    </label>
                  </div>
                ))}
                {buildings.length === 0 && (
                  <p className="text-[10px] text-muted-foreground uppercase font-bold italic col-span-2 text-center py-2">
                    No buildings found for {selectedCollege ? 'this college' : 'selected college'}
                  </p>
                )}
              </div>
            </div>

            {['warden', 'hr'].includes(selectedRole) && (
              <div className="space-y-2">
                <Label className={labelClass}>Assign Floors Per Building</Label>
                <div className="space-y-3 p-4 bg-gray-50 rounded-sm border max-h-[220px] overflow-y-auto">
                  {buildings.filter((building) => selectedBlockIds.includes(String(building.id))).map((building) => {
                    const buildingKey = String(building.id);
                    const selectedFloors = assignedFloorsByBlock[buildingKey] || [];
                    const totalFloors = Number(building.total_floors || building.floors || 0);
                    const disabledFloors = (building.disabled_floors || []).map(Number);

                    return (
                      <div key={`floor-map-${building.id}`} className="space-y-2 border-b border-dashed pb-3 last:border-b-0 last:pb-0">
                        <p className="text-xs font-bold text-primary">{building.name} ({building.code})</p>
                        {totalFloors > 0 ? (
                          <div className="grid grid-cols-4 gap-2">
                            {Array.from({ length: totalFloors }, (_, idx) => idx + 1).map((floorNumber) => {
                              const isDisabled = disabledFloors.includes(floorNumber);
                              const checked = selectedFloors.includes(floorNumber);
                              return (
                                <label key={`${buildingKey}-floor-${floorNumber}`} className={`flex items-center gap-2 text-xs ${isDisabled ? 'opacity-50' : ''}`}>
                                  <input
                                    type="checkbox"
                                    disabled={isDisabled}
                                    checked={checked}
                                    onChange={(e) => {
                                      const currentMap = { ...(watch('assigned_floors_by_block') || {}) };
                                      const currentFloors = [...(currentMap[buildingKey] || [])];
                                      if (e.target.checked) {
                                        currentMap[buildingKey] = Array.from(new Set([...currentFloors, floorNumber])).sort((a, b) => a - b);
                                      } else {
                                        currentMap[buildingKey] = currentFloors.filter((value) => value !== floorNumber);
                                      }
                                      setValue('assigned_floors_by_block', currentMap);
                                    }}
                                    className="w-3 h-3 rounded text-primary border-gray-300 focus:ring-primary"
                                  />
                                  <span>F{floorNumber}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground font-bold uppercase">No floor metadata available for this block.</p>
                        )}
                      </div>
                    );
                  })}
                  {buildings.filter((building) => selectedBlockIds.includes(String(building.id))).length === 0 && (
                    <p className="text-[10px] text-muted-foreground uppercase font-bold italic text-center py-2">
                      Select one or more blocks to configure floor-level access
                    </p>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">
                  No floor selected for a block means no access for that block.
                </p>
              </div>
            )}

            {selectedRole === 'warden' && (
              <div className="flex items-center justify-between p-4 rounded-sm bg-primary/5 border border-primary/10">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold text-primary">Cross-Block Access?</Label>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-normal">Allow management across all blocks</p>
                </div>
                <input 
                  type="checkbox" 
                  {...register('can_access_all_blocks')} 
                  className="w-10 h-10 accent-primary cursor-pointer scale-90" 
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Campus Presence (Students & Staff) */}
      <div className="space-y-4 pt-4 border-t border-dashed">
        <h4 className={sectionTitleClass}>Campus Presence</h4>
        <div className="flex items-center justify-between p-4 rounded-sm bg-gray-50 border border-gray-100">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold">Staying on Campus?</Label>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-normal">Required for hostel allocation</p>
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
              <Input type="password" autoComplete="new-password" {...register('password', { required: 'Required', minLength: 8 })} disabled={isLoading} className={inputClass} />
            </div>
            <div className="space-y-2">
              <Label className={labelClass}>Confirm *</Label>
              <Input type="password" autoComplete="new-password" {...register('password_confirm', { required: 'Required' })} disabled={isLoading} className={inputClass} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
