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
  const gatePassStyle = gatePass?.status === 'used'
    ? 'border border-rose-200 bg-rose-50 text-rose-700'
    : 'border border-emerald-200 bg-emerald-50 text-emerald-700';

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[min(92vw,24rem)] mx-auto select-none">
      {/* 3D Card Container */}
      <div className="perspective-1000 w-full" style={{ height: 'min(78dvh, calc(min(92vw, 24rem) * 1.58))' }}>
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
              <div className="bg-slate-700 px-5 py-3 flex items-center justify-between shrink-0">
                <div>
                  <p className="text-[11px] font-black text-white uppercase tracking-[0.28em] sm:text-xs">CampusCore</p>
                  <p className="text-[9px] text-slate-300 uppercase tracking-[0.22em] sm:text-[10px]">Digital Identification</p>
                </div>
                <div className={cn("px-3 py-1 rounded-md text-white flex items-center gap-1.5", statusBg)}>
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-[0.12em] sm:text-[10px]">{statusLabel}</span>
                </div>
              </div>

              {/* Main content */}
              <div className="flex-1 flex flex-col p-5 gap-4 overflow-hidden">

                {/* Photo + name row */}
                <div className="flex gap-4 items-start">
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
                    <div className="w-24 h-28 rounded-md overflow-hidden border-2 border-slate-200 bg-slate-100 relative sm:w-28 sm:h-32">
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
                      <div className="absolute -top-1 -right-1 p-2 bg-slate-700 text-white rounded-md shadow transition-all group-hover:bg-primary z-30">
                        <Camera className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>

                  {/* Identity data */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 uppercase leading-tight sm:text-xl">
                        {user.first_name || 'STUDENT'} {user.last_name || 'NAME'}
                      </h2>
                      <p className="text-[12px] text-slate-500 font-mono mt-1 sm:text-[13px]">
                        {user.registration_number || user.hall_ticket || '—'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] sm:text-[11px]">College</p>
                        <p className="text-[13px] font-bold text-slate-700 truncate sm:text-[14px]">{collegeName}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] sm:text-[11px]">Course</p>
                          <p className="text-[12px] font-bold text-slate-700 truncate sm:text-[13px]">{user.course || user.department || 'Degree'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] sm:text-[11px]">Year</p>
                          <p className="text-[12px] font-bold text-slate-700 sm:text-[13px]">{user.year_of_study || '—'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-slate-100" />

                {/* Info rows */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 border border-slate-100 p-3 rounded-md">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-1.5 mb-1 sm:text-[11px]">
                        <Home className="w-3 h-3" /> Hostel/Room
                      </p>
                      <p className="text-[13px] font-black text-slate-700 truncate sm:text-[14px]">
                        {user.hostel_name || 'SMG'} · {user.room_number || user.room?.room_number || '—'}
                      </p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-3 rounded-md">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-1.5 mb-1 sm:text-[11px]">
                        <Phone className="w-3 h-3" /> Mobile
                      </p>
                      <p className="text-[13px] font-black text-slate-700 truncate sm:text-[14px]">{user.phone || '—'}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-md flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] sm:text-[11px]">Valid Till</p>
                    </div>
                    <p className="text-[13px] font-black text-slate-700 text-right sm:text-[14px]">{user.validity_year || 'Academic Year'}</p>
                  </div>
                </div>

                {/* Active gate pass strip */}
                {gatePass && (
                  <div className={`p-3 text-[10px] font-black uppercase tracking-[0.12em] flex justify-between items-center rounded-md ${gatePassStyle}`}>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Gate Pass #{gatePass.id} · {gatePass.destination}
                    </span>
                    <span>{gatePass.status === 'used' ? 'OUT' : 'APPROVED'}</span>
                  </div>
                )}

                {/* Footer strip */}
                <div className="mt-auto border-t border-slate-100 pt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] sm:text-[11px]">Verified Resident</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-300 sm:text-[11px]">ID_{user.id || 'SYS'}_SEC</span>
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
              <div className="bg-slate-700 px-5 py-3 shrink-0">
                <p className="text-[11px] font-black text-white uppercase tracking-[0.28em] sm:text-xs">Resident Profile</p>
                <p className="text-[9px] text-slate-300 uppercase tracking-[0.22em] sm:text-[10px]">Emergency Information</p>
              </div>

              <div className="flex-1 flex flex-col p-5 gap-4 overflow-hidden">

                {/* Parents */}
                <div className="border border-slate-100 bg-slate-50 rounded-md overflow-hidden">
                  <div className="flex items-center gap-3 p-4">
                    <Users2 className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] sm:text-[11px]">Father's Name</p>
                      <p className="text-[14px] font-black text-slate-800 truncate sm:text-[15px]">{user.tenant?.father_name || '—'}</p>
                      <p className="text-[12px] font-mono text-slate-500 sm:text-[13px]">{user.tenant?.father_phone || '—'}</p>
                    </div>
                  </div>
                  <div className="h-px bg-slate-200" />
                  <div className="flex items-center gap-3 p-4">
                    <Heart className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] sm:text-[11px]">Mother's Name</p>
                      <p className="text-[14px] font-black text-slate-800 truncate sm:text-[15px]">{user.tenant?.mother_name || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Medical + SOS */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-md">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Droplet className="w-3.5 h-3.5 text-rose-500" />
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] sm:text-[11px]">Blood Group</p>
                    </div>
                    <p className="text-[22px] font-black text-slate-800 sm:text-2xl">{user.tenant?.blood_group || '—'}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-md">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] sm:text-[11px]">SOS Contact</p>
                    </div>
                    <p className="text-[12px] font-black text-slate-800 break-all leading-snug sm:text-[13px]">{user.tenant?.emergency_contact || '—'}</p>
                  </div>
                </div>

                {/* Warden */}
                <div className="border border-slate-100 p-4 flex items-center justify-between gap-3 bg-slate-50 rounded-md">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldCheck className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] sm:text-[11px]">Warden Contact</p>
                      <p className="text-[13px] font-black text-slate-700 sm:text-[14px]">Hostel Authority</p>
                    </div>
                  </div>
                  <p className="text-[12px] font-black font-mono text-primary text-right sm:text-[13px]">{user.tenant?.warden_contact || '—'}</p>
                </div>

                {/* Address */}
                <div className="px-1 space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-1.5 sm:text-[11px]">
                    <MapPin className="w-3 h-3" /> Permanent Address
                  </p>
                  <p className="text-[12px] font-bold text-slate-600 leading-snug line-clamp-2 sm:text-[13px]">{user.tenant?.address || 'No address provided'}</p>
                </div>

                {/* Footer */}
                <div className="mt-auto border-t border-slate-100 pt-3 text-center">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.22em] sm:text-[11px]">Institutional Protocol Applied</p>
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
          className="flex items-center gap-2 px-5 h-10 rounded-md text-[12px] font-black uppercase tracking-[0.15em] bg-slate-700 text-white hover:bg-slate-600 transition-colors active:scale-95 shadow"
          onClick={(e) => {
            e.stopPropagation();
            handleFlip();
          }}
          aria-label="Flip Card"
        >
          <Shield className="h-4 w-4" />
          <span>{isFlipped ? 'View Front' : 'View Back'}</span>
        </button>
      </div>
    </div>
  );
}
