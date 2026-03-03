import React, { useState } from 'react';
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

export default function DigitalID() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [isFlipped, setIsFlipped] = useState(false);
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
            {/* FRONT SIDE - THE IMAGE/FACE SIDE */}
            <div className="absolute inset-0 backface-hidden">
                <Card className="w-full h-full rounded-[2.5rem] overflow-hidden border-2 border-slate-800 shadow-2xl relative bg-[#0B1221] flex flex-col text-white">
                  {/* Premium Texture / Mesh Background */}
                  <div className="absolute inset-0 opacity-[0.15] pointer-events-none" 
                       style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}>
                  </div>
                  
                  {/* Top Branding Bar */}
                  <div className="h-2 w-full bg-gradient-to-r from-primary via-blue-500 to-emerald-500"></div>

                  <CardContent className="flex-1 flex flex-col items-center justify-center p-8 gap-8 relative z-10">
                    {/* Header Branding */}
                    <div className="w-full flex justify-between items-start mb-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black tracking-[0.3em] text-primary uppercase mb-1">Institutional ID</span>
                        <div className="flex items-center gap-2">
                           <div className="h-5 w-1 bg-primary rounded-full"></div>
                           <span className="text-xl font-black tracking-tight">STUDENT</span>
                        </div>
                      </div>
                      <img src="/pwa/icon-192.png" alt="Logo" className="w-10 h-10 opacity-90 drop-shadow-lg" />
                    </div>

                    {/* Main Profile Image - Centerpiece */}
                    <div className="relative group perspective-1000">
                      <div className="w-48 h-48 rounded-[3rem] bg-slate-800 p-1.5 border-2 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden relative transition-transform duration-500 group-hover:scale-105">
                        {isUploading ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-20">
                            <Loader2 className="w-10 h-10 animate-spin text-white" />
                          </div>
                        ) : (
                          <img 
                            src={user.profile_picture ? `${user.profile_picture}`.replace('/upload/', '/upload/w_400,q_auto,f_auto/') : `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=0F172A&color=ffffff&bold=true&size=256`} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        )}
                        <button 
                          onClick={handleUploadClick}
                          className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[11px] font-black z-30"
                        >
                          <Camera className="w-8 h-8 mb-2" />
                          UPDATE PHOTO
                        </button>
                      </div>
                      
                      {/* Floating Verification Badge */}
                      <div className="absolute -bottom-2 -right-2 bg-slate-900 p-1.5 rounded-[1.2rem] shadow-2xl border border-white/10 z-40">
                        <div className="bg-emerald-500 text-white p-2.5 rounded-2xl shadow-inner">
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                      </div>
                    </div>

                    {/* Identity Text */}
                    <div className="text-center w-full space-y-2 mt-2">
                      <h2 className="text-3xl font-black text-white tracking-tight leading-none drop-shadow-md capitalize">
                        {user.first_name} {user.last_name}
                      </h2>
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="bg-white/10 backdrop-blur-md rounded-full px-4 py-1.5 border border-white/5 flex items-center gap-2">
                           <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">HT No.</span>
                           <span className="font-mono text-sm font-black text-primary tracking-widest">
                             {user.registration_number || user.hall_ticket}
                           </span>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-2">
                          <div className="bg-emerald-500/10 text-emerald-400 font-black text-[10px] uppercase tracking-[0.2em] px-4 py-2 rounded-xl flex items-center gap-2 border border-emerald-500/20">
                            <MapPin className="w-3.5 h-3.5" />
                            {user.room_number ? `Block ${user.room_number}` : 'Awaiting Placement'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  
                  {/* Holographic Footer */}
                  <div className="bg-white/[0.03] py-5 px-8 flex justify-between items-center border-t border-white/5 mt-auto">
                    <div className="flex flex-col">
                       <span className="text-[8px] font-black text-white/20 tracking-[0.3em] uppercase mb-0.5">Session Validity</span>
                       <span className="text-[10px] font-black text-primary tracking-widest">2023 - 2027</span>
                    </div>
                    <div className="flex flex-col items-end">
                       <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                          <span className="text-[10px] font-black text-white tracking-widest uppercase">Verified</span>
                       </div>
                       <span className="text-[8px] font-bold text-white/20 tracking-[0.1em] mt-0.5">SMG Group IT Systems</span>
                    </div>
                  </div>
                </Card>
            </div>

            {/* BACK SIDE - THE DETAILS SIDE */}
            <div className="absolute inset-0 backface-hidden rotate-y-180">
                <Card className="w-full h-full rounded-[2.5rem] overflow-hidden border-2 border-slate-200 shadow-2xl relative bg-slate-50 flex flex-col">
                    <CardContent className="flex-1 flex flex-col p-6 gap-5 overflow-y-auto no-scrollbar">
                        <div className="flex justify-between items-center">
                           <h3 className="text-sm font-black tracking-widest text-slate-400 uppercase">Personal Dossier</h3>
                           <div className="bg-slate-900 p-1.5 rounded-xl">
                              <img src="/pwa/icon-192.png" alt="Logo" className="w-5 h-5 opacity-80" />
                           </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                           {/* Emergency Protocol */}
                           <div className="bg-white border border-slate-200 rounded-[2rem] p-4 shadow-sm">
                              <div className="flex items-center gap-3 mb-4">
                                 <div className="p-2 bg-rose-100 text-rose-600 rounded-2xl">
                                    <Droplet className="w-4 h-4" />
                                 </div>
                                 <div className="flex-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Medical Record</p>
                                    <p className="text-sm font-black">Blood Group: <span className="text-rose-600">{user.tenant?.blood_group || '—'}</span></p>
                                 </div>
                              </div>

                              <div className="space-y-4 pt-4 border-t border-slate-50">
                                 <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                                       <Users className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                       <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">Primary Guardian</p>
                                       <p className="text-xs font-black text-slate-900">{user.tenant?.father_name || '—'}</p>
                                       <p className="font-mono text-[11px] font-bold text-emerald-600 mt-1">{user.tenant?.father_phone || '—'}</p>
                                    </div>
                                 </div>
                              </div>
                           </div>

                           {/* Contact Grid */}
                           <div className="grid grid-cols-2 gap-3">
                              <div className="bg-white border border-slate-200 rounded-[1.8rem] p-4 flex flex-col gap-1 shadow-sm">
                                 <div className="p-2 w-fit bg-emerald-100 text-emerald-700 rounded-xl mb-1">
                                    <Phone className="w-3.5 h-3.5" />
                                 </div>
                                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Mobile</p>
                                 <p className="font-mono text-[10px] font-bold text-slate-900 truncate">{user.phone || '—'}</p>
                              </div>
                              <div className="bg-white border border-slate-200 rounded-[1.8rem] p-4 flex flex-col gap-1 shadow-sm">
                                 <div className="p-2 w-fit bg-blue-100 text-blue-700 rounded-xl mb-1">
                                    <Mail className="w-3.5 h-3.5" />
                                 </div>
                                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Email</p>
                                 <p className="text-[10px] font-bold text-slate-900 truncate">{user.email?.split('@')[0]}</p>
                              </div>
                           </div>

                           {/* Academic & Residential */}
                           <div className="bg-white border border-slate-200 rounded-[2rem] p-4 space-y-4 shadow-sm">
                              <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center text-violet-600">
                                    <GraduationCap className="w-5 h-5" />
                                 </div>
                                 <div className="flex-1">
                                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Institution Code</p>
                                    <p className="text-xs font-black text-slate-900">{user.tenant?.college_code || 'Main Campus Center'}</p>
                                 </div>
                              </div>
                              <div className="flex items-start gap-4 pt-4 border-t border-slate-50">
                                 <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                                    <Home className="w-5 h-5" />
                                 </div>
                                 <div className="flex-1">
                                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Home Address</p>
                                    <p className="text-[10px] font-bold leading-relaxed text-slate-700">{user.tenant?.address || 'Profile incomplete'}</p>
                                 </div>
                              </div>
                           </div>
                        </div>

                        {/* QR / Token Centerpiece */}
                        <div className="mt-2 bg-slate-900 rounded-[2.5rem] p-6 flex flex-col items-center gap-4 shadow-xl">
                            <div className="bg-white p-3 rounded-3xl shadow-lg ring-4 ring-white/10">
                                <img 
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${user.registration_number}`}
                                  alt="Identity QR"
                                  className="w-24 h-24"
                                  loading="lazy"
                                />
                            </div>
                            <div className="text-center">
                                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-1">Authenticated QR Token</p>
                                <p className="text-[8px] font-medium text-white/40 leading-relaxed max-w-[200px]">
                                   Show this code to security personnel at any institute gate for entry verification.
                                </p>
                            </div>
                        </div>
                    </CardContent>
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
