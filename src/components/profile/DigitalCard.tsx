import { useState } from 'react';
import { 
  ShieldCheck,
  Camera,
  Cpu,
  RotateCw,
  Heart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandedLoading } from '@/components/common/BrandedLoading';
import type { User as UserType, GatePass } from '@/types';
import { 
  getStudentName, 
  getCollegeName, 
  isOutOnPass as getIsOutOnPass, 
  getStudentAvatar
} from '@/lib/student';

interface DigitalCardProps {
  user: UserType;
  gatePass?: GatePass | null;
  isUploading?: boolean;
  onUploadClick?: () => void;
}

type DigitalCardTemplateKey = 'student' | 'academic' | 'operations' | 'security' | 'admin';

interface DigitalCardTemplate {
  frontShell: string;
  frontHeader: string;
  frontGlowPrimary: string;
  frontGlowSecondary: string;
  idKicker: string;
  idBar: string;
  idValue: string;
  neutralBadge: string;
  photoShell: string;
  photoSurface: string;
  uploadChip: string;
  nameText: string;
  subText: string;
  divider: string;
  metaLabel: string;
  metaValue: string;
  highlightValue: string;
  footer: string;
  liveDot: string;
  footerText: string;
  footerIcons: string;
  backShell: string;
  backGlow: string;
  backTitle: string;
  backPanel: string;
  backLabel: string;
  backPrimaryValue: string;
  backSecondaryValue: string;
  backAddressText: string;
  tokenTitle: string;
  tokenSub: string;
  qrShadow: string;
  actionButton: string;
  helperText: string;
}

const ROLE_TEMPLATE_BY_ROLE: Record<UserType['role'], DigitalCardTemplateKey> = {
  student: 'student',
  staff: 'academic',
  admin: 'admin',
  super_admin: 'admin',
  principal: 'academic',
  director: 'academic',
  hod: 'academic',
  head_warden: 'operations',
  warden: 'operations',
  incharge: 'operations',
  chef: 'operations',
  head_chef: 'operations',
  gate_security: 'security',
  security_head: 'security',
  hr: 'academic',
  pd: 'academic',
  pt: 'academic',
};

