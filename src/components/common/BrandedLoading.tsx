import React, { useState, useEffect } from 'react';

interface BrandedLoadingProps {
  message?: string;
  title?: string;
  fullScreen?: boolean;
  compact?: boolean;
  overlay?: boolean;
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
  fullScreen = false,
  compact = false,
  overlay = false
}) => {
  const [displayMessage, setDisplayMessage] = useState(initialMessage || MESSAGES[0]);
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (initialMessage || compact) return;
    
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [initialMessage, compact]);

  useEffect(() => {
    if (!initialMessage && !compact) {
      setDisplayMessage(MESSAGES[msgIndex]);
    }
  }, [msgIndex, initialMessage, compact]);

  if (compact) {
    const loader = (
      <div className="flex items-center justify-center gap-2 py-2">
        <div className="relative flex items-center justify-center scale-[0.3]">
          <div className="absolute w-24 h-24 border-[4px] border-primary/10 border-t-primary rounded-full animate-spin" />
          <div className="absolute w-28 h-28 bg-primary/10 blur-xl rounded-full animate-pulse" />
        </div>
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest animate-pulse">
          {initialMessage || 'Processing...'}
        </span>
      </div>
    );

    if (overlay) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] z-40 rounded-inherit">
          {loader}
        </div>
      );
    }

    return loader;
  }

  const containerClasses = fullScreen 
    ? "fixed inset-0 z-[9999] bg-background/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 overflow-hidden"
    : "flex flex-col items-center justify-center p-12 w-full min-h-[300px] relative overflow-hidden";

  return (
    <div className={containerClasses}>
      <div className="relative mb-10 flex items-center justify-center">
        {/* Simplified Single Spinner */}
        <div className="absolute w-28 h-28 border-2 border-primary/10 border-t-primary rounded-full animate-spin opacity-80" />
        
        {/* Pulsing Aura - Reduced Intensity */}
        <div className="absolute w-36 h-36 bg-primary/5 blur-2xl rounded-full animate-pulse" />
        
        {/* Centered Logo */}
        <div className="relative p-2 bg-white/60 dark:bg-black/40 backdrop-blur-md rounded-3xl shadow-xl ring-1 ring-black/5 dark:ring-white/10">
          <img 
            src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAYAAAA9zQYyAAACa0lEQVR42u3d0U1CQRCG0Z0NDdmD1mAHGCsy2oE1aA+WtDz5pDFcuVx25p5TgBL58jsi0Wg3MMYYjV2IiNj08wmYSoGHiKkUd4iYSnF3MTODtfoJIVNprbuYqbTWIWQqrXUXM5XWuouZSlF3MVMp6i5mKkXdxUylqLuYqRR19+Whkm6dqbTSXcxUitrJQe2TwzqTeaW7mKkUtZODfbzKAamDdm5Q4eyw0Dg5YFbh3MBCg6BB0LAsaPczFhoEDYIGQSNoEDQIGgQNgkbQIGgQNAgaBI2gQdAgaBA0CBpBg6BB0CBo+OGQ8lG/PHjmtvL8YaFB0CBoEDSCBkGDoEHQIGgEDYIGQYOgQdA0bx9N5PH186of//3p3mO20CBoEDSCBkGDoEHQIGgEDYIGQYOgQdAIGgQNggZBg6ARNAgaBA2CBkEjaBA0CBoEjaChkBhjjOZ/fdP8r28QNAgaBI2gQdAgaBA0CBpBg6BB0CBoaLXebQcWGkGDoEHQIGgQNIIGQYOgQdAgaAQN0ztM/ei+3jxDs7o7WmgQNAgaQYOgQdAgaBA0ggZBg6BB0CBoBA2CBkGDoKH5c7pYaBA0CBoEDYJG0CBoEDQIGr6DjojwZcBCg6BB0LAsaHc0FUREWGicHDB90M4Osp8bFhonB6QJ2tlB5nPj14UWNVljdnKwjxvaSpNxnf9caFGTLWYnB/t62c5Kk2mdz1poUZMl5rNPDlGTIeZFN7SomT3mxT8UipqZY/7XqxyiZtaYW2vtojj9bWlmCXmV16GtNTPFfPFCW2tmCXn13xRaa2bo52oRWmxuMYKbrKq42eo7+Ql+nrFZkIJjZwAAAABJRU5ErkJggg==" 
            alt="HostelConnect" 
            className="h-14 w-14 rounded-2xl object-cover"
          />
        </div>
      </div>

      <div className="flex flex-col items-center text-center gap-1.5 relative z-10 transition-all duration-500">
        <h1 className="text-xl font-black tracking-tight text-foreground/90 uppercase">
          {title || (
            <>Hostel <span className="text-primary italic">Connect</span></>
          )}
        </h1>

        <div className="h-5 overflow-hidden">
          <p key={displayMessage} className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] animate-fade-in-up">
            {displayMessage}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default BrandedLoading;
