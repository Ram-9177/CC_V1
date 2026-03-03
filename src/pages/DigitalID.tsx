import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCw, ShieldCheck, MapPin, Camera, Loader2, Droplet, Home, Users, Phone, Mail, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import axios from 'axios';
import { cn } from '@/lib/utils';
import { useRealtimeQuery } from '@/hooks/useWebSocket';

export default function DigitalID() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time zero-refresh sync for profile updates
  useRealtimeQuery('profile_updated', 'profile', (data: Record<string, unknown>) => {
    // Check if ID matches current user
    if (data?.id && data.id !== user?.id) return;
    toast.info('Digital ID synced live');
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
      const errorMessage = axios.isAxiosError(error) ? error.response?.data?.detail : 'Failed to upload photo';
      toast.error(errorMessage || 'Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  };

  const buttonStyles = isFlipped 
    ? "bg-white text-slate-900 border border-slate-200" 
    : "bg-slate-900 text-white border-transparent";

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
      <div className="flex items-center gap-4 mb-8 max-w-sm mx-auto">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate(-1)}
          className="rounded-full bg-white shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-black text-slate-900 tracking-tight">Security ID Card</h1>
      </div>

      <div className="flex flex-col items-center gap-12">
        {/* Card Container with 3D Toggle */}
        <div className="perspective-1000 w-full max-w-sm h-[520px]">
          <div 
            className={cn(
              "relative w-full h-full transition-all duration-700 transform-style-3d",
              isFlipped ? "rotate-y-180" : ""
            )}
          >
            {/* FRONT SIDE */}
            <div className="absolute inset-0 backface-hidden">
                <Card className="w-full h-full rounded-[2.5rem] overflow-hidden border-2 border-emerald-500/20 shadow-2xl relative bg-white flex flex-col">
                  {/* Chip / Texture */}
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                       style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)', backgroundSize: '16px 16px' }}>
                  </div>
                  
                  {/* Dynamic Gradient Bar */}
                  <div className="h-3 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500"></div>

                  <CardContent className="flex-1 flex flex-col items-center p-8 gap-6 relative z-10">
                    {/* ID Header */}
                    <div className="w-full flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black tracking-[0.2em] text-emerald-600 uppercase">Identity</span>
                        <span className="text-sm font-black text-slate-900">STUDENT</span>
                      </div>
                      <img src="/pwa/icon-192.png" alt="Logo" className="w-9 h-9 opacity-80" />
                    </div>

                    {/* Profile Section */}
                    <div className="relative group">
                      <div className="w-40 h-40 rounded-[2.5rem] bg-slate-100 p-1 border-2 border-slate-100 shadow-xl overflow-hidden relative">
                        {isUploading ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                            <Loader2 className="w-8 h-8 animate-spin text-white" />
                          </div>
                        ) : (
                          <img 
                            src={user.profile_picture ? `${user.profile_picture}`.replace('/upload/', '/upload/w_320,q_auto,f_auto/') : `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=ecfdf5&color=059669&bold=true&size=128`} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        )}
                        <button 
                          onClick={handleUploadClick}
                          className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-black"
                        >
                          <Camera className="w-6 h-6 mb-1" />
                          REPLACE
                        </button>
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-2xl shadow-lg border border-slate-100">
                        <div className="bg-emerald-500 text-white p-2 rounded-[14px]">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                      </div>
                    </div>

                    {/* Basic Info */}
                    <div className="text-center w-full">
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                        {user.first_name} {user.last_name}
                      </h2>
                      <div className="font-mono text-sm font-bold text-emerald-600 tracking-widest mt-1">
                        HT#{user.registration_number || user.hall_ticket}
                      </div>

                      <div className="flex items-center justify-center gap-2 mt-4">
                        <div className="bg-emerald-50 text-emerald-700 font-black text-[11px] uppercase tracking-wider px-4 py-2 rounded-2xl flex items-center gap-2 border border-emerald-100 shadow-sm">
                          <MapPin className="w-3.5 h-3.5" />
                          {user.room_number ? `Room ${user.room_number}` : 'Pending Room'}
                        </div>
                      </div>
                    </div>

                    {/* QR Section */}
                    <div className="mt-auto pt-6 border-t border-dashed border-slate-100 w-full flex items-center justify-between">
                       <div className="flex flex-col gap-1">
                          <div className="text-[9px] font-black text-slate-400 tracking-[0.2em] uppercase">Auth Token</div>
                          <div className="font-mono text-[10px] font-bold text-slate-900">SCAN_VERIFIED_2026</div>
                       </div>
                       <div className="bg-white p-1 rounded-xl shadow-md border border-slate-50 ring-1 ring-slate-100/50">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${user.registration_number}`}
                            alt="Student QR"
                            className="w-12 h-12"
                            loading="lazy"
                          />
                       </div>
                    </div>
                  </CardContent>
                  
                  {/* Validation Timestamp Footer */}
                  <div className="bg-slate-50 py-3 px-8 flex justify-between items-center border-t border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase animate-pulse flex items-center gap-1.5">
                       <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                       {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className="text-[8px] font-black text-slate-300 tracking-[0.2em] uppercase">SMG Group of Institutions</span>
                  </div>
                </Card>
            </div>

            {/* BACK SIDE */}
            <div className="absolute inset-0 backface-hidden rotate-y-180">
                <Card className="w-full h-full rounded-[2.5rem] overflow-hidden border-2 border-emerald-500/10 shadow-2xl relative bg-slate-900 flex flex-col text-white">
                    <div className="absolute inset-0 opacity-10" 
                         style={{ backgroundImage: 'radial-gradient(circle at 10px 10px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}>
                    </div>
                    
                    <CardContent className="flex-1 flex flex-col p-8 gap-6 overflow-y-auto no-scrollbar relative z-10">
                        <div className="flex justify-between items-start">
                           <div>
                              <h3 className="text-xl font-black tracking-tight text-white mb-1">Detailed Info</h3>
                              <div className="h-1 w-8 bg-emerald-500 rounded-full"></div>
                           </div>
                        </div>

                        <div className="space-y-4">
                           {/* User Direct Contact */}
                           <div className="bg-white/5 border border-white/10 rounded-3xl p-4 flex flex-col gap-3">
                              <div className="flex items-center gap-3">
                                 <div className="p-2 bg-emerald-500 text-white rounded-xl">
                                    <Phone className="w-4 h-4" />
                                 </div>
                                 <div className="flex-1">
                                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-none mb-1">Student Phone</p>
                                    <p className="font-mono text-sm font-bold">{user.phone || '—'}</p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-3">
                                 <div className="p-2 bg-blue-500 text-white rounded-xl">
                                    <Mail className="w-4 h-4" />
                                 </div>
                                 <div className="flex-1">
                                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Institutional Email</p>
                                    <p className="text-xs font-bold truncate">{user.email || '—'}</p>
                                 </div>
                              </div>
                           </div>

                           {/* Emergency Protocol */}
                           <div className="space-y-2">
                              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2">Emergency Contact</h4>
                              <div className="bg-white/5 border border-white/10 rounded-3xl p-4 space-y-4">
                                 <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center font-black text-rose-400">
                                       <Users className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                       <p className="text-[8px] font-black uppercase text-white/40 tracking-widest mb-0.5">Primary (Father)</p>
                                       <p className="text-xs font-black">{user.tenant?.father_name || '—'}</p>
                                       <p className="font-mono text-[11px] text-emerald-400 mt-0.5">{user.tenant?.father_phone || '—'}</p>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center font-black text-rose-400">
                                       <Droplet className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                       <p className="text-[8px] font-black uppercase text-white/40 tracking-widest mb-0.5">Medical Context</p>
                                       <p className="text-xs font-black">Blood Group: <span className="text-rose-400">{user.tenant?.blood_group || '—'}</span></p>
                                    </div>
                                 </div>
                              </div>
                           </div>

                           {/* College Detail */}
                           <div className="bg-white/5 border border-white/10 rounded-3xl p-4 flex items-center gap-4">
                              <div className="w-10 h-10 rounded-2xl bg-violet-500/20 flex items-center justify-center text-violet-400">
                                 <GraduationCap className="w-5 h-5" />
                              </div>
                              <div className="flex-1">
                                 <p className="text-[8px] font-black uppercase text-white/40 tracking-widest mb-0.5">Academic Record</p>
                                 <p className="text-xs font-black">{user.tenant?.college_code || 'Main Campus'}</p>
                              </div>
                           </div>

                           {/* Residential Address */}
                           <div className="bg-white/5 border border-white/10 rounded-3xl p-4 flex items-start gap-4">
                              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
                                 <Home className="w-5 h-5" />
                              </div>
                              <div className="flex-1">
                                 <p className="text-[8px] font-black uppercase text-white/40 tracking-widest mb-0.5">Permanent Address</p>
                                 <p className="text-[11px] font-bold leading-relaxed">{user.tenant?.address || 'Profile incomplete'}</p>
                              </div>
                           </div>
                        </div>
                    </CardContent>

                    <div className="p-6 bg-white/5 flex flex-col items-center justify-center gap-1 border-t border-white/10">
                       <p className="text-[8px] font-black text-white/30 tracking-[0.3em] uppercase">Valid Identity</p>
                       <p className="text-[9px] font-black text-white px-2 py-0.5 bg-emerald-500 rounded-md">2023-2027 SES</p>
                    </div>
                </Card>
            </div>
          </div>
        </div>

        {/* Global Action Button */}
        <div className="w-full max-w-sm px-4">
          <Button 
            className={cn(
               "w-full h-14 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-[0.98]",
               buttonStyles
            )}
            onClick={() => setIsFlipped(!isFlipped)}
          >
            {isFlipped ? (
              <span className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Return to Front
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <RotateCw className="w-4 h-4" />
                View Full Card Details
              </span>
            )}
          </Button>
          <p className="text-center mt-4 text-[10px] font-black text-slate-400 uppercase tracking-tight">
             Flipped card contains emergency contacts & medical info
          </p>
        </div>
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
