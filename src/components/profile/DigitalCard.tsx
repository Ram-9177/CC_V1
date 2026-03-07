import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { User, GatePass } from '@/types';
import { 
  Shield, 
  Home, 
  Building2, 
  Clock, 
  Droplet, 
  Users2, 
  Phone, 
  Mail, 
  GraduationCap,
  AlertCircle
} from 'lucide-react';

interface DigitalCardProps {
  user: User;
  gatePass?: GatePass | null; 
  isUploading?: boolean;
  onUploadClick?: () => void;
}

export function DigitalCard({ user, gatePass, isUploading, onUploadClick }: DigitalCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [imgError, setImgError] = useState(false);

  if (!user) return null;

  const collegeName: string = user.college_name || 
    (typeof user.college === 'object' && user.college ? (user.college as { name: string }).name : (user.college as string)) || 
    'Main Campus Center';

  const avatarUrl = !imgError && user.profile_picture ? user.profile_picture : 
    (user.avatar || `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=f1f5f9&color=64748b&bold=true`);

  const handleFlip = () => setIsFlipped(!isFlipped);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleFlip();
    }
  };

  const getPassTypeLabel = (type: string) => {
    switch (type) {
      case 'day': return 'Day Pass';
      case 'weekend': return 'Weekend Pass';
      case 'emergency': return 'Emergency Pass';
      case 'home_pass': return 'Overnight Pass';
      case 'special': return 'Special Pass';
      default: return type.charAt(0).toUpperCase() + type.slice(1) + ' Pass';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
      case 'used': return 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]';
      case 'pending': return 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]';
      case 'rejected': return 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]';
      default: return 'bg-slate-500 shadow-none';
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[22rem] mx-auto select-none no-scroll-container">
      {/* 3D Card Container */}
      <div className="perspective-1000 w-full h-[580px]">
        <div 
          className={cn(
            "relative w-full h-full transition-all duration-700 preserve-3d cursor-pointer shadow-3xl rounded-[3rem] focus:outline-none focus:ring-2 focus:ring-blue-500/50",
            isFlipped ? "rotate-y-180" : ""
          )}
          onClick={handleFlip}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={isFlipped ? "View Security ID" : "View Personal Dossier"}
          aria-expanded={isFlipped}
        >
          {/* FRONT SIDE (Security ID) */}
          <div className="absolute inset-0 backface-hidden">
            <Card className="w-full h-full rounded-[3rem] overflow-hidden border-0 bg-[#0A0F1E] flex flex-col relative shadow-2xl">
              {/* Dot Grid Pattern */}
              <div 
                className="absolute inset-0 opacity-10 pointer-events-none" 
                style={{ 
                  backgroundImage: 'radial-gradient(#ffffff 0.5px, transparent 0.5px)', 
                  backgroundSize: '30px 30px' 
                }} 
              />
              
              {/* Top Gradient Bar */}
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600 relative z-10 shadow-[0_4px_12px_rgba(59,130,246,0.3)]"></div>
              
              <div className="flex-1 flex flex-col p-6 gap-5 items-center relative z-10 overflow-hidden">
                
                {/* Profile Picture Section */}
                <div className="relative group mt-2">
                  <div className={cn(
                    "w-32 h-32 rounded-[2.8rem] p-1.5 bg-slate-800/50 backdrop-blur-md shadow-2xl transition-all duration-500",
                    gatePass?.status === 'used' ? "shadow-[0_0_30px_rgba(59,130,246,0.4)] scale-105" : 
                    gatePass?.status === 'approved' ? "shadow-[0_0_20px_rgba(16,185,129,0.3)]" :
                    "shadow-xl"
                  )}>
                    <div className="relative w-full h-full overflow-hidden rounded-[2.2rem]">
                      <img 
                        src={avatarUrl} 
                        alt={`${user.first_name} ${user.last_name}`}
                        onError={() => setImgError(true)}
                        className={cn(
                          "w-full h-full object-cover transition-transform duration-700 group-hover:scale-110",
                          isUploading && "opacity-50"
                        )}
                      />
                      {onUploadClick && !isUploading && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onUploadClick();
                          }}
                          className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <span className="text-[9px] font-black text-white uppercase tracking-widest">Touch to Edit</span>
                        </button>
                      )}
                      {isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Verification Badge */}
                  <div className="absolute -bottom-1 -right-1 bg-[#10B981] p-2 rounded-2xl shadow-[0_5px_15px_rgba(16,185,129,0.4)]">
                    <Shield className="w-4 h-4 text-white fill-white/20" />
                  </div>
                </div>

                {/* Identity Header */}
                <div className="text-center w-full space-y-0.5 px-2">
                  <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-lg truncate">
                    {user.first_name} {user.last_name}
                  </h2>
                  <p className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-400 opacity-60">Verified Resident</p>
                </div>

                {/* Registration Number Bubble */}
                <div className="w-full glass-dark shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] p-3 rounded-2xl">
                   <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white/20 text-center mb-0.5">Official H.T / Registration</p>
                   <p className="font-mono text-lg font-black text-white text-center tracking-[0.2em] uppercase">
                     {user.registration_number || user.hall_ticket || '—'}
                   </p>
                </div>

                {/* Location & Dining Section */}
                <div className="grid grid-cols-2 gap-2 w-full">
                   <div className="glass-dark shadow-xl p-3 rounded-2xl flex flex-col items-center justify-center gap-1 group/loc transition-transform active:scale-95">
                      <div className="flex items-center gap-2">
                         <Home className="w-3.5 h-3.5 text-emerald-400" />
                         <span className="text-[10px] font-black text-emerald-100 uppercase tracking-widest">Room {user.room_number || user.room?.room_number || '—'}</span>
                      </div>
                      <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">Level {user.room?.floor || '—'}</span>
                   </div>
                   <div className="glass-dark shadow-xl p-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-transform active:scale-95 group/mess">
                      <div className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                         <span className="text-[10px] font-black text-white uppercase tracking-widest">Mess Active</span>
                      </div>
                      <span className="text-[8px] font-black text-emerald-400/60 uppercase tracking-widest">Dining Verified</span>
                   </div>
                </div>

                {/* Transit Permit Section */}
                <div className="w-full">
                   {gatePass ? (
                      <div className="glass-dark shadow-[0_8px_30px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[2rem] p-4 relative overflow-hidden group/pass transition-all duration-500">
                         <div className="absolute top-0 right-0 p-3 opacity-5">
                            <Shield className="w-12 h-12 text-white" />
                         </div>
                         <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                               <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Transit Authorization</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded-full">
                               <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", getStatusColor(gatePass.status))} />
                               <span className="text-[8px] font-black uppercase tracking-tighter text-white/80">{gatePass.status}</span>
                            </div>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="space-y-0.5">
                               <p className="text-[7px] font-black uppercase tracking-widest text-white/20">Auth Type</p>
                               <p className="text-xs font-black text-white">{getPassTypeLabel(gatePass.type || gatePass.pass_type || 'regular')}</p>
                            </div>
                            <div className="space-y-0.5 text-right">
                               <p className="text-[7px] font-black uppercase tracking-widest text-white/20">Target City</p>
                               <p className="text-xs font-black text-blue-400 truncate capitalize">{gatePass.destination || 'Local'}</p>
                            </div>
                         </div>
                         
                         <div className="flex items-center justify-between pt-3 border-t border-white/5">
                            <div className="flex items-center gap-1.5">
                               <Clock className="w-3 h-3 text-rose-400" />
                               <span className="text-[9px] font-black text-white">{gatePass.exit_time || '00:00'}</span>
                            </div>
                            <div className="h-3 w-px bg-white/10 mx-2" />
                            <div className="flex items-center gap-1.5">
                               <span className="text-[9px] font-black text-emerald-400">{gatePass.expected_return_time || '--:--'}</span>
                               <Clock className="w-3 h-3 text-emerald-400" />
                            </div>
                         </div>
                      </div>
                   ) : (
                      <div className="glass-dark shadow-inner rounded-2xl p-6 flex flex-col items-center justify-center gap-2 opacity-50 transition-opacity hover:opacity-100">
                         <AlertCircle className="w-5 h-5 text-white/20" />
                         <p className="text-[9px] font-black uppercase tracking-widest text-white/30 text-center">No Active Transit Permit<br/><span className="text-[7px] opacity-50">Resident within perimeter</span></p>
                      </div>
                   )}
                </div>
              </div>

              {/* Bottom Info Strip */}
              <div className="p-5 bg-black/40 backdrop-blur-md flex items-center justify-between mt-auto">
                 <div className="space-y-0.5">
                    <p className="text-[7px] font-black uppercase tracking-widest text-white/20">Academic Tenure</p>
                    <p className="text-[10px] font-black text-blue-400/80 tracking-widest">2023 // 2027</p>
                 </div>
                 <div className="flex flex-col items-end gap-1">
                    <div className="bg-emerald-500/10 rounded-full px-3 py-1 flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                       <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Authenticated</span>
                    </div>
                 </div>
              </div>
            </Card>
          </div>

          {/* BACK SIDE (Dossier) */}
          <div className="absolute inset-0 backface-hidden rotate-y-180">
            <Card className="w-full h-full rounded-[3rem] overflow-hidden shadow-2xl bg-white flex flex-col p-7 gap-5 no-scroll-container">
              <div className="flex justify-between items-center mb-1">
                 <div>
                    <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Personal Dossier</h2>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Guardian Matrix & SOS</p>
                 </div>
                 <div className="p-2.5 bg-slate-100 rounded-2xl shadow-inner text-slate-600">
                    <Users2 className="w-4 h-4" />
                 </div>
              </div>
              
              <div className="flex flex-col gap-3 flex-1 overflow-hidden">
                {/* Blood Group Section */}
                <div className="bg-rose-50/50 shadow-sm p-3.5 rounded-2xl flex items-center gap-3 active:scale-[0.98] transition-transform">
                   <div className="p-2.5 bg-white rounded-xl shadow-sm">
                      <Droplet className="w-4 h-4 text-rose-500 fill-rose-500/20" />
                   </div>
                   <div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Medical Record</p>
                      <p className="text-xs font-black text-slate-900">Blood Group: <span className="text-rose-600 font-black">{user.tenant?.blood_group || 'O+'}</span></p>
                   </div>
                </div>

                {/* Parents Section */}
                <div className="bg-slate-50 shadow-sm p-4 rounded-2xl flex flex-col gap-3">
                   <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-0.5">
                         <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Primary Guardian</p>
                         <p className="text-[10px] font-black text-slate-800 truncate">{user.tenant?.father_name || '—'}</p>
                         <p className="text-[8px] font-mono font-bold text-slate-400">{user.tenant?.father_phone || '—'}</p>
                      </div>
                      <div className="text-right space-y-0.5">
                         <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Mother / Secondary</p>
                         <p className="text-[10px] font-black text-slate-800 truncate">{user.tenant?.mother_name || '—'}</p>
                         <p className="text-[8px] font-mono font-bold text-slate-400">NOT LISTED</p>
                      </div>
                   </div>

                   <div className="pt-3 border-t border-slate-200 flex items-center gap-3">
                      <div className="p-2.5 bg-white rounded-xl shadow-[0_4px_10px_rgba(244,63,94,0.15)]">
                         <Phone className="w-4 h-4 text-rose-500" />
                      </div>
                      <div className="flex-1">
                         <p className="text-[7px] font-black uppercase tracking-widest text-rose-500 mb-0.5">Emergency SOS Network</p>
                         <p className="text-base font-black text-slate-900 tracking-tight leading-none">{user.tenant?.emergency_contact || user.tenant?.father_phone || '9100360075'}</p>
                      </div>
                   </div>
                </div>

                {/* Contact Section */}
                <div className="grid grid-cols-2 gap-2.5">
                   <div className="bg-slate-50 p-3 rounded-2xl shadow-sm flex flex-col items-center gap-1.5 text-center transition-transform active:scale-95">
                      <div className="p-1.5 bg-white rounded-xl text-emerald-500 shadow-sm">
                         <Phone className="w-3.5 h-3.5" />
                      </div>
                      <div>
                         <p className="text-[7px] font-black uppercase tracking-widest text-slate-400">Mobile</p>
                         <p className="text-[9px] font-black text-slate-900">{user.phone || '—'}</p>
                      </div>
                   </div>
                   <div className="bg-slate-50 p-3 rounded-2xl shadow-sm flex flex-col items-center gap-1.5 text-center transition-transform active:scale-95">
                      <div className="p-1.5 bg-white rounded-xl text-blue-500 shadow-sm">
                         <Mail className="w-3.5 h-3.5" />
                      </div>
                      <div>
                         <p className="text-[7px] font-black uppercase tracking-widest text-slate-400">Email</p>
                         <p className="text-[9px] font-black text-slate-900 truncate w-20">{user.email || '—'}</p>
                      </div>
                   </div>
                </div>

                {/* Institute Section */}
                <div className="bg-indigo-50/50 shadow-sm p-3.5 rounded-2xl flex items-center gap-3">
                   <div className="p-2.5 bg-white rounded-xl shadow-sm text-indigo-500">
                      <GraduationCap className="w-4 h-4" />
                   </div>
                   <div className="flex-1 min-w-0">
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Campus Authorization</p>
                      <p className="text-[10px] font-black text-slate-900 truncate">{collegeName}</p>
                   </div>
                </div>

                <div className="bg-amber-50/50 shadow-sm p-3.5 rounded-2xl flex items-center gap-3">
                   <div className="p-2.5 bg-white rounded-xl shadow-sm text-amber-500">
                      <Building2 className="w-4 h-4" />
                   </div>
                   <div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Official Home Domain</p>
                      <p className="text-[10px] font-black text-slate-900 italic opacity-60">Verified Primary Address</p>
                   </div>
                </div>
              </div>

              <div className="mt-auto p-3.5 bg-slate-900 rounded-2xl text-center shadow-lg shadow-black/10">
                 <span className="text-[7px] font-black uppercase tracking-[0.4em] text-white/40">Secured Digital Credential</span>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Control Surface */}
      <div className="w-full px-4 mt-2">
        <button 
          className="w-full h-14 rounded-3xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-3 group relative overflow-hidden"
          onClick={handleFlip}
          aria-label={isFlipped ? "Flip to Security View" : "Flip to Dossier View"}
        >
          <div className="absolute inset-0 bg-[#0A0F1E] group-hover:bg-slate-900 transition-colors shadow-2xl" />
          <div className="relative z-10 flex items-center gap-3 text-white">
            {isFlipped ? (
              <>
                <Shield className="h-4 w-4 text-blue-400" />
                <span>Security Protocol View</span>
              </>
            ) : (
              <>
                <Users2 className="h-4 w-4 text-emerald-400" />
                <span>Identification Dossier</span>
              </>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
