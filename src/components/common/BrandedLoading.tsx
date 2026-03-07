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
            fetchPriority="high"
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

      {/* Standard Progress bar */}
      <div className="w-48 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-10 overflow-hidden relative border border-black/5 dark:border-white/5">
        <div className="h-full bg-primary w-1/3 rounded-full animate-premium-progress shadow-[0_0_15px_rgba(var(--primary),0.4)]" />
      </div>

      <style>{`
        @keyframes premium-progress {
          0% { left: -100%; width: 30%; }
          50% { left: 40%; width: 50%; }
          100% { left: 100%; width: 30%; }
        }
        .animate-premium-progress {
          animation: premium-progress 1.5s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite;
        }
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
