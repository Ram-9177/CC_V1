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
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

interface AddStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AddStudentForm {
  hall_ticket: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  
  father_name: string;
  father_phone: string;
  mother_name?: string;
  mother_phone?: string;
  guardian_name?: string;
  guardian_phone?: string;
  
  college_code: string;
  address: string;
  password: string;
  password_confirm: string;
}

export function AddStudentDialog({ open, onOpenChange }: AddStudentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm<AddStudentForm>();

  const onSubmit = async (data: AddStudentForm) => {
    if (data.password !== data.password_confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/register/', data);
      toast.success('Student added successfully!');
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      reset();
      onOpenChange(false);
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.response?.data?.hall_ticket?.[0] || 'Failed to add student';
      toast.error(errorMsg);
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
            Add New Student
          </DialogTitle>
          <DialogDescription>
            Create a new student account. This will automatically generate a tenant profile.
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
            <Label htmlFor="hall_ticket">Hall Ticket Number</Label>
            <Input id="hall_ticket" placeholder="HT12345" {...register('hall_ticket', { required: 'Required' })} disabled={isLoading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone_number">Phone Number</Label>
            <Input
              id="phone_number"
              {...register('phone_number', { required: 'Required' })}
              disabled={isLoading}
            />
          </div>
          {/* Parent Details */}
          <div className="space-y-4 pt-2 border-t">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Parent Details</h4>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Guardian Name</Label>
                <Input {...register('guardian_name')} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label>Guardian Phone</Label>
                <Input {...register('guardian_phone')} disabled={isLoading} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div className="space-y-2">
              <Label htmlFor="college_code">College Code</Label>
              <Input id="college_code" {...register('college_code', { required: 'Required' })} disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" {...register('address', { required: 'Required' })} disabled={isLoading} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
              Create Student
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
