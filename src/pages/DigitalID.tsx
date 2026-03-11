import React, { useRef, useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ArrowLeft, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { DigitalCard } from '@/components/profile/DigitalCard';
import { useQuery } from '@tanstack/react-query';
import { GatePass, User } from '@/types';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { BrandedLoading } from '@/components/common/BrandedLoading';

export default function DigitalID() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Disable background scrolling while ID is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

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
    refetchInterval: 60000,
  });

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB.');
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
    enabled: !!activeUser && activeUser.role === 'student',
    refetchInterval: 30000, 
  });

  if (!activeUser) {
    return <BrandedLoading fullScreen title="Security Portal" message="Authenticating credentials..." />;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-between p-3 sm:p-6 overscroll-none">
      {/* Immersive Header */}
      <div className="w-full max-w-sm flex items-center justify-between mb-2 animate-in fade-in slide-in-from-top duration-500 shrink-0">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)}
            className="rounded-full bg-white/10 text-white hover:bg-white/20 active:scale-90 transition-all border border-white/5"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-lg font-black text-white tracking-tight leading-none">Security Portal</h1>
            <span className="text-[8px] font-black text-blue-400 uppercase tracking-[0.3em] mt-1">Institutional Clearance Required</span>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate(-1)}
          className="rounded-full bg-white/10 text-white hover:bg-white/20 active:scale-90 transition-all border border-white/5"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Card — takes remaining space, never overflows */}
      <div className="flex-1 w-full flex items-center justify-center min-h-0 animate-in zoom-in duration-500 delay-100 overflow-hidden">
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

      {/* Footer Instructions */}
      <div className="w-full max-w-xs text-center mt-4 animate-in fade-in slide-in-from-bottom duration-700">
         <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">
            Digital ID v4.2 • Secured with End-to-End Encryption
         </p>
      </div>
    </div>
  );
}
