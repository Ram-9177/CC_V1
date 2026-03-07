import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCw, ShieldCheck, MapPin, Camera, Loader2, Droplet, Home, Users, Phone, Mail, GraduationCap, ArrowLeft, Clock, CalendarDays, CheckCircle2, User as UserIcon, Building2, DoorOpen, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

import { User, GatePass } from '@/types';

interface DigitalCardProps {
  user: User;
  gatePass?: GatePass | null; 
  isUploading?: boolean;
  onUploadClick?: () => void;
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', { 
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr?: string | null): string {
  if (!timeStr) return '—';
  try {
    // Handle both ISO datetime and time-only strings
    if (timeStr.includes('T') || timeStr.includes(' ')) {
      const d = new Date(timeStr);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    return timeStr;
  } catch {
    return timeStr;
  }
}

const PassCountdown = ({ targetTime }: { targetTime: string }) => {
  const [timeLeft, setTimeLeft] = React.useState('');

  React.useEffect(() => {
    const update = () => {
      const now = new Date();
      let target: Date;
      
      if (targetTime.includes('T') || targetTime.includes(' ')) {
        target = new Date(targetTime);
      } else {
        // Handle HH:mm format by assuming today's date
        const [hours, minutes] = targetTime.split(':').map(Number);
        target = new Date();
        target.setHours(hours, minutes, 0, 0);
        if (target < now) target.setDate(target.getDate() + 1);
      }

      const diff = target.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft('EXPIRED');
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  return <span className="font-mono">{timeLeft}</span>;
};

export function DigitalCard({ user, gatePass, isUploading, onUploadClick }: DigitalCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const buttonStyles = isFlipped 
    ? "bg-white text-slate-900 border border-slate-200" 
    : "bg-slate-900 text-white border-transparent";

  if (!user) return null;

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      {/* Card Container with 3D Toggle */}
      <div className="perspective-1000 w-full max-w-sm" style={{ minHeight: gatePass ? '620px' : '520px' }}>
        <div 
          className={cn(
            "relative w-full transition-all duration-700 preserve-3d",
            isFlipped ? "rotate-y-180" : ""
          )}
          style={{ minHeight: gatePass ? '620px' : '520px' }}
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

                <CardContent className="flex-1 flex flex-col items-center justify-center p-6 gap-5 relative z-10 overflow-y-auto">
                  {/* Header Branding */}
                  <div className="w-full flex justify-between items-start mb-1">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black tracking-[0.3em] text-primary uppercase mb-1">Institutional ID</span>
                      <div className="flex items-center gap-2">
                         <div className="h-5 w-1 bg-primary rounded-full"></div>
                         <span className="text-xl font-black tracking-tight uppercase">{user.role || 'STUDENT'}</span>
                      </div>
                    </div>
                    <img src="/pwa/icon-192.png" alt="Logo" className="w-10 h-10 opacity-90 drop-shadow-lg" />
                  </div>

                  {/* Main Profile Image - Centerpiece */}
                  <div className="relative group perspective-1000">
                    <div className="w-40 h-40 rounded-[3rem] bg-slate-800 p-1.5 border-2 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden relative transition-transform duration-500 group-hover:scale-105">
                      {isUploading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-20">
                          <Loader2 className="w-10 h-10 animate-spin text-white" />
                        </div>
                      ) : (
                        <img 
                          src={user.profile_picture ? `${user.profile_picture}`.replace('/upload/', '/upload/w_400,q_auto,f_auto/') : `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=0F172A&color=ffffff&bold=true&size=256`} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                          fetchPriority="high"
                        />
                      )}
                      {onUploadClick && (
                        <button 
                          onClick={onUploadClick}
                          className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[11px] font-black z-30"
                        >
                          <Camera className="w-8 h-8 mb-2" />
                          UPDATE PHOTO
                        </button>
                      )}
                    </div>
                    
                    {/* Floating Verification Badge */}
                    <div className="absolute -bottom-2 -right-2 bg-slate-900 p-1.5 rounded-[1.2rem] shadow-2xl border border-white/10 z-40">
                      <div className="bg-emerald-500 text-white p-2.5 rounded-2xl shadow-inner">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Identity Text */}
                  <div className="text-center w-full space-y-1.5">
                    <h2 className="text-xl font-black text-white tracking-tight leading-none drop-shadow-md capitalize">
                      {user.first_name} {user.last_name}
                    </h2>
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="bg-white/10 backdrop-blur-md rounded-full px-4 py-1.5 border border-white/5 flex items-center gap-2">
                         <span className="text-[9px] font-black text-white/50 uppercase tracking-widest">HT No.</span>
                         <span className="font-mono text-sm font-black text-primary tracking-widest">
                           {user.registration_number || user.hall_ticket}
                         </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                        <div className="bg-emerald-500/10 text-emerald-400 font-black text-[9px] uppercase tracking-[0.2em] px-3 py-1.5 rounded-xl flex items-center gap-2 border border-emerald-500/20">
                          <Home className="w-3 h-3" />
                          {user.room_number || user.room?.room_number || 'Room —'}
                        </div>
                        <div className="bg-blue-500/10 text-blue-400 font-black text-[9px] uppercase tracking-[0.2em] px-3 py-1.5 rounded-xl flex items-center gap-2 border border-blue-500/20">
                          <Building2 className="w-3 h-3" />
                          {user.room?.building || user.tenant?.building_name || 'Block —'}
                        </div>
                        <div className="bg-violet-500/10 text-violet-400 font-black text-[9px] uppercase tracking-[0.2em] px-3 py-1.5 rounded-xl flex items-center gap-2 border border-violet-500/20">
                          <DoorOpen className="w-3 h-3" />
                          Floor {user.room?.floor ?? '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ═══ GATE PASS DIGITAL CARD (Enhanced) ═══ */}
                  {gatePass && (
                    <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="bg-gradient-to-br from-primary/20 via-blue-500/15 to-emerald-500/10 backdrop-blur-md rounded-[2rem] border border-white/10 p-4 relative overflow-hidden">
                        {/* Status Badge */}
                        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                          {gatePass.status === 'approved' && (
                            <div className="flex items-center gap-1 bg-emerald-500/20 px-2 py-1 rounded-full border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Approved</span>
                            </div>
                          )}
                          {gatePass.status === 'approved' && gatePass.entry_time && (
                             <div className="bg-rose-500/20 px-2 py-1 rounded-full border border-rose-500/30 flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-rose-400" />
                                <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest">
                                   <PassCountdown targetTime={gatePass.entry_time} />
                                </span>
                             </div>
                          )}
                          {(gatePass.status === 'pending') && (
                            <div className="flex items-center gap-1 bg-amber-500/20 px-2 py-1 rounded-full border border-amber-500/30">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest">Pending</span>
                            </div>
                          )}
                        </div>

                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80 mb-3">🎫 Gate Pass</p>
                        
                        {/* Pass Type & Destination */}
                        <div className="flex items-center gap-2 mb-3">
                          <div className="bg-white/10 rounded-xl px-2.5 py-1 border border-white/5">
                            <span className="text-[9px] font-black text-white/80 uppercase tracking-wider">
                              {(gatePass.type || gatePass.pass_type || 'day').replace('_', ' ')}
                            </span>
                          </div>
                          {gatePass.destination && (
                            <div className="flex items-center gap-1.5 text-white/60">
                              <MapPin className="w-3 h-3" />
                              <span className="text-[10px] font-bold truncate max-w-[120px]">{gatePass.destination}</span>
                            </div>
                          )}
                        </div>

                        {/* Time Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                           <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Clock className="w-3 h-3 text-rose-400" />
                                <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Out Time</p>
                              </div>
                              <p className="text-[11px] font-black text-white">{formatTime(gatePass.exit_time)}</p>
                           </div>
                           <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Clock className="w-3 h-3 text-emerald-400" />
                                <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">In Time</p>
                              </div>
                              <p className="text-[11px] font-black text-white">{formatTime(gatePass.entry_time)}</p>
                           </div>
                        </div>

                        {/* Approval Details */}
                        <div className="pt-2.5 border-t border-white/5 space-y-1.5">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                              <UserIcon className="w-3 h-3 text-primary/60" />
                              <span className="text-[8px] font-black uppercase text-white/40 tracking-widest">Approved By</span>
                            </div>
                            <span className="text-[10px] font-bold text-white/70">
                              {gatePass.approved_by?.name || 'Pending'}
                            </span>
                          </div>
                          {gatePass.approved_at && (
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1.5">
                                <CalendarDays className="w-3 h-3 text-primary/60" />
                                <span className="text-[8px] font-black uppercase text-white/40 tracking-widest">Approval Time</span>
                              </div>
                              <span className="text-[10px] font-bold text-white/70">
                                {formatDateTime(gatePass.approved_at)}
                              </span>
                            </div>
                          )}
                          {gatePass.hostel_name && (
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1.5">
                                <Building2 className="w-3 h-3 text-primary/60" />
                                <span className="text-[8px] font-black uppercase text-white/40 tracking-widest">Hostel</span>
                              </div>
                              <span className="text-[10px] font-bold text-white/70">{gatePass.hostel_name}</span>
                            </div>
                          )}
                          {gatePass.student_room && (
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1.5">
                                <DoorOpen className="w-3 h-3 text-primary/60" />
                                <span className="text-[8px] font-black uppercase text-white/40 tracking-widest">Room</span>
                              </div>
                              <span className="text-[10px] font-bold text-white/70">Room {gatePass.student_room}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
                
                {/* Holographic Footer */}
                <div className="bg-white/[0.03] py-4 px-6 flex justify-between items-center border-t border-white/5 mt-auto shrink-0">
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
                                     <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">Parental Identity</p>
                                     <div className="grid grid-cols-2 gap-4">
                                       <div>
                                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Father Details</p>
                                         <p className="text-xs font-black text-slate-900 leading-tight">{user.tenant?.father_name || '—'}</p>
                                         <p className="font-mono text-[10px] text-slate-500 mt-0.5">{user.tenant?.father_phone || '—'}</p>
                                       </div>
                                       <div>
                                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Mother Details</p>
                                         <p className="text-xs font-black text-slate-900 leading-tight">{user.tenant?.mother_name || '—'}</p>
                                         <p className="font-mono text-[10px] text-slate-500 mt-0.5">{user.tenant?.mother_phone || '—'}</p>
                                       </div>
                                     </div>
                                     {(user.tenant?.guardian_name) && (
                                       <div className="mt-2 pt-2 border-t border-slate-50">
                                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Secondary Guardian</p>
                                         <div className="flex justify-between items-center">
                                            <p className="text-xs font-black text-slate-900">{user.tenant.guardian_name}</p>
                                            <p className="font-mono text-[10px] text-slate-500">{user.tenant.guardian_phone || '—'}</p>
                                         </div>
                                       </div>
                                     )}
                                  </div>
                               </div>
                               
                               <div className="flex items-center gap-3 pt-2">
                                  <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
                                     <Phone className="w-5 h-5 animate-pulse" />
                                  </div>
                                  <div className="flex-1">
                                     <p className="text-[8px] font-black uppercase text-rose-400 tracking-widest mb-1">Emergency SOS Center</p>
                                     <p className="text-xs font-black text-rose-600">{user.tenant?.emergency_contact || user.tenant?.father_phone || user.phone || '—'}</p>
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
                                  <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Institute & Course</p>
                                  <p className="text-xs font-black text-slate-900">
                                    {user.college && typeof user.college === 'object' ? user.college.name : user.college_name || (typeof user.college === 'string' ? user.college : 'Main Campus Center')}
                                  </p>
                                  <p className="text-[9px] font-bold text-violet-500 uppercase tracking-wider mt-0.5">
                                    Code: {user.tenant?.college_code || user.college_code || 'SMG-01'}
                                  </p>
                               </div>
                            </div>
                            <div className="flex items-start gap-4 pt-4 border-t border-slate-50">
                               <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                                  <Home className="w-5 h-5" />
                               </div>
                               <div className="flex-1">
                                  <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Permanent Address</p>
                                  <p className="text-[10px] font-bold leading-relaxed text-slate-700">
                                    {user.tenant?.address ? `${user.tenant.address}${user.tenant.city ? `, ${user.tenant.city}` : ''}${user.tenant.pincode ? ` - ${user.tenant.pincode}` : ''}` : 'Profile incomplete'}
                                  </p>
                               </div>
                            </div>
                         </div>

                         {/* ═══ Gate Pass Details on Back Side ═══ */}
                         {gatePass && (
                           <div className="bg-white border-2 border-primary/20 rounded-[2rem] p-4 shadow-sm">
                             <div className="flex items-center gap-3 mb-4">
                               <div className="p-2 bg-primary/10 text-primary rounded-2xl">
                                 <ShieldCheck className="w-4 h-4" />
                               </div>
                               <div className="flex-1">
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Gate Pass Details</p>
                                 <p className="text-sm font-black text-primary capitalize">
                                   {(gatePass.type || gatePass.pass_type || 'day').replace('_', ' ')} Pass
                                 </p>
                               </div>
                               <div className={cn(
                                 "px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-wider",
                                 gatePass.status === 'approved' ? "bg-emerald-100 text-emerald-700" :
                                 gatePass.status === 'pending' ? "bg-amber-100 text-amber-700" :
                                 "bg-slate-100 text-slate-600"
                               )}>
                                 {gatePass.status}
                               </div>
                             </div>

                             <div className="space-y-2.5 text-[11px]">
                               <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                                 <span className="text-slate-400 font-bold">Student Name</span>
                                 <span className="font-black text-slate-900 capitalize">{user.first_name} {user.last_name}</span>
                               </div>
                               <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                                 <span className="text-slate-400 font-bold">Roll No</span>
                                 <span className="font-black text-slate-900 font-mono">{user.registration_number || user.hall_ticket}</span>
                               </div>
                               {gatePass.hostel_name && (
                                 <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                                   <span className="text-slate-400 font-bold">Hostel</span>
                                   <span className="font-black text-slate-900">{gatePass.hostel_name}</span>
                                 </div>
                               )}
                               {gatePass.student_room && (
                                 <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                                   <span className="text-slate-400 font-bold">Room No</span>
                                   <span className="font-black text-slate-900">{gatePass.student_room}</span>
                                 </div>
                               )}
                               <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                                 <span className="text-slate-400 font-bold">Out Time</span>
                                 <span className="font-black text-slate-900">{formatTime(gatePass.exit_time)}</span>
                               </div>
                               <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                                 <span className="text-slate-400 font-bold">Expected In</span>
                                 <span className="font-black text-slate-900">{formatTime(gatePass.entry_time)}</span>
                               </div>
                               {gatePass.approved_at && (
                                 <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                                   <span className="text-slate-400 font-bold">Approval Time</span>
                                   <span className="font-black text-slate-900">{formatDateTime(gatePass.approved_at)}</span>
                                 </div>
                               )}
                               <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                                 <span className="text-slate-400 font-bold">Approved By</span>
                                 <span className="font-black text-slate-900">{gatePass.approved_by?.name || 'Pending'}</span>
                               </div>
                               <div className="flex justify-between items-center py-1.5">
                                 <span className="text-slate-400 font-bold">Status</span>
                                 <span className={cn(
                                   "font-black uppercase",
                                   gatePass.status === 'approved' ? "text-emerald-600" :
                                   gatePass.status === 'pending' ? "text-amber-600" :
                                   gatePass.status === 'rejected' ? "text-rose-600" :
                                   "text-slate-600"
                                 )}>
                                   {gatePass.status}
                                 </span>
                               </div>
                               {gatePass.destination && (
                                 <div className="flex justify-between items-center py-1.5 border-t border-slate-50">
                                   <span className="text-slate-400 font-bold">Destination</span>
                                   <span className="font-black text-slate-900">{gatePass.destination}</span>
                                 </div>
                               )}
                               {gatePass.reason && (
                                 <div className="pt-2 border-t border-slate-100">
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Reason</p>
                                   <p className="text-[11px] font-bold text-slate-700 leading-relaxed">{gatePass.reason}</p>
                                 </div>
                               )}
                             </div>
                           </div>
                         )}
                      </div>

                      {/* QR / Token Centerpiece */}
                      <div className="mt-2 bg-slate-900 rounded-[2.5rem] p-6 flex flex-col items-center gap-4 shadow-xl">
                          <div className="bg-white p-3 rounded-3xl shadow-lg ring-4 ring-white/10">
                              <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${user.registration_number || user.hall_ticket}`}
                                alt="Identity QR"
                                className="w-24 h-24"
                                fetchPriority="high"
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
      </div>
    </div>
  );
}
