import React, { useRef, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { DigitalCard } from '@/components/profile/DigitalCard';
import { useQuery } from '@tanstack/react-query';
import { GatePass } from '@/types';

export default function DigitalID() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image too large. Max 2MB allowed.');
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
      
      if (user) {
        setUser({
          ...user,
          profile_picture: response.data.profile_picture
        });
      }
      toast.success('Photo updated successfully!');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Failed to upload photo'));
    } finally {
      setIsUploading(false);
    }
  };

  // Fetch active gate pass
  const { data: activeGatePass } = useQuery<GatePass | null>({
    queryKey: ['active-gate-pass', user?.id],
    queryFn: async () => {
      try {
        const response = await api.get('/gate-passes/active_pass/');
        return response.data;
      } catch (e) {
        return null;
      }
    },
    enabled: !!user && user.role === 'student',
    refetchInterval: 60000, // Refresh every minute
  });

  if (!user) return null;

  // Profile Mandatory Guard
  const mandatoryFields = [
    { key: 'first_name', label: 'First Name', value: user.first_name },
    { key: 'last_name', label: 'Last Name', value: user.last_name },
    { key: 'father_name', label: 'Father Name', value: user.tenant?.father_name },
    { key: 'father_phone', label: 'Father Phone', value: user.tenant?.father_phone },
    { key: 'blood_group', label: 'Blood Group', value: user.tenant?.blood_group },
    { key: 'emergency_contact', label: 'Emergency Contact', value: user.tenant?.emergency_contact },
    { key: 'address', label: 'Permanent Address', value: user.tenant?.address },
    { key: 'profile_picture', label: 'Photo', value: user.profile_picture },
  ];

  const missingFields = mandatoryFields.filter(f => !f.value || f.value === '—' || f.value === '');
  const isAdmin = ['admin', 'super_admin'].includes(user.role || '');
  const isProfileComplete = missingFields.length === 0;

  if (!isProfileComplete && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-rose-200">
           <ShieldCheck className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Activate Your Digital ID</h1>
        <p className="text-slate-500 max-w-xs mb-8 font-medium">
          For security verification, you must complete your profile information before the Digital ID can be activated.
        </p>
        
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 mb-8 text-left shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Pending Requirements</h3>
          <div className="grid grid-cols-1 gap-2">
            {missingFields.map(field => (
              <div key={field.key} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                <span className="text-sm font-bold text-slate-700">{field.label}</span>
              </div>
            ))}
          </div>
        </div>

        <Button 
          onClick={() => navigate('/profile')}
          className="w-full max-w-xs h-14 primary-gradient text-white font-black rounded-2xl shadow-xl shadow-primary/20"
        >
          COMPLETE PROFILE NOW
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 max-w-sm mx-auto animate-in fade-in slide-in-from-left duration-500">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate(-1)}
          className="rounded-full bg-white shadow-sm hover:scale-110 active:scale-90 transition-all"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-black text-slate-900 tracking-tight">Security ID Card</h1>
      </div>

      <div className="flex flex-col items-center justify-center scale-[0.85] xs:scale-90 sm:scale-100 origin-top transition-transform duration-500">
        <DigitalCard 
          user={user} 
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
  );
}