const DIGITAL_CARD_TEMPLATES: Record<DigitalCardTemplateKey, DigitalCardTemplate> = {
  student: {
    frontShell: 'bg-white border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.1)]',
    frontHeader: 'bg-slate-50',
    frontGlowPrimary: 'bg-primary/5',
    frontGlowSecondary: 'bg-primary/10',
    idKicker: 'text-slate-400',
    idBar: 'bg-primary',
    idValue: 'text-slate-900',
    neutralBadge: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
    photoShell: 'bg-white ring-slate-100',
    photoSurface: 'bg-slate-50',
    uploadChip: 'bg-white text-primary border-slate-100 hover:text-white hover:bg-primary',
    nameText: 'text-slate-900',
    subText: 'text-slate-500',
    divider: 'from-transparent via-slate-100 to-transparent',
    metaLabel: 'text-slate-400',
    metaValue: 'text-slate-700',
    highlightValue: 'text-rose-600',
    footer: 'bg-slate-50/50 border-slate-50',
    liveDot: 'bg-emerald-500',
    footerText: 'text-slate-400',
    footerIcons: 'text-slate-300',
    backShell: 'bg-slate-900 border-slate-800 shadow-2xl',
    backGlow: 'bg-primary/10',
    backTitle: 'text-slate-400',
    backPanel: 'bg-white/5 border-white/10',
    backLabel: 'text-slate-500',
    backPrimaryValue: 'text-slate-200',
    backSecondaryValue: 'text-primary',
    backAddressText: 'text-slate-400',
    tokenTitle: 'text-slate-300',
    tokenSub: 'text-slate-500',
    qrShadow: 'shadow-primary/20',
    actionButton: 'bg-slate-900 hover:bg-black text-white shadow-xl',
    helperText: 'text-slate-400',
  },
  academic: {
    frontShell: 'bg-white border-indigo-100 shadow-[0_20px_50px_rgba(30,41,59,0.12)]',
    frontHeader: 'bg-indigo-50/70',
    frontGlowPrimary: 'bg-indigo-200/50',
    frontGlowSecondary: 'bg-sky-200/50',
    idKicker: 'text-indigo-400',
    idBar: 'bg-indigo-500',
    idValue: 'text-indigo-950',
    neutralBadge: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
    photoShell: 'bg-white ring-indigo-100',
    photoSurface: 'bg-indigo-50/60',
    uploadChip: 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-600 hover:text-white',
    nameText: 'text-indigo-950',
    subText: 'text-indigo-500',
    divider: 'from-transparent via-indigo-100 to-transparent',
    metaLabel: 'text-indigo-400',
    metaValue: 'text-indigo-800',
    highlightValue: 'text-sky-700',
    footer: 'bg-indigo-50/60 border-indigo-100/80',
    liveDot: 'bg-sky-500',
    footerText: 'text-indigo-500',
    footerIcons: 'text-indigo-300',
    backShell: 'bg-indigo-950 border-indigo-900 shadow-2xl',
    backGlow: 'bg-sky-400/20',
    backTitle: 'text-indigo-300',
    backPanel: 'bg-indigo-400/10 border-indigo-300/20',
    backLabel: 'text-indigo-300/70',
    backPrimaryValue: 'text-indigo-50',
    backSecondaryValue: 'text-sky-300',
    backAddressText: 'text-indigo-200/80',
    tokenTitle: 'text-indigo-100',
    tokenSub: 'text-indigo-300/70',
    qrShadow: 'shadow-sky-300/30',
    actionButton: 'bg-indigo-900 hover:bg-indigo-950 text-indigo-50 shadow-xl shadow-indigo-950/40',
    helperText: 'text-indigo-300',
  },
  operations: {
    frontShell: 'bg-white border-amber-100 shadow-[0_20px_50px_rgba(68,64,60,0.12)]',
    frontHeader: 'bg-amber-50/80',
    frontGlowPrimary: 'bg-amber-300/30',
    frontGlowSecondary: 'bg-orange-300/30',
    idKicker: 'text-amber-500',
    idBar: 'bg-amber-500',
    idValue: 'text-amber-950',
    neutralBadge: 'bg-amber-100 text-amber-700 border border-amber-200',
    photoShell: 'bg-white ring-amber-100',
    photoSurface: 'bg-amber-50/70',
    uploadChip: 'bg-white text-amber-600 border-amber-100 hover:bg-amber-500 hover:text-white',
    nameText: 'text-amber-950',
    subText: 'text-amber-600',
    divider: 'from-transparent via-amber-100 to-transparent',
    metaLabel: 'text-amber-500',
    metaValue: 'text-amber-900',
    highlightValue: 'text-orange-700',
    footer: 'bg-amber-50/70 border-amber-100',
    liveDot: 'bg-amber-500',
    footerText: 'text-amber-600',
    footerIcons: 'text-amber-300',
    backShell: 'bg-amber-950 border-amber-900 shadow-2xl',
    backGlow: 'bg-orange-300/20',
    backTitle: 'text-amber-300',
    backPanel: 'bg-amber-400/10 border-amber-300/20',
    backLabel: 'text-amber-300/70',
    backPrimaryValue: 'text-amber-50',
    backSecondaryValue: 'text-orange-300',
    backAddressText: 'text-amber-200/80',
    tokenTitle: 'text-amber-100',
    tokenSub: 'text-amber-300/70',
    qrShadow: 'shadow-orange-300/30',
    actionButton: 'bg-amber-900 hover:bg-amber-950 text-amber-50 shadow-xl shadow-amber-950/40',
    helperText: 'text-amber-300',
  },
  security: {
    frontShell: 'bg-white border-emerald-100 shadow-[0_20px_50px_rgba(17,24,39,0.12)]',
    frontHeader: 'bg-emerald-50/80',
    frontGlowPrimary: 'bg-emerald-300/30',
    frontGlowSecondary: 'bg-teal-300/30',
    idKicker: 'text-emerald-500',
    idBar: 'bg-emerald-600',
    idValue: 'text-emerald-950',
    neutralBadge: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    photoShell: 'bg-white ring-emerald-100',
    photoSurface: 'bg-emerald-50/70',
    uploadChip: 'bg-white text-emerald-700 border-emerald-100 hover:bg-emerald-600 hover:text-white',
    nameText: 'text-emerald-950',
    subText: 'text-emerald-600',
    divider: 'from-transparent via-emerald-100 to-transparent',
    metaLabel: 'text-emerald-500',
    metaValue: 'text-emerald-900',
    highlightValue: 'text-teal-700',
    footer: 'bg-emerald-50/70 border-emerald-100',
    liveDot: 'bg-emerald-500',
    footerText: 'text-emerald-600',
    footerIcons: 'text-emerald-300',
    backShell: 'bg-emerald-950 border-emerald-900 shadow-2xl',
    backGlow: 'bg-teal-300/20',
    backTitle: 'text-emerald-300',
    backPanel: 'bg-emerald-400/10 border-emerald-300/20',
    backLabel: 'text-emerald-300/70',
    backPrimaryValue: 'text-emerald-50',
    backSecondaryValue: 'text-teal-300',
    backAddressText: 'text-emerald-200/80',
    tokenTitle: 'text-emerald-100',
    tokenSub: 'text-emerald-300/70',
    qrShadow: 'shadow-teal-300/30',
    actionButton: 'bg-emerald-900 hover:bg-emerald-950 text-emerald-50 shadow-xl shadow-emerald-950/40',
    helperText: 'text-emerald-300',
  },
  admin: {
    frontShell: 'bg-white border-sky-100 shadow-[0_20px_50px_rgba(15,23,42,0.14)]',
    frontHeader: 'bg-sky-50/85',
    frontGlowPrimary: 'bg-sky-300/25',
    frontGlowSecondary: 'bg-cyan-300/30',
    idKicker: 'text-sky-500',
    idBar: 'bg-sky-600',
    idValue: 'text-sky-950',
    neutralBadge: 'bg-sky-100 text-sky-700 border border-sky-200',
    photoShell: 'bg-white ring-sky-100',
    photoSurface: 'bg-sky-50/70',
    uploadChip: 'bg-white text-sky-700 border-sky-100 hover:bg-sky-600 hover:text-white',
    nameText: 'text-sky-950',
    subText: 'text-sky-600',
    divider: 'from-transparent via-sky-100 to-transparent',
    metaLabel: 'text-sky-500',
    metaValue: 'text-sky-900',
    highlightValue: 'text-cyan-700',
    footer: 'bg-sky-50/70 border-sky-100',
    liveDot: 'bg-cyan-500',
    footerText: 'text-sky-600',
    footerIcons: 'text-sky-300',
    backShell: 'bg-slate-950 border-sky-900/60 shadow-2xl',
    backGlow: 'bg-cyan-300/20',
    backTitle: 'text-sky-300',
    backPanel: 'bg-sky-400/10 border-sky-300/20',
    backLabel: 'text-sky-300/70',
    backPrimaryValue: 'text-sky-50',
    backSecondaryValue: 'text-cyan-300',
    backAddressText: 'text-sky-200/80',
    tokenTitle: 'text-sky-100',
    tokenSub: 'text-sky-300/70',
    qrShadow: 'shadow-cyan-300/30',
    actionButton: 'bg-sky-900 hover:bg-sky-950 text-sky-50 shadow-xl shadow-sky-950/40',
    helperText: 'text-sky-300',
  },
};

