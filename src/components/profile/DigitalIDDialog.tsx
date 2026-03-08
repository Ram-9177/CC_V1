
import React, { useRef, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { DigitalCard } from '@/components/profile/DigitalCard';
import { useQuery } from '@tanstack/react-query';
import { GatePass, User } from '@/types';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { X, ShieldCheck } from 'lucide-react';

interface DigitalIDDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DigitalIDDialog({ open, onOpenChange }: DigitalIDDialogProps) {
  const { user, setUser } = useAuthStore();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time updates for gate pass and profile
  useRealtimeQuery('gate_pass_updated', ['active-gate-pass', user?.id ? String(user.id) : '']);
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
      <DialogContent className="max-w-md p-0 overflow-y-auto max-h-[90vh] border-0 bg-transparent shadow-none flex items-center justify-center scrollbar-none">
        <div className="relative w-full flex flex-col items-center py-10">
            {/* Close Button Inside Modal context but above card */}
            <div className="absolute top-2 right-2 z-[110]">
               <button 
                 onClick={() => onOpenChange(false)}
                 className="p-2 bg-slate-800/80 hover:bg-slate-700/80 backdrop-blur-xl rounded-full text-white border border-white/20 transition-all active:scale-95 shadow-lg"
                 aria-label="Close"
               >
                 <X className="h-5 w-5" />
               </button>
            </div>

            {/* Header Badge */}
            <div className="mb-3 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-top duration-500">
               <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-[10px] font-black text-blue-200 uppercase tracking-[0.2em]">Institutional Clearance</span>
               </div>
            </div>

            <div className="w-full flex items-center justify-center p-4">
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

            <p className="mt-4 text-[9px] font-black text-white/30 uppercase tracking-[0.3em] text-center max-w-[200px] leading-relaxed">
              Digital ID v4.2 • Secured Encryption Protocol
            </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
