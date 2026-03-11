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
    (user.avatar || `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=e2e8f0&color=475569&bold=true`);

  const isOutOnPass = user.student_status === 'OUTSIDE_HOSTEL' || gatePass?.status === 'used';
  const statusLabel = isOutOnPass ? 'OUT ON GATE PASS' : 'IN HOSTEL';
  const statusBg = isOutOnPass ? 'bg-rose-500' : 'bg-emerald-500';

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[min(88vw,21rem)] mx-auto select-none">
      {/* 3D Card Container */}
      <div className="perspective-1000 w-full" style={{ height: 'min(76dvh, calc(min(88vw, 21rem) * 1.6))' }}>
        <div 
          className={cn(
            "relative w-full h-full transition-all duration-700 preserve-3d cursor-pointer rounded-xl",
            isFlipped ? "rotate-y-180" : ""
          )}
          style={{ 
            transformStyle: 'preserve-3d',
            boxShadow: '0 8px 30px rgba(0,0,0,0.18)'
          }}
          onClick={handleFlip}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={isFlipped ? "View Security ID" : "View Personal Dossier"}
          aria-expanded={isFlipped}
        >
          {/* ── FRONT SIDE ── */}
          <div 
            className="absolute inset-0 backface-hidden overflow-hidden"
            style={{ 
              backfaceVisibility: 'hidden', 
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(0deg) translateZ(1px)',
              zIndex: isFlipped ? 0 : 1
            }}
          >
            <div className="w-full h-full rounded-xl overflow-hidden bg-white border border-slate-200 flex flex-col">

              {/* Top accent stripe */}
              <div className="h-2 w-full bg-primary shrink-0" />

              {/* Institution header */}
              <div className="bg-slate-700 px-4 py-2 flex items-center justify-between shrink-0">
                <div>
                  <p className="text-[9px] font-black text-white uppercase tracking-[0.35em]">Hostel Connect</p>
                  <p className="text-[7px] text-slate-400 uppercase tracking-widest">Digital Identification</p>
                </div>
                <div className={cn("px-2 py-0.5 rounded text-white flex items-center gap-1", statusBg)}>
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span className="text-[7px] font-black uppercase tracking-wider">{statusLabel}</span>
                </div>
              </div>

              {/* Main content */}
              <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">

                {/* Photo + name row */}
                <div className="flex gap-3 items-start">
                  {/* Photo */}
                  <div 
                    className="relative group cursor-pointer shrink-0"
                    onClick={(e) => {
                      if (onUploadClick && !isUploading) {
                        e.stopPropagation();
                        onUploadClick();
                      }
                    }}
                  >
                    <div className="w-20 h-24 rounded overflow-hidden border-2 border-slate-200 bg-slate-100 relative">
                      {isImageLoading && !imgError && !isUploading && (
                        <div className="absolute inset-0 bg-slate-200 animate-pulse" />
                      )}
                      <img 
                        src={avatarUrl} 
                        alt={`${user.first_name} ${user.last_name}`}
                        loading="lazy"
                        onLoad={() => setIsImageLoading(false)}
                        onError={() => { setImgError(true); setIsImageLoading(false); }}
                        className={cn(
                          "w-full h-full object-cover transition-opacity duration-500",
                          (isUploading || (isImageLoading && !imgError)) ? "opacity-0" : "opacity-100"
                        )}
                      />
                      {isUploading && (
                        <BrandedLoading compact overlay message="Uploading..." />
                      )}
                    </div>
                    {/* Upload icon */}
                    {onUploadClick && !isUploading && (
                      <div className="absolute -top-1 -right-1 p-1.5 bg-slate-700 text-white rounded-sm shadow transition-all group-hover:bg-primary z-30">
                        <Camera className="w-3 h-3" />
                      </div>
                    )}
                  </div>

                  {/* Identity data */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div>
                      <h2 className="text-sm font-black text-slate-900 uppercase leading-tight">
                        {user.first_name || 'STUDENT'} {user.last_name || 'NAME'}
                      </h2>
                      <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                        {user.registration_number || user.hall_ticket || '—'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div>
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">College</p>
                        <p className="text-[10px] font-bold text-slate-700 truncate">{collegeName}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2">
                        <div>
                          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Course</p>
                          <p className="text-[9px] font-bold text-slate-700 truncate">{user.course || user.department || 'Degree'}</p>
                        </div>
                        <div>
                          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Year</p>
                          <p className="text-[9px] font-bold text-slate-700">{user.year_of_study || '—'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-slate-100" />

                {/* Info rows */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 border border-slate-100 p-2">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-0.5">
                        <Home className="w-2.5 h-2.5" /> Hostel/Room
                      </p>
                      <p className="text-[10px] font-black text-slate-700 truncate">
                        {user.hostel_name || 'SMG'} · {user.room_number || user.room?.room_number || '—'}
                      </p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-2">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-0.5">
                        <Phone className="w-2.5 h-2.5" /> Mobile
                      </p>
                      <p className="text-[10px] font-black text-slate-700 truncate">{user.phone || '—'}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 p-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Valid Till</p>
                    </div>
                    <p className="text-[10px] font-black text-slate-700">{user.validity_year || 'Academic Year'}</p>
                  </div>
                </div>

                {/* Active gate pass strip */}
                {gatePass && (
                  <div className={cn(
                    "p-2 border text-[8px] font-black uppercase tracking-widest flex justify-between items-center",
                    gatePass.status === 'used'
                      ? "bg-rose-50 border-rose-200 text-rose-700"
                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                  )}>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" />
                      Gate Pass #{gatePass.id} · {gatePass.destination}
                    </span>
                    <span>{gatePass.status === 'used' ? 'OUT' : 'APPROVED'}</span>
                  </div>
                )}

                {/* Footer strip */}
                <div className="mt-auto border-t border-slate-100 pt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-slate-400" />
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Verified Resident</span>
                  </div>
                  <span className="text-[7px] font-mono text-slate-300">ID_{user.id || 'SYS'}_SEC</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── BACK SIDE ── */}
          <div 
            className="absolute inset-0 backface-hidden overflow-hidden"
            style={{ 
              backfaceVisibility: 'hidden', 
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg) translateZ(1px)',
              zIndex: isFlipped ? 1 : 0
            }}
          >
            <div className="w-full h-full rounded-xl overflow-hidden bg-white border border-slate-200 flex flex-col">

              {/* Top accent + header */}
              <div className="h-2 w-full bg-primary shrink-0" />
              <div className="bg-slate-700 px-4 py-2 shrink-0">
                <p className="text-[9px] font-black text-white uppercase tracking-[0.35em]">Resident Profile</p>
                <p className="text-[7px] text-slate-400 uppercase tracking-widest">Emergency Information</p>
              </div>

              <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">

                {/* Parents */}
                <div className="border border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-3 p-3">
                    <Users2 className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Father's Name</p>
                      <p className="text-xs font-black text-slate-800 truncate">{user.tenant?.father_name || '—'}</p>
                      <p className="text-[9px] font-mono text-slate-500">{user.tenant?.father_phone || '—'}</p>
                    </div>
                  </div>
                  <div className="h-px bg-slate-200" />
                  <div className="flex items-center gap-3 p-3">
                    <Heart className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Mother's Name</p>
                      <p className="text-xs font-black text-slate-800 truncate">{user.tenant?.mother_name || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Medical + SOS */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 border border-slate-100 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Droplet className="w-3 h-3 text-rose-500" />
                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Blood Group</p>
                    </div>
                    <p className="text-lg font-black text-slate-800">{user.tenant?.blood_group || '—'}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertCircle className="w-3 h-3 text-amber-500" />
                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">SOS Contact</p>
                    </div>
                    <p className="text-[10px] font-black text-slate-800 break-all leading-tight">{user.tenant?.emergency_contact || '—'}</p>
                  </div>
                </div>

                {/* Warden */}
                <div className="border border-slate-100 p-3 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Warden Contact</p>
                      <p className="text-[10px] font-black text-slate-700">Hostel Authority</p>
                    </div>
                  </div>
                  <p className="text-[10px] font-black font-mono text-primary">{user.tenant?.warden_contact || '—'}</p>
                </div>

                {/* Address */}
                <div className="px-1 space-y-0.5">
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5" /> Permanent Address
                  </p>
                  <p className="text-[9px] font-bold text-slate-600 truncate">{user.tenant?.address || 'No address provided'}</p>
                </div>

                {/* Footer */}
                <div className="mt-auto border-t border-slate-100 pt-2 text-center">
                  <p className="text-[7px] font-black text-slate-300 uppercase tracking-[0.3em]">Institutional Protocol Applied</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Flip button */}
      <div className="w-full px-4 mt-1 flex justify-center">
        <button 
          type="button"
          className="flex items-center gap-2 px-5 h-9 rounded text-[11px] font-black uppercase tracking-[0.15em] bg-slate-700 text-white hover:bg-slate-600 transition-colors active:scale-95 shadow"
          onClick={(e) => {
            e.stopPropagation();
            handleFlip();
          }}
          aria-label="Flip Card"
        >
          <Shield className="h-3.5 w-3.5" />
          <span>{isFlipped ? 'View Front' : 'View Back'}</span>
        </button>
      </div>
    </div>
  );
}