const formatRoleLabel = (role?: string | null): string => {
  if (!role) return 'Institutional Member';
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getIdentityPrefix = (templateKey: DigitalCardTemplateKey): string => {
  switch (templateKey) {
    case 'student':
      return 'STU';
    case 'security':
      return 'SEC';
    case 'operations':
      return 'OPS';
    case 'admin':
      return 'ADM';
    default:
      return 'FAC';
  }
};

const getUniqueIdentityCode = (user: UserType, templateKey: DigitalCardTemplateKey): string => {
  if (user.role === 'student') {
    return (user.registration_number || user.hall_ticket || user.username || `${getIdentityPrefix(templateKey)}-${user.id || 'NA'}`).toUpperCase();
  }

  const fallbackNumber = typeof user.id === 'number' ? String(user.id).padStart(5, '0') : '00000';
  return `${getIdentityPrefix(templateKey)}-${fallbackNumber}`;
};

export function DigitalCard({ user, gatePass, isUploading, onUploadClick }: DigitalCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);

  if (!user) return null;

  const handleFlip = () => setIsFlipped(!isFlipped);

  const templateKey = ROLE_TEMPLATE_BY_ROLE[user.role] ?? 'academic';
  const theme = DIGITAL_CARD_TEMPLATES[templateKey];
  const isStudentRole = user.role === 'student';
  const roleLabel = formatRoleLabel(user.role);
  const identityCode = getUniqueIdentityCode(user, templateKey);
  const collegeName = getCollegeName(user);
  const avatarUrl = !imgError ? getStudentAvatar(user) : `https://ui-avatars.com/api/?name=${encodeURIComponent(getStudentName(user))}&background=8ECAE6&color=ffffff&bold=true`;

  const isHosteller = isStudentRole && user.student_type === 'hosteller';
  const isOutOnPass = isHosteller && getIsOutOnPass(user, gatePass);

  const badgeText = isStudentRole
    ? (isHosteller ? (isOutOnPass ? 'OUT ON PASS' : 'RESIDENT') : 'DAY SCHOLAR')
    : roleLabel.toUpperCase();

  const primaryContactName = isStudentRole ? (user.tenant?.father_name || 'Not Available') : getStudentName(user);
  const primaryContactPhone = isStudentRole ? (user.tenant?.father_phone || '---') : (user.phone || user.phone_number || '---');
  const secondaryContactName = isStudentRole ? (user.tenant?.mother_name || 'Not Available') : (user.tenant?.guardian_name || 'Emergency Contact');
  const secondaryContactPhone = isStudentRole
    ? (user.tenant?.mother_phone || '---')
    : (user.tenant?.emergency_contact || user.tenant?.guardian_phone || '---');
  const registeredAddress = user.tenant?.address
    || (!isStudentRole ? `${collegeName || 'Institutional Campus'} • ${roleLabel}` : undefined)
    || 'No permanent address registered in system records.';
  const primaryContactMissing = primaryContactName === 'Not Available';
  const primaryContactPhoneMissing = primaryContactPhone === '---';
  const secondaryContactMissing = secondaryContactName === 'Not Available' || secondaryContactName === 'Emergency Contact';
  const secondaryContactPhoneMissing = secondaryContactPhone === '---';
  const registeredAddressMissing = registeredAddress === 'No permanent address registered in system records.';
  const qrPayload = encodeURIComponent(`${identityCode}|${user.role}|${user.id}|${user.is_active ? 'active' : 'inactive'}`);
  const liveStatusLabel = user.is_active ? 'Live Profile' : 'Inactive Profile';
  const cardTypeLabel = isStudentRole ? 'Institutional ID' : 'Access Credential';
  const tokenTitle = isStudentRole ? 'Digital Identity Token' : `${roleLabel} Access Token`;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[22rem] mx-auto select-none transition-all duration-500">
      {/* 3D Card Container */}
      <div className="perspective-1000 w-full aspect-[1/1.58]" style={{ height: 'auto' }}>
        <div 
          className={cn(
            "relative w-full h-full transition-all duration-700 preserve-3d cursor-pointer group",
            isFlipped ? "rotate-y-180" : ""
          )}
          onClick={handleFlip}
        >
          {/* ── FRONT SIDE: CLEAN MODERN ID ── */}
          <div 
            className={cn(
              'absolute inset-0 backface-hidden rounded-3xl overflow-hidden border',
              theme.frontShell,
            )}
            style={{ backfaceVisibility: 'hidden', transform: 'translateZ(1px)' }}
          >
            {/* Minimalist Pattern Header */}
            <div className={cn('h-32 relative p-8 flex flex-col justify-center overflow-hidden', theme.frontHeader)}>
              <div className={cn('absolute top-0 right-0 w-32 h-32 rounded-full -mr-12 -mt-12 blur-2xl', theme.frontGlowPrimary)} />
              <div className={cn('absolute bottom-0 left-0 w-24 h-24 rounded-full -ml-8 -mb-8 blur-2xl', theme.frontGlowSecondary)} />
              
              <div className="relative z-10 space-y-1">
                <h3 className={cn('text-xs font-black tracking-widest uppercase', theme.idKicker)}>
                  {cardTypeLabel}
                </h3>
                <div className="flex items-center gap-2">
                  <div className={cn('h-1 w-8 rounded-full', theme.idBar)} />
                  <span className={cn('text-xl font-black tracking-tighter tabular-nums', theme.idValue)}>
                    {identityCode}
                  </span>
                </div>
              </div>

              <div className="absolute top-8 right-8">
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-sm",
                  isStudentRole
                    ? (isHosteller 
                    ? (isOutOnPass ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100') 
                    : 'bg-indigo-50 text-indigo-600 border border-indigo-100')
                    : theme.neutralBadge
                )}>
                  {badgeText}
                </div>
              </div>
            </div>

            {/* Content Section */}
            <div className="p-8 -mt-6 relative z-20">
              <div className="flex flex-col items-center gap-6">
                {/* ID Photo with clean styling */}
                <div 
                  className="relative group/avatar"
                  onClick={(e) => {
                    if (onUploadClick && !isUploading) {
                      e.stopPropagation();
                      onUploadClick();
                    }
                  }}
                >
                  <div className={cn('w-32 h-32 rounded-3xl p-1.5 shadow-xl ring-1 transition-transform group-hover/avatar:scale-105 duration-500', theme.photoShell)}>
                    <div className={cn('w-full h-full rounded-2xl overflow-hidden relative', theme.photoSurface)}>
                      {isImageLoading && !imgError && !isUploading && (
                        <div className="absolute inset-0 bg-muted/60 animate-pulse" />
                      )}
                      <img 
                        src={avatarUrl} 
                        className={cn(
                          "w-full h-full object-cover transition-opacity duration-500",
                          (isUploading || (isImageLoading && !imgError)) ? "opacity-0" : "opacity-100"
                        )}
                        onLoad={() => setIsImageLoading(false)}
                        onError={() => { setImgError(true); setIsImageLoading(false); }}
                      />
                      {isUploading && (
                        <BrandedLoading compact overlay message="" />
                      )}
                    </div>
                  </div>
                  {onUploadClick && !isUploading && (
                    <div className={cn('absolute -bottom-1 -right-1 p-2.5 rounded-xl shadow-lg border transition-all', theme.uploadChip)}>
                      <Camera className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Identity info */}
                <div className="text-center w-full space-y-4">
                  <div className="space-y-1">
                    <h2 className={cn('text-2xl font-black tracking-tight', theme.nameText)}>
                      {getStudentName(user)}
                    </h2>
                    <p className={cn('text-sm font-medium line-clamp-1 italic px-4', theme.subText)}>
                      {isStudentRole ? collegeName : `${collegeName || 'SMG Campus'} • ${roleLabel}`}
                    </p>
                  </div>

                  <div className={cn('h-px bg-gradient-to-r w-full', theme.divider)} />
                  
                  <div className="grid grid-cols-2 gap-y-4 text-left">
                    {isStudentRole ? (
                      <>
                        <div className="px-2">
                          <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-1', theme.metaLabel)}>Stream</p>
                          <p className={cn('text-[11px] font-black truncate', theme.metaValue)}>{user.course || user.department || 'General'}</p>
                        </div>
                        <div className="px-2">
                          <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-1', theme.metaLabel)}>Batch</p>
                          <p className={cn('text-[11px] font-black tabular-nums', theme.metaValue)}>20{user.year_of_study || '24'} - 20{Number(user.year_of_study || 24) + 4}</p>
                        </div>
                        <div className="px-2">
                          <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-1', theme.metaLabel)}>Semester</p>
                          <p className={cn('text-[11px] font-black', theme.metaValue)}>SEM {user.semester || '01'}</p>
                        </div>
                        <div className="px-2">
                          <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-1', theme.metaLabel)}>Blood</p>
                          <p className={cn('text-[11px] font-black uppercase', theme.highlightValue)}>{user.tenant?.blood_group || 'Not Set'}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="px-2">
                          <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-1', theme.metaLabel)}>Role</p>
                          <p className={cn('text-[11px] font-black truncate', theme.metaValue)}>{roleLabel}</p>
                        </div>
                        <div className="px-2">
                          <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-1', theme.metaLabel)}>Department</p>
                          <p className={cn('text-[11px] font-black truncate', theme.metaValue)}>{user.department || user.course || 'Institutional'}</p>
                        </div>
                        <div className="px-2">
                          <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-1', theme.metaLabel)}>Contact</p>
                          <p className={cn('text-[11px] font-black truncate', theme.metaValue)}>{user.phone || user.phone_number || user.email || 'Not Set'}</p>
                        </div>
                        <div className="px-2">
                          <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-1', theme.metaLabel)}>Access</p>
                          <p className={cn('text-[11px] font-black uppercase', user.is_active ? theme.highlightValue : theme.metaValue)}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Smart Footer */}
            <div className={cn('absolute bottom-0 w-full p-6 flex justify-between items-center border-t', theme.footer)}>
              <div className="flex items-center gap-1.5">
                <div className={cn('w-2 h-2 rounded-full animate-pulse', user.is_active ? theme.liveDot : 'bg-amber-400')} />
                <span className={cn('text-[9px] font-black uppercase tracking-widest', theme.footerText)}>{liveStatusLabel}</span>
              </div>
              <div className={cn('flex gap-2', theme.footerIcons)}>
                <Cpu className="w-4 h-4" />
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* ── BACK SIDE: CLEAN SECURITY DOSSIER ── */}
          <div 
            className={cn('absolute inset-0 backface-hidden rounded-3xl overflow-hidden border rotate-y-180', theme.backShell)}
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="h-full flex flex-col p-8 text-white relative">
              <div className={cn('absolute top-0 right-0 w-64 h-64 rounded-full -mr-32 -mt-32 blur-3xl opacity-50', theme.backGlow)} />
               
               <div className="relative z-10 flex-1 flex flex-col justify-between">
                  <div className="space-y-8">
                    <div className="flex justify-between items-center">
                    <h3 className={cn('text-sm font-black tracking-widest uppercase', theme.backTitle)}>
                     {isStudentRole ? 'Emergency Info' : 'Access Matrix'}
                    </h3>
                    {isStudentRole ? <Heart className="w-4 h-4 text-rose-500" /> : <ShieldCheck className="w-4 h-4 text-cyan-300" />}
                    </div>

                    <div className="space-y-6">
                       <div className="space-y-4">
                      <div className={cn('p-4 rounded-2xl border', theme.backPanel)}>
                       <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-2', theme.backLabel)}>Primary Contact</p>
                            <div className="flex justify-between items-center">
                         <p className={cn('text-sm font-black', primaryContactMissing ? 'text-rose-500' : theme.backPrimaryValue)}>{primaryContactName}</p>
                         <span className={cn('text-xs font-bold font-mono', primaryContactPhoneMissing ? 'text-rose-500' : theme.backSecondaryValue)}>{primaryContactPhone}</span>
                            </div>
                          </div>
                          
                      <div className={cn('p-4 rounded-2xl border', theme.backPanel)}>
                       <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-2', theme.backLabel)}>
                        {isStudentRole ? 'Secondary Contact' : 'Emergency Contact'}
                       </p>
                            <div className="flex justify-between items-center">
                         <p className={cn('text-sm font-black', secondaryContactMissing ? 'text-rose-500' : theme.backPrimaryValue)}>{secondaryContactName}</p>
                         <span className={cn('text-xs font-bold font-mono', secondaryContactPhoneMissing ? 'text-rose-500' : theme.backSecondaryValue)}>{secondaryContactPhone}</span>
                            </div>
                          </div>
                       </div>

                       <div className="px-2 space-y-2">
                      <p className={cn('text-[9px] font-bold uppercase tracking-widest', theme.backLabel)}>
                       {isStudentRole ? 'Registered Address' : 'Primary Assignment'}
                      </p>
                      <p className={cn('text-[11px] font-medium leading-relaxed italic', registeredAddressMissing ? 'text-rose-500' : theme.backAddressText)}>
                        {registeredAddress}
                          </p>
                       </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-6 pb-4">
                  <div className={cn('p-3 bg-white rounded-3xl shadow-2xl', theme.qrShadow)}>
                        <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrPayload}&bgcolor=ffffff&color=0f172a&margin=1`} 
                          className="w-24 h-24" 
                        />
                     </div>
                     <div className="text-center">
                    <p className={cn('text-[10px] font-black tracking-[0.3em] uppercase', 'text-rose-500')}>{tokenTitle}</p>
                    <p className={cn('text-[8px] font-medium mt-1 uppercase', 'text-rose-500')}>Valid for institutional verification only</p>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-4 w-full">
        <button 
          onClick={handleFlip}
          className={cn('flex-1 h-12 rounded-sm font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all active:scale-95', theme.actionButton)}
        >
          <RotateCw className={cn("w-4 h-4 transition-transform duration-500", isFlipped ? "rotate-180" : "")} />
          {isFlipped ? 'Identity Front' : 'Personal Dossier'}
        </button>
      </div>

      <p className={cn('text-[10px] font-black uppercase tracking-widest opacity-50', theme.helperText)}>
        Tap card for interactive 360° rotation
      </p>
    </div>
  );
}
