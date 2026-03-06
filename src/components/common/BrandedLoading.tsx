import React, { useState, useEffect } from 'react';

interface BrandedLoadingProps {
  message?: string;
  title?: string;
  fullScreen?: boolean;
}

const MESSAGES = [
  "Securing your session...",
  "Optimizing campus gateway...",
  "Syncing digital records...",
  "Authenticating credentials...",
  "Powering up your dashboard...",
  "Connecting to hostel servers..."
];

export const BrandedLoading: React.FC<BrandedLoadingProps> = ({ 
  message: initialMessage,
  title,
  fullScreen = false 
}) => {
  const [displayMessage, setDisplayMessage] = useState(initialMessage || MESSAGES[0]);
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (initialMessage) return;
    
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [initialMessage]);

  useEffect(() => {
    if (!initialMessage) {
      setDisplayMessage(MESSAGES[msgIndex]);
    }
  }, [msgIndex, initialMessage]);

  const containerClasses = fullScreen 
    ? "fixed inset-0 z-[9999] bg-background/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 overflow-hidden"
    : "flex flex-col items-center justify-center p-12 w-full min-h-[300px] relative overflow-hidden";

  return (
    <div className={containerClasses}>
      {/* Background Decorative Blobs (FullScreen Only) */}
      {fullScreen && (
        <>
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full animate-blob" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/10 blur-[120px] rounded-full animate-blob animation-delay-2000" />
        </>
      )}

      <div className="relative mb-12 flex items-center justify-center">
        {/* Animated Outer Ring (Slow) */}
        <div className="absolute w-32 h-32 border-[3px] border-primary/10 border-t-primary/40 rounded-[2.5rem] animate-spin-slow opacity-60" />
        
        {/* Animated Inner Ring (Fast) */}
        <div className="absolute w-24 h-24 border-[3px] border-primary/20 border-b-primary rounded-[1.8rem] animate-spin-reverse opacity-80" />
        
        {/* Subtle Pulse Aura */}
        <div className="absolute w-40 h-40 bg-primary/5 blur-3xl rounded-full animate-pulse-slow" />
        
        {/* Logo Container with Glassmorphism */}
        <div className="relative p-1.5 bg-white/40 dark:bg-black/40 backdrop-blur-md rounded-[1.6rem] shadow-2xl shadow-primary/20 ring-1 ring-white/50 dark:ring-white/10 animate-float">
          <img 
            src="/pwa/icon-180.png" 
            alt="HostelConnect" 
            className="h-16 w-16 rounded-[1.2rem] object-cover grayscale-[0.2] brightness-110 shadow-inner"
          />
        </div>
      </div>

      <div className="flex flex-col items-center text-center gap-3 relative z-10 transition-all duration-500">
        <div className="flex items-center gap-2">
          <span className="h-[1px] w-8 bg-gradient-to-r from-transparent to-primary/40" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground/90 font-display">
            {title || (
              <>Hostel<span className="text-primary italic">Connect</span></>
            )}
          </h1>
          <span className="h-[1px] w-8 bg-gradient-to-l from-transparent to-primary/40" />
        </div>

        <div className="h-6 overflow-hidden">
          <p key={displayMessage} className="text-sm font-semibold text-muted-foreground/80 tracking-wide animate-fade-in-up uppercase">
            {displayMessage}
          </p>
        </div>
      </div>

      {/* Modern Indeterminate Progress bar */}
      <div className="w-56 h-1 bg-muted/30 rounded-full mt-10 overflow-hidden relative">
        <div className="absolute inset-0 bg-primary/5" />
        <div className="h-full bg-gradient-to-r from-primary/40 via-primary to-primary/40 w-1/2 rounded-full animate-premium-progress shadow-[0_0_15px_rgba(142,202,230,0.5)]" />
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite alternate ease-in-out;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-float {
          animation: float 3s infinite ease-in-out;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-spin-reverse {
          animation: spin-reverse 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes premium-progress {
          0% { left: -100%; width: 30%; }
          50% { left: 20%; width: 60%; }
          100% { left: 100%; width: 30%; }
        }
        .animate-premium-progress {
          animation: premium-progress 2s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite;
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.5s ease-out forwards;
        }
        .animate-pulse-slow {
          animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
};

export default BrandedLoading;
