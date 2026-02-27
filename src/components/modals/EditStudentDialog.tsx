import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Loader2, Edit } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { College } from '@/types';

interface Tenant {
  id: number;
  father_name?: string;
  father_phone?: string;
  mother_name?: string;
  mother_phone?: string;
  guardian_name?: string;
  guardian_phone?: string;
  college_code?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  user: {
    id: number;
    name: string;
    username: string;
    first_name?: string;
    last_name?: string;
    registration_number?: string;
    phone?: string;
    email?: string;
  };
}

interface EditStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant;
}

interface EditStudentForm {
  first_name: string;
  last_name: string;
  phone_number: string;
  registration_number: string;
  
  father_name: string;
  father_phone: string;
  mother_name: string;
  mother_phone: string;
  guardian_name: string;
  guardian_phone: string;
  
  college_code: string;
  city: string;
  state: string;
  pincode: string;
  address: string;
  email: string;
}

export function EditStudentDialog({ open, onOpenChange, tenant }: EditStudentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch } = useForm<EditStudentForm>({
      defaultValues: {
          first_name: tenant.user.first_name || tenant.user.name.split(' ')[0] || '',
          last_name: tenant.user.last_name || tenant.user.name.split(' ').slice(1).join(' ') || '',
          phone_number: tenant.user.phone || '',
          email: tenant.user.email || '',
          registration_number: tenant.user.registration_number || tenant.user.username || '',
          father_name: tenant.father_name || '',
          father_phone: tenant.father_phone || '',
          mother_name: tenant.mother_name || '',
          mother_phone: tenant.mother_phone || '',
          guardian_name: tenant.guardian_name || '',
          guardian_phone: tenant.guardian_phone || '',
          college_code: tenant.college_code || '',
          city: tenant.city || '',
          state: tenant.state || '',
          pincode: tenant.pincode || '',
          address: tenant.address || '',
      }
  });

  const { data: colleges = [] } = useQuery<College[]>({
    queryKey: ['colleges'],
    queryFn: async () => {
      const res = await api.get('/colleges/colleges/');
      return res.data.results || res.data;
    }
  });

  const selectedCollege = watch('college_code');

  // Update defaults if tenant changes
  useEffect(() => {
      if (tenant) {
          reset({
            first_name: tenant.user.first_name || tenant.user.name.split(' ')[0] || '',
            last_name: tenant.user.last_name || tenant.user.name.split(' ').slice(1).join(' ') || '',
            phone_number: tenant.user.phone || '',
            email: tenant.user.email || '',
            registration_number: tenant.user.registration_number || tenant.user.username || '',
            father_name: tenant.father_name || '',
            father_phone: tenant.father_phone || '',
            mother_name: tenant.mother_name || '',
            mother_phone: tenant.mother_phone || '',
            guardian_name: tenant.guardian_name || '',
            guardian_phone: tenant.guardian_phone || '',
            college_code: tenant.college_code || '',
            city: tenant.city || '',
            state: tenant.state || '',
            pincode: tenant.pincode || '',
            address: tenant.address || '',
          });
      }
  }, [tenant, reset]);

  const onSubmit = async (data: EditStudentForm) => {
    setIsLoading(true);
    try {
      // 1. Update User Record
      await api.patch(`/auth/users/${tenant.user.id}/`, {
          first_name: data.first_name,
          last_name: data.last_name,
          phone_number: data.phone_number,
          email: data.email,
          registration_number: data.registration_number,
      });

      // 2. Update Tenant Record
      await api.patch(`/users/tenants/${tenant.id}/`, {
          father_name: data.father_name,
          father_phone: data.father_phone,
          mother_name: data.mother_name,
          mother_phone: data.mother_phone,
          guardian_name: data.guardian_name,
          guardian_phone: data.guardian_phone,
          college_code: data.college_code,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          address: data.address,
      });

      toast.success('Student details updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Failed to update student'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-3xl transition-all">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-6 py-4 border-b">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <Edit className="h-5 w-5" />
              </div>
              Edit Student
            </DialogTitle>
            <DialogDescription className="font-medium">
              Update details for {tenant.user.name}.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-8">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary border-b border-primary/10 pb-1">Basic Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">First Name</Label>
                  <Input id="first_name" {...register('first_name', { required: 'Required' })} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11 px-4 focus-visible:ring-primary font-medium" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Last Name</Label>
                  <Input id="last_name" {...register('last_name', { required: 'Required' })} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11 px-4 focus-visible:ring-primary font-medium" />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="reg_no" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Registration ID</Label>
                    <Input id="reg_no" {...register('registration_number', { required: 'Required' })} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11 px-4 focus-visible:ring-primary font-medium" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone_number" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Phone Number</Label>
                    <Input id="phone_number" {...register('phone_number', { required: 'Required' })} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11 px-4 focus-visible:ring-primary font-medium" />
                </div>
                <div className="space-y-2 col-span-1 sm:col-span-2">
                    <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Email Address *</Label>
                    <Input id="email" type="email" {...register('email', { required: 'Required' })} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11 px-4 focus-visible:ring-primary font-medium" />
                </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary border-b border-primary/10 pb-1">Parent Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Father's Name</Label>
                <Input {...register('father_name')} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11 px-4 font-medium" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Father's Phone</Label>
                <Input {...register('father_phone')} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11 px-4 font-medium" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Mother's Name</Label>
                <Input {...register('mother_name')} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11 px-4 font-medium" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Mother's Phone</Label>
                <Input {...register('mother_phone')} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11 px-4 font-medium" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary border-b border-primary/10 pb-1">College & Residency</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="college_code" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">College</Label>
                    <Select onValueChange={(val) => setValue('college_code', val)} value={selectedCollege} disabled={isLoading}>
                      <SelectTrigger className="rounded-2xl border-0 bg-gray-50 h-11 px-4 font-medium">
                        <SelectValue placeholder="Select College" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl shadow-2xl border-0">
                        {colleges.map((college) => (
                          <SelectItem key={college.id} value={college.code} className="rounded-xl my-1 mx-1 font-medium">{college.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="city" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">City</Label>
                    <Input id="city" {...register('city')} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11 px-4 font-medium" />
                </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Full Address</Label>
              <Input id="address" {...register('address')} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11 px-4 font-medium" />
            </div>
          </div>

          <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur-md pt-4 -mx-6 px-6 -mb-6 pb-6 border-t flex flex-col gap-3">
            <Button type="submit" disabled={isLoading} className="w-full h-12 primary-gradient text-white font-black uppercase tracking-widest rounded-2xl shadow-sm active:scale-95 transition-all">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save Changes'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="w-full h-10 font-bold text-muted-foreground uppercase tracking-widest text-[10px] rounded-xl hover:bg-gray-50">
              Cancel Edits
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

