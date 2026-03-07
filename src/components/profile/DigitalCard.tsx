import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { User, GatePass } from '@/types';
import { QrCode, User as UserIcon, Calendar, Clock, MapPin } from 'lucide-react';

interface DigitalCardProps {
  user: User;
  gatePass?: GatePass | null; 
}

export function DigitalCard({ user, gatePass }: DigitalCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  if (!user) return null;

  const collegeName: string = user.college_name || 
    (typeof user.college === 'object' && user.college ? (user.college as { name: string }).name : (user.college as string)) || 
    'Main Campus';

  const avatarUrl = user.profile_picture || user.avatar || `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=f1f5f9&color=64748b&bold=true`;

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-[22rem] mx-auto">
      {/* Card Container with 3D Toggle */}
      <div className="perspective-1000 w-full" style={{ minHeight: '440px' }}>
        <div 
          className={cn(
            "relative w-full transition-all duration-700 preserve-3d cursor-pointer shadow-2xl rounded-[2.5rem]",
            isFlipped ? "rotate-y-180" : ""
          )}
          style={{ minHeight: '440px' }}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          {/* FRONT SIDE */}
          <div className="absolute inset-0 backface-hidden">
            <Card className="w-full h-full rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-xl bg-white flex flex-col">
              <div className="h-2 w-full bg-primary/80"></div>
              <CardContent className="flex-1 flex flex-col p-8 gap-6 items-center">
                
                {/* Profile Picture with Status Ring */}
                <div className="relative group">
                  <div className={cn(
                    "w-32 h-32 rounded-[2.5rem] p-1 border-4 shadow-lg overflow-hidden transition-all duration-500",
                    gatePass?.status === 'used' ? "border-blue-500 scale-105" : 
                    gatePass?.status === 'approved' ? "border-emerald-500" :
                    "border-slate-100"
                  )}>
                    <img 
                      src={avatarUrl} 
                      alt={user.name}
                      className="w-full h-full object-cover rounded-[2.2rem]"
                    />
                  </div>
                  {gatePass?.status === 'used' && (
                    <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white text-[8px] font-black px-3 py-1.5 rounded-full shadow-lg animate-bounce border-2 border-white">
                      OFF CAMPUS
                    </div>
                  )}
                </div>

                <div className="text-center w-full">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Student Identification</p>
                  <h2 className="text-2xl font-black text-slate-900 capitalize leading-tight">
                    {user.first_name} {user.last_name}
                  </h2>
                  <p className="font-mono text-xs font-bold text-slate-400 mt-1">{user.registration_number || user.hall_ticket || '—'}</p>
                </div>

                <div className="grid grid-cols-1 gap-4 w-full">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Mobile</p>
                      <p className="font-mono text-[10px] font-black text-slate-900 text-truncate">{user.phone || '—'}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-right">
                       <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Room</p>
                       <p className="text-[10px] font-black text-slate-900">{user.room_number || user.room?.room_number || '—'}</p>
                    </div>
                  </div>

                  {gatePass ? (
                    <div className="pt-2 border-t border-slate-100 mt-1">
                       <div className={cn(
                          "px-4 py-3 rounded-2xl flex items-center justify-between border shadow-sm transition-all",
                          gatePass.status === 'approved' ? "bg-emerald-50 border-emerald-100 text-emerald-700" :
                          gatePass.status === 'pending' ? "bg-orange-50 border-orange-100 text-orange-700" :
                          gatePass.status === 'rejected' ? "bg-rose-50 border-rose-100 text-rose-700" :
                          gatePass.status === 'used' ? "bg-blue-50 border-blue-100 text-blue-700 shadow-[0_4px_12px_rgba(59,130,246,0.1)]" :
                          "bg-slate-50 border-slate-200 text-slate-500"
                       )}>
                          <div className="flex flex-col">
                             <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                                {gatePass.status === 'used' ? 'Current Status' : 'Pass Status'}
                             </span>
                             <span className="text-xs font-black uppercase tracking-tighter">
                                {gatePass.status === 'used' ? 'Currently OUT' : gatePass.status}
                             </span>
                          </div>
                          
                          {gatePass.qr_code && (
                             <div className="h-10 w-10 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${gatePass.qr_code}`} className="w-full h-full" />
                             </div>
                          )}
                       </div>
                       {(gatePass.status === 'approved' || gatePass.status === 'used') && (
                          <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-slate-400 px-1">
                             <div className="flex items-center gap-1.5 uppercase tracking-widest">
                                <Calendar className="h-3 w-3" /> 
                                In: {gatePass.expected_return_date || 'N/A'}
                             </div>
                             <div className="flex items-center gap-1.5 uppercase tracking-widest">
                                <Clock className="h-3 w-3" /> 
                                {gatePass.expected_return_time || '--:--'}
                             </div>
                          </div>
                       )}
                    </div>
                  ) : (
                    <div className="pt-4 border-t border-slate-100 mt-2 flex items-center justify-between opacity-40">
                       <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Campus Presence</p>
                       <Badge variant="outline" className="text-[8px] font-black py-0.5 px-2 rounded-full border-slate-300">STAYING IN</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
              <div className="p-4 bg-slate-50 border-t border-slate-100 text-center flex items-center justify-center gap-2">
                 <div className="h-1 w-1 rounded-full bg-slate-300" />
                 <span className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-400">Institutional Protocol ID</span>
                 <div className="h-1 w-1 rounded-full bg-slate-300" />
              </div>
            </Card>
          </div>

          {/* BACK SIDE */}
          <div className="absolute inset-0 backface-hidden rotate-y-180">
            <Card className="w-full h-full rounded-[2.5rem] overflow-hidden border border-slate-900 shadow-xl bg-slate-900 text-white flex flex-col">
              <div className="h-2 w-full bg-primary/60"></div>
              <CardContent className="flex-1 flex flex-col p-8 gap-6">
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                   <h3 className="text-[10px] font-black tracking-[0.3em] text-white/40 uppercase">Guardian Matrix</h3>
                   <div className="h-6 w-6 bg-white/5 rounded-lg flex items-center justify-center">
                      <QrCode className="h-3 w-3 text-primary" />
                   </div>
                </div>
                
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-1">Father Name</p>
                      <p className="text-sm font-black text-white">{user.tenant?.father_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-1 text-right">Mother Name</p>
                      <p className="text-sm font-black text-white text-right">{user.tenant?.mother_name || '—'}</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                       <MapPin className="h-8 w-8 text-primary" />
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-2">Emergency Hub</p>
                    <p className="font-mono text-xl font-black text-white tracking-tighter">
                      {user.tenant?.emergency_contact || user.tenant?.father_phone || '—'}
                    </p>
                    <p className="text-[8px] font-bold text-white/40 mt-1">PRIMARY ESCALATION CONTACT</p>
                  </div>

                  <div className="space-y-4">
                     <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Official Records</p>
                     <div className="space-y-2">
                        <div className="flex justify-between text-[10px]">
                           <span className="text-white/40 font-medium tracking-tight">College</span>
                           <span className="font-bold text-white/80">{collegeName}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                           <span className="text-white/40 font-medium tracking-tight">Blood Group</span>
                           <span className="font-bold text-rose-500">{user.tenant?.blood_group || 'O+'}</span>
                        </div>
                     </div>
                  </div>
                </div>
              </CardContent>
              <div className="mt-auto p-5 bg-black border-t border-white/5 text-center">
                 <span className="text-[8px] font-black uppercase tracking-[0.5em] text-white/20">Tap to flip back</span>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <div className="w-full px-4">
        <Button 
          variant="outline"
          className="w-full h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all border-slate-200 gap-2"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          {isFlipped ? <div className="flex items-center gap-2"><UserIcon className="h-3 w-3" /> SHOW IDENTITY CARD</div> : "FLIP FOR GUARDIAN MATRIX"}
        </Button>
      </div>
    </div>
  );
}
