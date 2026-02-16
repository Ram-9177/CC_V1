import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store'; // Correct path based on grep results
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCw, ShieldCheck, Phone, MapPin, Camera, Loader2, User, Droplet, Home, Users, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import axios from 'axios';

export default function DigitalID() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live clock to prevent screenshots
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

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1042) {
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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold">Digital ID Card</h1>
      </div>

      <div className="perspective-1000 max-w-sm mx-auto">
        <div 
          className={`relative transition-all duration-500 transform ${isFlipped ? 'rotate-y-180' : ''}`}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* FRONT OF CARD */}
          {!isFlipped && (
            <Card className="w-full aspect-[3/4.5] rounded-3xl overflow-hidden border-2 border-primary/50 shadow-2xl relative bg-gradient-to-br from-primary to-orange-400 text-foreground">
              {/* Watermark/Pattern */}
              <div className="absolute inset-0 opacity-10 pointer-events-none" 
                   style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)', backgroundSize: '24px 24px' }}>
              </div>

              <CardContent className="h-full flex flex-col items-center justify-between p-8 relative z-10">
                {/* Header */}
                <div className="w-full flex justify-between items-start">
                  <img src="/pwa/icon-192.png" alt="Logo" className="w-12 h-12 rounded-lg bg-black/10 backdrop-blur-sm p-1" />
                  <div className="text-right">
                    <p className="text-xs font-bold opacity-70 uppercase tracking-widest text-foreground">Hostel ID</p>
                    <p className="font-bold tracking-widest text-foreground">SMG-HOSTEL</p>
                  </div>
                </div>

                {/* Photo & Details */}
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-full border-4 border-white/30 overflow-hidden bg-white shadow-inner relative">
                      {isUploading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Loader2 className="w-8 h-8 animate-spin text-white" />
                        </div>
                      ) : (
                        <img 
                          src={user.profile_picture || `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=random`} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=random`;
                          }}
                        />
                      )}
                      
                      {/* Upload Overlay */}
                      <button 
                        onClick={handleUploadClick}
                        className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-bold"
                        disabled={isUploading}
                      >
                        <Camera className="w-6 h-6 mb-1" />
                        UPLOAD PHOTO
                      </button>
                    </div>
                    <div className="absolute bottom-0 right-0 bg-emerald-500 text-white p-1.5 rounded-full border-2 border-primary shadow-lg pointer-events-none">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept="image/*" 
                      className="hidden" 
                    />
                  </div>
                    
                   <div className="text-center space-y-1">
                    <h2 className="text-2xl font-bold drop-shadow-none text-foreground">{user.first_name} {user.last_name}</h2>
                    <p className="text-lg font-mono font-bold text-black/80">{user.registration_number}</p>
                    <div className="inline-flex items-center gap-2 bg-black/10 backdrop-blur-md px-3 py-1 rounded-full text-sm font-bold mt-2 text-black border border-black/10">
                      <MapPin className="w-3 h-3" />
                      {user.room_number ? `Room ${user.room_number}` : 'No Room Allocated'}
                    </div>
                  </div>
                </div>

                {/* QR Code */}
                {/* QR Code */}
                <div className="flex flex-col items-center gap-2 mt-2">
                  <div className="bg-white p-2 rounded-xl shadow-lg w-32 h-32 flex items-center justify-center overflow-hidden">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${user.registration_number || user.email}`}
                        alt="Student QR"
                        className="w-full h-full object-contain"
                      />
                  </div>
                  <p className="text-[10px] font-bold text-foreground opacity-60 tracking-widest uppercase">Scan to Verify</p>
                </div>

                {/* Live Clock */}
                <div className="w-full text-center mt-2">
                  <p className="text-sm font-mono opacity-80 animate-pulse">
                    LIVE: {currentTime.toLocaleTimeString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* BACK OF CARD */}
          {isFlipped && (
             <Card className="w-full aspect-[3/4.5] rounded-3xl overflow-hidden border-2 border-primary/50 shadow-2xl relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
               {/* Decorative pattern */}
               <div className="absolute inset-0 opacity-5 pointer-events-none" 
                    style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}>
               </div>

               <CardContent className="h-full flex flex-col p-6 relative z-10 overflow-y-auto">
                 {/* Header */}
                 <div className="mb-4">
                   <h3 className="text-lg font-black tracking-widest text-primary">EMERGENCY</h3>
                   <h3 className="text-lg font-black tracking-widest">DETAILS</h3>
                   <div className="h-1 w-12 bg-gradient-to-r from-primary to-orange-400 mt-2 rounded-full"></div>
                 </div>
                 
                 <div className="space-y-2.5 flex-1">
                   {/* Father's Name & Phone */}
                   <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 hover:bg-white/15 transition-all">
                     <div className="flex items-start gap-2.5">
                       <div className="p-1.5 bg-primary/20 rounded-lg mt-0.5 flex-shrink-0">
                         <User className="w-3.5 h-3.5 text-primary" />
                       </div>
                       <div className="flex-1 min-w-0">
                         <p className="text-[10px] font-bold opacity-60 uppercase tracking-wide mb-0.5">Father's Name</p>
                         <p className="font-bold text-sm text-white">{user.tenant?.father_name || <span className="text-gray-400 italic text-xs">Not Added</span>}</p>
                         <p className="text-[10px] font-bold opacity-60 uppercase tracking-wide mt-1 mb-0.5">Phone</p>
                         <p className="font-mono text-sm text-emerald-300">{user.tenant?.father_phone || <span className="text-gray-400 italic text-xs">Not Added</span>}</p>
                       </div>
                     </div>
                   </div>

                   {/* Mother's Name & Phone */}
                   <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 hover:bg-white/15 transition-all">
                     <div className="flex items-start gap-2.5">
                       <div className="p-1.5 bg-pink-500/20 rounded-lg mt-0.5 flex-shrink-0">
                         <Users className="w-3.5 h-3.5 text-pink-400" />
                       </div>
                       <div className="flex-1 min-w-0">
                         <p className="text-[10px] font-bold opacity-60 uppercase tracking-wide mb-0.5">Mother's Name</p>
                         <p className="font-bold text-sm text-white">{user.tenant?.mother_name || <span className="text-gray-400 italic text-xs">Not Added</span>}</p>
                         <p className="text-[10px] font-bold opacity-60 uppercase tracking-wide mt-1 mb-0.5">Phone</p>
                         <p className="font-mono text-sm text-pink-300">{user.tenant?.mother_phone || <span className="text-gray-400 italic text-xs">Not Added</span>}</p>
                       </div>
                     </div>
                   </div>

                   {/* Blood Group */}
                   <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 hover:bg-white/15 transition-all">
                     <div className="flex items-start gap-2.5">
                       <div className="p-1.5 bg-red-500/20 rounded-lg mt-0.5 flex-shrink-0">
                         <Droplet className="w-3.5 h-3.5 text-red-400" />
                       </div>
                       <div className="flex-1 min-w-0">
                         <p className="text-[10px] font-bold opacity-60 uppercase tracking-wide mb-0.5">Blood Group</p>
                         <p className="font-bold text-base text-red-300">{user.tenant?.blood_group || <span className="text-gray-400 italic text-xs">Not Added</span>}</p>
                       </div>
                     </div>
                   </div>

                   {/* Address */}
                   <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 hover:bg-white/15 transition-all">
                     <div className="flex items-start gap-2.5">
                       <div className="p-1.5 bg-blue-500/20 rounded-lg mt-0.5 flex-shrink-0">
                         <Home className="w-3.5 h-3.5 text-blue-400" />
                       </div>
                       <div className="flex-1 min-w-0">
                         <p className="text-[10px] font-bold opacity-60 uppercase tracking-wide mb-0.5">Address</p>
                         <p className="text-xs font-medium text-gray-100 leading-relaxed line-clamp-2">{user.tenant?.address || <span className="text-gray-400 italic text-xs">Not Added</span>}</p>
                       </div>
                     </div>
                   </div>

                   {/* College */}
                   <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 hover:bg-white/15 transition-all">
                     <div className="flex items-start gap-2.5">
                       <div className="p-1.5 bg-amber-500/20 rounded-lg mt-0.5 flex-shrink-0">
                         <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                       </div>
                       <div className="flex-1 min-w-0">
                         <p className="text-[10px] font-bold opacity-60 uppercase tracking-wide mb-0.5">College Code</p>
                         <p className="font-mono text-sm text-amber-300">{user.tenant?.college_code || <span className="text-gray-400 italic text-xs">Not Added</span>}</p>
                       </div>
                     </div>
                   </div>
                 </div>

                 {/* Footer */}
                 <div className="text-center pt-3 border-t border-white/10 mt-3">
                   <p className="text-[9px] font-bold opacity-50 text-white uppercase tracking-widest">ISSUED BY</p>
                   <p className="font-black tracking-widest mt-1 text-xs text-white">SMG GROUP OF INSTITUTIONS</p>
                 </div>
               </CardContent>
             </Card>
          )}

          <div className="absolute -bottom-16 left-0 right-0 flex justify-center">
            <Button 
              variant="outline" 
              size="lg"
              className="rounded-full h-12 px-8 bg-black text-white shadow-lg hover:bg-black/90 border-0 gap-2"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <RotateCw className="w-4 h-4" />
              {isFlipped ? 'Show Front' : 'View Details'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
