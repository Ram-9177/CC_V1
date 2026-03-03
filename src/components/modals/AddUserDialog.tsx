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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { College } from '@/types';

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AddUserForm {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone_number?: string;
  role: string;
  college?: string;
  password: string;
  password_confirm: string;
}

export function AddUserDialog({ open, onOpenChange }: AddUserDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch } = useForm<AddUserForm>();

  const { data: colleges = [] } = useQuery<College[]>({
    queryKey: ['colleges'],
    queryFn: async () => {
      const res = await api.get('/colleges/colleges/');
      return res.data.results || res.data;
    }
  });

  const selectedCollege = watch('college');

  const onSubmit = async (data: AddUserForm) => {
    if (data.password !== data.password_confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      // Use /auth/users/ endpoint (UserViewSet) instead of /register/
      await api.post('/auth/users/', data);
      toast.success('User created successfully!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      reset();
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Failed to create user'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-3xl">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-6 py-4 border-b">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
              <UserPlus className="h-6 w-6 text-primary" />
              Add Staff/User
            </DialogTitle>
            <DialogDescription className="font-medium">
              Create management personals.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b pb-1">Profile Info</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">First Name *</Label>
                <Input id="first_name" {...register('first_name', { required: 'Required' })} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11 px-4" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Last Name *</Label>
                <Input id="last_name" {...register('last_name', { required: 'Required' })} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11 px-4" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Username *</Label>
                <Input id="username" {...register('username', { required: 'Required' })} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11 px-4" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Email *</Label>
                <Input id="email" type="email" {...register('email', { required: 'Required' })} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11 px-4" placeholder="staff@hostel.com" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="space-y-2">
                  <Label htmlFor="phone_number" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Phone Number</Label>
                  <Input id="phone_number" {...register('phone_number')} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11 px-4" />
               </div>
               <div className="space-y-2">
                  <Label htmlFor="college" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Assigned College</Label>
                  <Select onValueChange={(val) => setValue('college', val)} value={selectedCollege}>
                      <SelectTrigger className="rounded-2xl border-0 bg-gray-50 h-11 px-4">
                          <SelectValue placeholder="All Colleges" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl shadow-2xl border-0">
                          <SelectItem value="none" className="rounded-xl my-1 mx-1">None (Global access)</SelectItem>
                          {colleges.map((c) => (
                              <SelectItem key={c.id} value={c.id.toString()} className="rounded-xl my-1 mx-1">{c.name}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
               </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">System Role *</Label>
              <Select onValueChange={(val) => setValue('role', val)} required>
                  <SelectTrigger className="rounded-2xl border-0 bg-gray-50 h-11 px-4">
                      <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl shadow-2xl border-0">
                      <SelectItem value="staff" className="rounded-xl my-1 mx-1">Staff</SelectItem>
                      <SelectItem value="warden" className="rounded-xl my-1 mx-1">Warden</SelectItem>
                      <SelectItem value="head_warden" className="rounded-xl my-1 mx-1">Head Warden</SelectItem>
                      <SelectItem value="admin" className="rounded-xl my-1 mx-1">Admin</SelectItem>
                      {useAuthStore.getState().user?.role === 'super_admin' && (
                          <SelectItem value="super_admin" className="rounded-xl my-1 mx-1">Super Admin</SelectItem>
                      )}
                      <SelectItem value="chef" className="rounded-xl my-1 mx-1">Chef</SelectItem>
                      <SelectItem value="head_chef" className="rounded-xl my-1 mx-1">Head Chef</SelectItem>
                      <SelectItem value="gate_security" className="rounded-xl my-1 mx-1">Gate Security</SelectItem>
                      <SelectItem value="security_head" className="rounded-xl my-1 mx-1">Security Head</SelectItem>
                  </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-dashed">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b pb-1">Credentials</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Password *</Label>
                <Input id="password" type="password" {...register('password', { required: 'Required', minLength: 8 })} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11 px-4" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password_confirm" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Confirm *</Label>
                <Input id="password_confirm" type="password" {...register('password_confirm', { required: 'Required' })} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11 px-4" />
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur-md pt-4 -mx-6 px-6 -mb-6 pb-6 border-t flex flex-col gap-3">
            <Button type="submit" disabled={isLoading} className="w-full h-12 primary-gradient text-white font-black uppercase tracking-widest rounded-2xl shadow-sm active:scale-95 transition-all">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create User Account'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="w-full h-10 font-bold text-muted-foreground uppercase tracking-widest text-[10px] rounded-xl hover:bg-gray-50">
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
