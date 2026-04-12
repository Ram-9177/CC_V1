import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Loader2, UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedUserForm, UserFormData } from './UnifiedUserForm';

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRole?: string;
}

export function AddUserDialog({ open, onOpenChange, initialRole = 'staff' }: AddUserDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  
  const form = useForm<UserFormData>({
    defaultValues: {
      role: initialRole,
      is_active: true,
      is_on_campus: true,
      student_type: 'hosteller',
    }
  });

  const onSubmit = async (data: UserFormData) => {
    if (data.password !== data.password_confirm) {
      toast.error('Passwords do not match');
      return;
    }

    // Prepare payload. Backend UserCreateSerializer/AdminUserCreateSerializer 
    // now handle is_on_campus and custom_location.
    const payload = {
      ...data,
      // For registration_number / hall_ticket consistency
      registration_number: data.role === 'student' ? data.username : data.registration_number,
      hall_ticket: data.role === 'student' ? data.username : undefined,
    };

    setIsLoading(true);
    try {
      await api.post('/auth/users/', payload);
      toast.success(`${data.role.toUpperCase()} created successfully!`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      form.reset();
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Failed to create user'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
        if (!val) form.reset();
        onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[95vh] overflow-y-auto p-0 border-none bg-white rounded shadow-2xl">
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-6 py-4 border-b">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-sm text-primary">
                <UserPlus className="h-6 w-6" />
              </div>
              Add System User
            </DialogTitle>
            <DialogDescription className="font-bold text-xs uppercase tracking-widest text-muted-foreground mt-1">
              Create student, staff, or management accounts.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="p-6">
          <UnifiedUserForm form={form} isLoading={isLoading} />

          <div className="mt-8 pt-6 border-t flex flex-col gap-3">
            <Button 
                type="submit" 
                disabled={isLoading} 
                className="w-full h-12 primary-gradient text-white font-black uppercase tracking-[0.2em] rounded-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-xs"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create User Account'}
            </Button>
            <Button 
                type="button" 
                variant="ghost" 
                onClick={() => onOpenChange(false)} 
                className="w-full h-10 font-bold text-muted-foreground uppercase tracking-widest text-[10px] rounded-sm hover:bg-gray-50 bg-slate-50/50"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
