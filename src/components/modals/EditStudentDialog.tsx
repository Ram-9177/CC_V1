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
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

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
}

export function EditStudentDialog({ open, onOpenChange, tenant }: EditStudentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm<EditStudentForm>({
      defaultValues: {
          first_name: tenant.user.first_name || tenant.user.name.split(' ')[0] || '',
          last_name: tenant.user.last_name || tenant.user.name.split(' ').slice(1).join(' ') || '',
          phone_number: tenant.user.phone || '',
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

  // Update defaults if tenant changes
  useEffect(() => {
      if (tenant) {
          reset({
            first_name: tenant.user.first_name || tenant.user.name.split(' ')[0] || '',
            last_name: tenant.user.last_name || tenant.user.name.split(' ').slice(1).join(' ') || '',
            phone_number: tenant.user.phone || '',
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Student Details
          </DialogTitle>
          <DialogDescription>
            Update personal and parent information for {tenant.user.name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-widest text-primary border-b pb-1">Basic Info</h4>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input id="first_name" {...register('first_name', { required: 'Required' })} disabled={isLoading} />
                </div>
                <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input id="last_name" {...register('last_name', { required: 'Required' })} disabled={isLoading} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="reg_no">Registration Number (ID)</Label>
                    <Input id="reg_no" {...register('registration_number', { required: 'Required' })} disabled={isLoading} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone_number">Phone Number</Label>
                    <Input id="phone_number" {...register('phone_number', { required: 'Required' })} disabled={isLoading} />
                </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-widest text-primary border-b pb-1">Parent Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Father's Name</Label>
                <Input {...register('father_name', { required: 'Required' })} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label>Father's Phone</Label>
                <Input {...register('father_phone', { required: 'Required' })} disabled={isLoading} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mother's Name</Label>
                <Input {...register('mother_name')} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label>Mother's Phone</Label>
                <Input {...register('mother_phone')} disabled={isLoading} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-widest text-primary border-b pb-1">Address & College</h4>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="college_code">College Code</Label>
                    <Input id="college_code" {...register('college_code')} disabled={isLoading} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" {...register('city')} disabled={isLoading} />
                </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Full Address</Label>
              <Input id="address" {...register('address')} disabled={isLoading} />
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

