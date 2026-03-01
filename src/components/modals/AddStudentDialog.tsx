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
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { College } from '@/types';

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
  email: string;
  password: string;
  password_confirm: string;
  is_on_campus: boolean;
  custom_location: string;
}

export function AddStudentDialog({ open, onOpenChange }: AddStudentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch } = useForm<AddStudentForm>({
    defaultValues: {
      is_on_campus: true
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

  const onSubmit = async (data: AddStudentForm) => {
    if (data.password !== data.password_confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/register/', data);
      toast.success('Student added successfully!');
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      reset();
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Failed to add student'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-3xl">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-6 py-4 border-b">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
              <UserPlus className="h-6 w-6 text-primary" />
              Add Student
            </DialogTitle>
            <DialogDescription className="font-medium">
              Create a new student and tenant profile.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b pb-1">Personal Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">First Name *</Label>
                <Input id="first_name" {...register('first_name', { required: 'Required' })} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Last Name *</Label>
                <Input id="last_name" {...register('last_name', { required: 'Required' })} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hall_ticket" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Hall Ticket *</Label>
                <Input id="hall_ticket" placeholder="HT12345" {...register('hall_ticket', { required: 'Required' })} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone_number" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Phone Number *</Label>
                <Input id="phone_number" {...register('phone_number', { required: 'Required' })} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Email Address *</Label>
              <Input id="email" type="email" placeholder="student@college.edu" {...register('email', { required: 'Required' })} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11" />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-dashed">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b pb-1">Campus Presence</h4>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold">Staying on Campus?</Label>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Enable if student lives in hostel or rehab</p>
                </div>
                <input 
                  type="checkbox" 
                  {...register('is_on_campus')} 
                  className="w-10 h-10 accent-primary cursor-pointer"
                />
              </div>

              {watch('is_on_campus') && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Label htmlFor="custom_location" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Custom Location (Optional)</Label>
                  <Input 
                    id="custom_location" 
                    {...register('custom_location')} 
                    placeholder="e.g. Rehab, Guest House" 
                    disabled={isLoading} 
                    className="rounded-2xl border-0 bg-gray-50 h-11 px-4 focus-visible:ring-primary font-medium" 
                  />
                  <p className="text-[10px] italic text-muted-foreground ml-1 text-center">Leave blank if assigned to a specific block</p>
                </div>
              )}
          </div>

          <div className="space-y-4 pt-4 border-t border-dashed">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b pb-1">Parent Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Father's Name</Label>
                <Input {...register('father_name')} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Father's Phone</Label>
                <Input {...register('father_phone')} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Mother's Name</Label>
                <Input {...register('mother_name')} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Mother's Phone</Label>
                <Input {...register('mother_phone')} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground bg-gray-50 p-2 rounded-xl text-center">Parent details are optional but recommended.</p>
          </div>

          <div className="space-y-4 pt-4 border-t border-dashed">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b pb-1">College & Residence</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="college_code" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">College *</Label>
                <Select onValueChange={(val) => setValue('college_code', val)} value={selectedCollege} disabled={isLoading}>
                  <SelectTrigger className="rounded-2xl border-0 bg-gray-50 h-11 px-4">
                    <SelectValue placeholder="Select College" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl shadow-2xl border-0">
                    {colleges.map((college) => (
                      <SelectItem key={college.id} value={college.code} className="rounded-xl my-1 mx-1">{college.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Full Address *</Label>
                <Input id="address" {...register('address', { required: 'Required' })} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11" />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-dashed">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b pb-1">Security</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Password *</Label>
                <Input id="password" type="password" {...register('password', { required: 'Required', minLength: 8 })} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password_confirm" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Confirm *</Label>
                <Input id="password_confirm" type="password" {...register('password_confirm', { required: 'Required' })} disabled={isLoading} className="rounded-2xl border-0 bg-gray-50 h-11" />
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur-md pt-4 -mx-6 px-6 -mb-6 pb-6 border-t flex flex-col gap-3">
            <Button type="submit" disabled={isLoading} className="w-full h-12 primary-gradient text-white font-black uppercase tracking-widest rounded-2xl shadow-sm active:scale-95 transition-all">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create Student Account'}
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
