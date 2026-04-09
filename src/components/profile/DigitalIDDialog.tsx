import React, { useRef, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { DigitalCard } from '@/components/profile/DigitalCard';
import { useQuery } from '@tanstack/react-query';
import { GatePass, User } from '@/types';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { X } from 'lucide-react';

interface DigitalIDDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DigitalIDDialog({ open, onOpenChange }: DigitalIDDialogProps) {
  const { user, setUser } = useAuthStore();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time updates for gate pass and profile
  useRealtimeQuery('gate_pass_updated', [['active-gate-pass', user?.id ? String(user.id) : '']]);
  useRealtimeQuery('profile_updated', ['profile']);

  const { data: profile } = useQuery<User>({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await api.get('/auth/profile/');
      return response.data;
    },
    initialData: user || undefined,
    enabled: open,
    refetchInterval: 60000,
  });

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Please upload an image smaller than 5MB.');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Unsupported format. Please upload JPG, JPEG, or PNG.');
      return;
    }

    const formData = new FormData();
    formData.append('profile_picture', file);

    setIsUploading(true);
    try {
      const response = await api.post('/auth/users/update_profile_picture/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const updatedUser = {
        ...(profile || user),
        profile_picture: response.data.profile_picture
      } as User;
      
      setUser(updatedUser);
      toast.success('Photo updated successfully!');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Failed to upload photo'));
    } finally {
      setIsUploading(false);
    }
  };

  const activeUser = profile || user;

  // Fetch active gate pass
  const { data: activeGatePass } = useQuery<GatePass | null>({
    queryKey: ['active-gate-pass', activeUser?.id],
    queryFn: async () => {
      try {
        const response = await api.get('/gate-passes/active_pass/');
        return response.data;
      } catch (e) {
        return null;
      }
    },
    enabled: open && !!activeUser && activeUser.role === 'student',
    refetchInterval: 30000, 
  });

  if (!activeUser) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="!z-[10000] bg-white backdrop-blur-0"
        className="!z-[10001] !left-0 !top-0 !translate-x-0 !translate-y-0 !w-screen !h-screen !max-w-none p-0 border-0 rounded-none bg-white shadow-none overflow-hidden ring-0 focus:ring-0 outline-none [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Digital ID Card</DialogTitle>
        <DialogDescription className="sr-only">
          Your institutional digital ID, verification status, and optional photo upload.
        </DialogDescription>
        <div className="relative h-full w-full overflow-y-auto bg-white">
            <button
              onClick={() => onOpenChange(false)}
              className="fixed top-4 right-4 z-20 h-10 w-10 rounded-sm border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted"
              aria-label="Close digital ID"
            >
              <X className="h-5 w-5 mx-auto" />
            </button>

            <div className="min-h-full w-full flex items-center justify-center px-4 py-8 sm:px-8 sm:py-10">
              <DigitalCard 
                user={activeUser} 
                gatePass={activeGatePass}
                isUploading={isUploading} 
                onUploadClick={handleUploadClick} 
              />
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
        </div>
      </DialogContent>
    </Dialog>
  );
}
