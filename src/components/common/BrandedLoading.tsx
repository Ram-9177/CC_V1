import React from 'react';

interface BrandedLoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export const BrandedLoading: React.FC<BrandedLoadingProps> = ({ 
  message = "Loading...", 
  fullScreen = false 
}) => {
  const containerClasses = fullScreen 
    ? "fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center p-6"
    : "flex flex-col items-center justify-center p-8 w-full min-h-[200px]";

  return (
    <div className={containerClasses}>
      <div className="relative mb-6">
        {/* Animated Glow Surround */}
        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-110 animate-pulse" />
        
        {/* Logo Icon Container */}
        <div className="relative p-1 bg-white rounded-3xl shadow-2xl shadow-primary/10 ring-1 ring-primary/5">
          <img 
            src="/pwa/icon-180.png" 
            alt="HostelConnect" 
            className="h-20 w-20 rounded-[1.4rem] object-cover"
          />
        </div>
        
        {/* Rotating Segmented Ring */}
        <div className="absolute -inset-2 border-2 border-primary/20 border-t-primary rounded-[2rem] animate-spin duration-1000" />
      </div>

      <div className="flex flex-col items-center gap-1">
        <div className="text-xl font-bold tracking-tight text-foreground flex items-center">
          Hostel <span className="text-primary ml-1.5">Connect</span>
        </div>
        <p className="text-sm font-medium text-muted-foreground animate-shimmer whitespace-nowrap">
          {message}
        </p>
      </div>

      {/* Progress Bar (Indeterminate) */}
      <div className="w-48 h-1 bg-primary/5 rounded-full mt-6 overflow-hidden">
        <div className="w-1/3 h-full bg-gradient-to-r from-primary to-orange-400 rounded-full animate-progress" />
      </div>

      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%) scaleX(0.5); }
          50% { transform: translateX(0%) scaleX(1); }
          100% { transform: translateX(200%) scaleX(0.5); }
        }
        .animate-progress {
          animation: progress 1.5s ease-in-out infinite;
        }
        .animate-shimmer {
          mask-image: linear-gradient(
            -75deg,
            rgba(0, 0, 0, 1) 30%,
            rgba(0, 0, 0, 0.5) 50%,
            rgba(0, 0, 0, 1) 70%
          );
          mask-size: 200%;
          animation: shimmer 2s infinite linear;
        }
        @keyframes shimmer {
          from { mask-position: 150%; }
          to { mask-position: -50%; }
        }
      `}</style>
    </div>
  );
};

export default BrandedLoading;
