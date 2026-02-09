import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store'; // Correct path based on grep results
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCw, ShieldCheck, Phone, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DigitalID() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock to prevent screenshots
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
            <Card className="w-full aspect-[3/4.5] rounded-3xl overflow-hidden border-0 shadow-2xl relative bg-gradient-to-br from-primary to-orange-600 text-white">
              {/* Watermark/Pattern */}
              <div className="absolute inset-0 opacity-10 pointer-events-none" 
                   style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}>
              </div>

              <CardContent className="h-full flex flex-col items-center justify-between p-8 relative z-10">
                {/* Header */}
                <div className="w-full flex justify-between items-start">
                  <img src="/pwa/icon-192.png" alt="Logo" className="w-12 h-12 rounded-lg bg-white/20 backdrop-blur-sm p-1" />
                  <div className="text-right">
                    <p className="text-xs font-medium opacity-80 uppercase tracking-widest">Hostel ID</p>
                    <p className="font-bold tracking-widest">SMG-HOSTEL</p>
                  </div>
                </div>

                {/* Photo & Details */}
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full border-4 border-white/30 overflow-hidden bg-white shadow-inner">
                      <img 
                        src={user.profile_picture || `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=random`} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute bottom-0 right-0 bg-emerald-500 text-white p-1.5 rounded-full border-2 border-primary shadow-lg">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </div>
                  
                  <div className="text-center space-y-1">
                    <h2 className="text-2xl font-bold drop-shadow-md">{user.first_name} {user.last_name}</h2>
                    <p className="text-lg font-mono opacity-90">{user.registration_number}</p>
                    <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-sm font-medium mt-2">
                      <MapPin className="w-3 h-3" />
                      {user.room_number ? `Room ${user.room_number}` : 'No Room Allocated'}
                    </div>
                  </div>
                </div>

                {/* QR Code Placeholder */}
                <div className="bg-white p-2 rounded-xl shadow-lg w-32 h-32 flex items-center justify-center">
                    {/* In real app, use a QR library. For now, simulate. */}
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white text-xs text-center p-1 break-all">
                        {/* Placeholder visual */}
                        <div className="grid grid-cols-4 gap-1 w-full h-full opacity-80">
                            {[...Array(16)].map((_, i) => (
                                <div key={i} className={`bg-current rounded-sm ${Math.random() > 0.5 ? 'opacity-100' : 'opacity-20'}`} />
                            ))}
                        </div>
                    </div>
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
             <Card className="w-full aspect-[3/4.5] rounded-3xl overflow-hidden border-0 shadow-2xl relative bg-slate-800 text-white">
               <CardContent className="h-full flex flex-col p-8 relative z-10">
                 <div className="flex-1 space-y-6">
                   <h3 className="text-lg font-bold border-b border-white/20 pb-2">Emergency Details</h3>
                   
                   <div className="space-y-4">
                     <div className="space-y-1">
                       <p className="text-xs opacity-50 uppercase">Father's Name</p>
                       <p className="font-medium">{user.tenant?.father_name || 'N/A'}</p>
                     </div>
                     <div className="space-y-1">
                       <p className="text-xs opacity-50 uppercase">Emergency Contact</p>
                       <div className="flex items-center gap-2">
                         <Phone className="w-4 h-4 text-emerald-400" />
                         <p className="font-medium font-mono">{user.tenant?.emergency_contact || 'N/A'}</p>
                       </div>
                     </div>
                     <div className="space-y-1">
                       <p className="text-xs opacity-50 uppercase">Blood Group</p>
                       <p className="font-medium text-red-400">{user.tenant?.blood_group || 'N/A'}</p>
                     </div>
                     <div className="space-y-1">
                       <p className="text-xs opacity-50 uppercase">Address</p>
                       <p className="text-sm opacity-80 leading-relaxed">{user.tenant?.address || 'N/A'}</p>
                     </div>
                   </div>
                 </div>

                 <div className="text-center pt-6 border-t border-white/20">
                   <p className="text-xs opacity-50">ISSUED BY AUTHORITY OF</p>
                   <p className="font-bold tracking-widest mt-1">SMG GROUP OF INSTITUTIONS</p>
                 </div>
               </CardContent>
             </Card>
          )}

          {/* Flip Button */}
          <div className="absolute -bottom-16 left-0 right-0 flex justify-center">
            <Button 
              variant="outline" 
              size="lg"
              className="rounded-full h-12 px-8 bg-white/90 backdrop-blur shadow-lg hover:bg-white border-primary/20 text-primary gap-2"
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
