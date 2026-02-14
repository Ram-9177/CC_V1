import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Loader2, UserPlus } from 'lucide-react';
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
import { useQueryClient } from '@tanstack/react-query';

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AddUserForm {
  first_name: string;
  last_name: string;
  username: string;
  phone_number?: string;
  role: string;
  password: string;
  password_confirm: string;
}

export function AddUserDialog({ open, onOpenChange }: AddUserDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue } = useForm<AddUserForm>();

  const onSubmit = async (data: AddUserForm) => {
    if (data.password !== data.password_confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      // Use /users/ endpoint (UserViewSet) instead of /register/
      await api.post('/users/', data);
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add New User (Non-Student)
          </DialogTitle>
          <DialogDescription>
            Create Staff, Warden, Security or Admin accounts.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
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
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" {...register('username', { required: 'Required' })} disabled={isLoading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone_number">Phone Number</Label>
            <Input
              id="phone_number"
              {...register('phone_number')}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select onValueChange={(val) => setValue('role', val)} required>
                <SelectTrigger>
                    <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="warden">Warden</SelectItem>
                    <SelectItem value="head_warden">Head Warden</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="chef">Chef</SelectItem>
                    <SelectItem value="gate_security">Gate Security</SelectItem>
                    <SelectItem value="security_head">Security Head</SelectItem>
                </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register('password', { required: 'Required', minLength: 8 })} disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password_confirm">Confirm</Label>
              <Input id="password_confirm" type="password" {...register('password_confirm', { required: 'Required' })} disabled={isLoading} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
