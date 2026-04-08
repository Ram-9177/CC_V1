import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Loader2, UserCog } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedUserForm, UserFormData } from './UnifiedUserForm';

export interface EditableUser {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  name: string;
  email?: string;
  phone?: string;
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
  tenant?: {
    id: number;
    father_name?: string;
    father_phone?: string;
    mother_name?: string;
    mother_phone?: string;
    address?: string;
  };
}

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: EditableUser;
}

export function EditUserDialog({ open, onOpenChange, user }: EditUserDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<UserFormData>({
    defaultValues: {
      first_name: user.first_name || user.name.split(' ')[0] || '',
      last_name: user.last_name || user.name.split(' ').slice(1).join(' ') || '',
      username: user.username,
      email: user.email || '',
      phone_number: user.phone_number || user.phone || '',
      role: user.role,
      is_active: user.is_active,
      is_on_campus: user.is_on_campus ?? true,
      custom_location: user.custom_location || '',
      college: user.college?.toString() || '',
      college_code: user.college_code || '',
      // Tenant fields
      father_name: user.tenant?.father_name || '',
      father_phone: user.tenant?.father_phone || '',
      mother_name: user.tenant?.mother_name || '',
      mother_phone: user.tenant?.mother_phone || '',
      address: user.tenant?.address || '',
    }
  });

  useEffect(() => {
    if (open) {
        form.reset({
            first_name: user.first_name || user.name.split(' ')[0] || '',
            last_name: user.last_name || user.name.split(' ').slice(1).join(' ') || '',
            username: user.username,
            email: user.email || '',
            phone_number: user.phone_number || user.phone || '',
            role: user.role,
            is_active: user.is_active,
            is_on_campus: user.is_on_campus ?? true,
            custom_location: user.custom_location || '',
            college: user.college?.toString() || '',
            college_code: user.college_code || '',
            father_name: user.tenant?.father_name || '',
            father_phone: user.tenant?.father_phone || '',
            mother_name: user.tenant?.mother_name || '',
            mother_phone: user.tenant?.mother_phone || '',
            address: user.tenant?.address || '',
        });
    }
  }, [open, user, form]);

  const onSubmit = async (data: UserFormData) => {
    setIsLoading(true);
    try {
      // 1. Update Core User
      const userPayload = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone_number: data.phone_number,
        role: data.role,
        is_active: data.is_active,
        is_on_campus: data.is_on_campus,
        custom_location: data.custom_location,
        college: data.college ? parseInt(data.college) : null,
      };

      await api.patch(`/auth/users/${user.id}/`, userPayload);

      // 2. Update Tenant if it exists (Student only)
      if (user.tenant?.id) {
        const tenantPayload = {
          father_name: data.father_name,
          father_phone: data.father_phone,
          mother_name: data.mother_name,
          mother_phone: data.mother_phone,
          address: data.address,
        };
        await api.patch(`/users/tenants/${user.tenant.id}/`, tenantPayload);
      }

      toast.success('User updated successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to update user'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[92dvh] overflow-y-auto p-0 border-none bg-white rounded shadow-2xl">
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-6 py-4 border-b">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
               <div className="p-2 bg-primary/10 rounded-sm text-primary">
                 <UserCog className="h-5 w-5" />
               </div>
               Edit User Profile
            </DialogTitle>
            <DialogDescription className="font-bold text-xs uppercase tracking-widest text-muted-foreground mt-1">
              Updating {user.name} ({user.role})
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="p-6">
          <UnifiedUserForm form={form} isLoading={isLoading} isEdit={true} />

          <div className="mt-8 pt-6 border-t flex gap-3">
            <Button 
                type="button" 
                variant="ghost" 
                onClick={() => onOpenChange(false)}
                className="flex-1 h-12 font-bold text-muted-foreground uppercase tracking-widest text-[10px] rounded-sm hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button 
                type="submit" 
                disabled={isLoading}
                className="flex-[2] h-12 primary-gradient text-white font-black uppercase tracking-[0.2em] rounded-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-xs"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save All Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
