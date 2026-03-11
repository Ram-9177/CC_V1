import { useState } from 'react';
import { 
  Shield, 
  Home, 
  AlertCircle, 
  Users2, 
  Droplet, 
  MapPin, 
  Phone, 
  Building2, 
  ShieldCheck,
  Heart,
  Camera
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandedLoading } from '@/components/common/BrandedLoading';
import type { User as UserType, GatePass } from '@/types';

interface DigitalCardProps {
  user: UserType;
  gatePass?: GatePass | null;
  isUploading?: boolean;
  onUploadClick?: () => void;
}

export function DigitalCard({ user, gatePass, isUploading, onUploadClick }: DigitalCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);

  if (!user) return null;

  const handleFlip = () => setIsFlipped(!isFlipped);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleFlip();
    }
  };

  const collegeName: string = user.college_name || 
    (typeof user.college === 'object' && user.college ? (user.college as { name: string }).name : (user.college as string)) || 
    '—';

  const avatarUrl = !imgError && user.profile_picture ? user.profile_picture : 
    (user.avatar || `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=f1f5f9&color=64748b&bold=true`);

  // REAL-TIME STATUS LOGIC: 
  const isOutOnPass = user.student_status === 'OUTSIDE_HOSTEL' || gatePass?.status === 'used';
  const statusLabel = isOutOnPass ? 'OUT ON GATE PASS' : 'IN HOSTEL';
  const statusColor = isOutOnPass 
    ? 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)]' 
    : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]';

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[min(88vw,21rem)] mx-auto select-none">
      {/* 3D Card Container — fluid height on mobile */}
      <div className="perspective-1000 w-full" style={{ height: 'min(76dvh, calc(min(88vw, 21rem) * 1.6))' }}>
        <div 
          className={cn(
            "relative w-full h-full transition-all duration-700 preserve-3d cursor-pointer rounded-[3rem]",
            isFlipped ? "rotate-y-180" : ""
          )}
          style={{ 
            transformStyle: 'preserve-3d',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 0, 0, 0.2)' 
          }}
          onClick={handleFlip}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={isFlipped ? "View Security ID" : "View Personal Dossier"}
          aria-expanded={isFlipped}
        >
          {/* FRONT SIDE (Main ID) */}
          <div 
            className="absolute inset-0 backface-hidden overflow-hidden"
            style={{ 
              backfaceVisibility: 'hidden', 
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(0deg) translateZ(1px)',
              zIndex: isFlipped ? 0 : 1
            }}
          >
            <div className="w-full h-full rounded-[3rem] overflow-hidden border-0 bg-[#0A0F1E] flex flex-col relative ring-1 ring-white/10">
              {/* Subtle Inner Glow Overlay */}
              <div className="absolute inset-0 rounded-[3rem] pointer-events-none shadow-[inset_0_0_80px_rgba(59,130,246,0.05)] z-0" />
              {/* Security Dot Pattern Removed */}

              
              {/* Premium Solid Bar */}
              <div className="h-1.5 w-full bg-blue-500 relative z-10 shadow-[0_4px_15px_rgba(59,130,246,0.3)]"></div>
              
              <div className="flex-1 flex flex-col p-4 gap-3 items-center relative z-10">
                {/* Branding Title */}
                <div className="flex flex-col items-center gap-1 mb-0.5">
                   <h1 className="text-[min(2.5vw,10px)] font-black uppercase tracking-[0.5em] text-blue-400 opacity-80">Hostel Connect</h1>
                   <p className="text-[min(1.8vw,7px)] font-bold text-white/30 uppercase tracking-widest">Digital Identification Protocol</p>
                </div>

                {/* Profile Picture with Status Ring */}
                <div 
                  className="relative group cursor-pointer"
                  onClick={(e) => {
                    if (onUploadClick && !isUploading) {
                      e.stopPropagation();
                      onUploadClick();
                    }
                  }}
                >
                  <div className={cn(
                    "w-[min(30vw,112px)] h-[min(30vw,112px)] rounded-[2.5rem] p-1 bg-slate-800/50 backdrop-blur-md shadow-2xl transition-all duration-700 ring-2 ring-offset-4 ring-offset-[#0A0F1E] group-hover:ring-blue-500/50",
                    isOutOnPass ? "ring-rose-500/50" : "ring-emerald-500/50"
                  )}>
                    <div className="relative w-full h-full overflow-hidden rounded-[2rem] bg-slate-800">
                      {isImageLoading && !imgError && !isUploading && (
                        <div className="absolute inset-0 bg-slate-700 animate-pulse" />
                      )}
                      <img 
                        src={avatarUrl} 
                        alt={`${user.first_name} ${user.last_name}`}
                        loading="lazy"
                        onLoad={() => setIsImageLoading(false)}
                        onError={() => {
                          setImgError(true);
                          setIsImageLoading(false);
                        }}
                        className={cn(
                          "w-full h-full object-cover transition-all duration-700 group-hover:scale-110",
                          (isUploading || (isImageLoading && !imgError)) && "opacity-0",
                          (!isImageLoading || imgError) && "opacity-100"
                        )}
                      />
                      {isUploading && (
                        <BrandedLoading compact overlay message="Uploading..." />
                      )}
                    </div>
                  </div>
                  
                  {/* Floating Upload Trigger */}
                  {onUploadClick && !isUploading && (
                    <div className="absolute -top-1 -right-1 p-2.5 bg-blue-600 text-white rounded-full shadow-[0_4px_12px_rgba(37,99,235,0.4)] transition-all group-hover:scale-110 active:scale-90 z-30 flex items-center justify-center border-[3px] border-[#0A0F1E] group-hover:bg-blue-500">
                      <Camera className="w-4 h-4" />
                    </div>
                  )}
                  
                  {/* Real-time Status Floating Badge */}
                  <div className={cn(
                    "absolute -bottom-2 px-3 py-1 rounded-full flex items-center gap-1.5 z-20 left-1/2 -translate-x-1/2 whitespace-nowrap",
                    statusColor
                  )}>
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">{statusLabel}</span>
                  </div>
                </div>

                {/* Dynamic Identity Group */}
                <div className="text-center w-full mt-1 space-y-0.5">
                  <h2 className="text-lg font-black text-white tracking-tight drop-shadow-lg truncate uppercase">
                    {user.first_name || 'STUDENT'} {user.last_name || 'NAME'}
                  </h2>
                  <div className="flex items-center justify-center gap-2">
                     <span className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-300/60">Student ID:</span>
                     <span className="font-mono text-[10px] font-black text-white tracking-widest">{user.registration_number || user.hall_ticket || '—'}</span>
                  </div>
                </div>

                {/* ACTIVE GATE PASS OVERLAY SECTION */}
                {gatePass && (
                  <div className="w-full animate-in fade-in zoom-in duration-500">
                    <div className={cn(
                      "p-3 rounded-2xl border flex flex-col gap-2 shadow-inner relative overflow-hidden",
                      gatePass.status === 'used' ? "bg-rose-500/10 border-rose-500/20" : "bg-emerald-500/10 border-emerald-500/20"
                    )}>
                      <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
                        <span className={gatePass.status === 'used' ? "text-rose-400" : "text-emerald-400"}>
                          Active Gate Pass #{gatePass.id}
                        </span>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-md",
                          gatePass.status === 'used' ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"
                        )}>
                          {gatePass.status === 'used' ? 'OUTSIDE' : 'APPROVED'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="space-y-0.5">
                          <p className="text-[7px] font-bold text-white/30 uppercase">Departure</p>
                          <p className="text-[9px] font-black text-white">{gatePass.exit_date} <span className="text-blue-400">{gatePass.exit_time}</span></p>
                        </div>
                        <div className="space-y-0.5 text-right">
                          <p className="text-[7px] font-bold text-white/30 uppercase">Return By</p>
                          <p className="text-[9px] font-black text-white">{gatePass.expected_return_date} <span className="text-emerald-400">{gatePass.expected_return_time}</span></p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1 pt-1 border-t border-white/5">
                        <MapPin className="h-2.5 w-2.5 text-blue-400" />
                        <p className="text-[8px] font-black text-white/70 truncate">{gatePass.destination}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Info Grid (Front) */}
                <div className="grid grid-cols-1 gap-2 w-full">
                   {/* Primary Info Block */}
                   <div className="glass-dark p-2.5 rounded-2xl space-y-1.5 border border-white/5">
                      <div className="flex justify-between items-center px-1">
                         <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-[9px] font-black text-white/90 uppercase tracking-widest">{collegeName}</span>
                         </div>
                      </div>
                      <div className="h-px bg-white/5 w-full" />
                      <div className="flex justify-between items-center px-1">
                         <div className="flex flex-col gap-0.5">
                            <p className="text-[7px] font-black uppercase text-white/30 tracking-widest">Course & Year</p>
                            <p className="text-[11px] font-black text-white capitalize">{user.course || user.department || 'Degree Program'} • {user.year_of_study || 'Year 1'}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-[7px] font-black uppercase text-white/30 tracking-widest">Valid Till</p>
                            <p className="text-[11px] font-black text-blue-400">{user.validity_year || 'Academic Year'}</p>
                         </div>
                      </div>
                   </div>

                   {/* Location & Contact Strip */}
                   <div className="grid grid-cols-2 gap-2">
                       <div className="glass-dark p-3 rounded-2xl flex items-center gap-2.5">
                          <div className="p-1.5 bg-blue-500/10 rounded-lg">
                             <Home className="w-3.5 h-3.5 text-blue-400" />
                          </div>
                          <div className="flex flex-col truncate">
                             <span className="text-[7px] font-black text-white/30 uppercase tracking-widest">Hostel/Room</span>
                             <span className="text-[10px] font-black text-white truncate">{user.hostel_name || 'SMG'} • {user.room_number || user.room?.room_number || '—'}</span>
                          </div>
                       </div>
                       <div className="glass-dark p-3 rounded-2xl flex items-center gap-2.5">
                          <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                             <Phone className="w-3.5 h-3.5 text-indigo-400" />
                          </div>
                          <div className="flex flex-col truncate">
                             <span className="text-[7px] font-black text-white/30 uppercase tracking-widest">Mobile</span>
                             <span className="text-[10px] font-black text-white truncate">{user.phone || '—'}</span>
                          </div>
                       </div>
                   </div>
                </div>

                  {/* Footer Security Strip */}
                  <div className="w-full mt-auto pt-1.5 border-t border-white/5 flex items-center justify-between opacity-60">
                      <div className="flex items-center gap-1.5">
                         <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                         <span className="text-[max(7px,min(2vw,8px))] font-black text-white uppercase tracking-[0.2em]">Verified Resident</span>
                      </div>
                      <span className="text-[max(7px,min(2vw,8px))] font-bold text-white/40 font-mono">ID_{user.id || 'SYS'}_SEC</span>
                  </div>
                </div>
              </div>
            </div>

            {/* BACK SIDE (Emergency Information) */}
            <div 
              className="absolute inset-0 backface-hidden overflow-hidden"
              style={{ 
                backfaceVisibility: 'hidden', 
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg) translateZ(1px)',
                zIndex: isFlipped ? 1 : 0
              }}
            >
              <div className="w-full h-full rounded-[3rem] overflow-hidden bg-white flex flex-col p-5 gap-4 ring-1 ring-black/5">
                {/* Back Branding */}
                <div className="flex justify-between items-start">
                   <div className="text-center w-full">
                      <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1 text-primary">Resident Profile</h2>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Verified Secure Identity</p>
                   </div>
                </div>

                {/* Emergency Content Grid */}
                <div className="flex-1 space-y-3">
                  {/* Parents Section */}
                  <div className="bg-slate-50/80 p-4 rounded-[2rem] space-y-3 border border-slate-100 shadow-sm">
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-white rounded-2xl shadow-sm">
                           <Users2 className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div className="grid grid-cols-1 gap-0.5">
                           <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Father's Name</span>
                           <span className="text-sm font-black text-slate-800">{user.tenant?.father_name || '—'}</span>
                           <span className="text-[10px] font-mono font-bold text-indigo-600">{user.tenant?.father_phone || '—'}</span>
                        </div>
                     </div>
                     <div className="h-px bg-slate-200/50 w-full" />
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-white rounded-2xl shadow-sm font-black text-emerald-500">
                           <Heart className="w-5 h-5" />
                        </div>
                        <div className="flex-1 grid grid-cols-1 gap-0.5">
                           <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Mother's Name</span>
                           <span className="text-sm font-black text-slate-800">{user.tenant?.mother_name || '—'}</span>
                        </div>
                     </div>
                  </div>

                  {/* Medical & SOS Badge */}
                  <div className="grid grid-cols-2 gap-2">
                     <div className="bg-rose-50 p-3 rounded-2xl border border-rose-100 flex flex-col gap-1 shadow-sm">
                        <div className="flex items-center gap-2">
                           <Droplet className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />
                           <span className="text-[9px] font-black text-rose-900 uppercase tracking-widest">Blood Group</span>
                        </div>
                        <span className="text-lg font-black text-rose-600">{user.tenant?.blood_group || '—'}</span>
                        <span className="text-[7px] font-bold text-rose-400 uppercase">Emergency Info</span>
                     </div>
                     <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100 flex flex-col gap-1 shadow-sm">
                        <div className="flex items-center gap-2">
                           <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                           <span className="text-[9px] font-black text-amber-900 uppercase tracking-widest">Critical SOS</span>
                        </div>
                        <span className="text-xs font-black text-amber-700 leading-tight truncate">{user.tenant?.emergency_contact || 'None Listed'}</span>
                        <span className="text-[7px] font-bold text-amber-400 uppercase">Emergency Contact</span>
                     </div>
                  </div>

                  {/* Warden Contact (Dynamic Requirement) */}
                  <div className="bg-black/5 p-4 rounded-3xl border border-dashed border-slate-200 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800 rounded-xl text-white">
                           <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Warden Contact</span>
                           <span className="text-xs font-black text-slate-900">Hostel Authority</span>
                        </div>
                     </div>
                     <span className="text-xs font-black text-primary font-mono">{user.tenant?.warden_contact || '9876543210'}</span>
                  </div>

                  {/* Address Snippet */}
                  <div className="px-4 space-y-1">
                     <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        <MapPin className="w-3 h-3" /> Permanent Address
                     </p>
                   <p className="text-[10px] font-bold text-slate-600 truncate">
                      {user.tenant?.address || 'No address provided'}
                   </p>
                </div>
              </div>

              <div className="mt-auto py-3 bg-slate-900 rounded-3xl text-center px-4 shadow-xl">
                 <p className="text-[9px] font-black text-white/90 uppercase tracking-[0.2em]">
                    Institutional Protocol Applied
                 </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Surface */}
      <div className="w-full px-4 mt-2 flex justify-center">
        <button 
          type="button"
          className="w-full max-w-[200px] h-12 rounded-full text-[13px] font-black uppercase tracking-[0.2em] shadow-xl transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-2 group relative overflow-hidden bg-[#0A0F1E] text-white border border-white/10 ring-2 ring-blue-500/30 hover:ring-blue-500"
          onClick={(e) => {
            e.stopPropagation();
            handleFlip();
          }}
          aria-label="Flip Card"
        >
          <Shield className="h-4 w-4 text-blue-400 group-hover:rotate-12 transition-transform" />
          <span>Flip Card</span>
        </button>
      </div>
    </div>
  );
}
