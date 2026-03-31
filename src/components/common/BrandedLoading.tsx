import React, { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

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
  "Connecting to CampusCore services...",
  "కాస్త వేచండి... almost there"
];

const MICRO_TIPS = [
  "Tip: You can continue from exactly where you left off.",
  "Tip: We are warming up data for faster next actions.",
  "లోడ్ అవుతోంది... your campus workspace is getting ready.",
  "Tip: Daily widgets refresh first, then deeper insights.",
  "దాదాపు సిద్ధం... preparing your dashboard cards."
];

export const BrandedLoading: React.FC<BrandedLoadingProps> = ({ 
  message: initialMessage,
  title,
  fullScreen = false,
  compact = false,
  overlay = false
}) => {
  const [displayMessage, setDisplayMessage] = useState(initialMessage || MESSAGES[0]);
  const [displayTip, setDisplayTip] = useState(MICRO_TIPS[0]);
  const [msgIndex, setMsgIndex] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    if (initialMessage || compact) return;
    
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 4000); // 4s instead of 2.5s

    return () => clearInterval(interval);
  }, [initialMessage, compact]);

  useEffect(() => {
    if (compact) return;

    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % MICRO_TIPS.length);
    }, 5000); // 5s instead of 3.2s

    return () => clearInterval(interval);
  }, [compact]);

  useEffect(() => {
    if (compact) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        // Faster increments but less frequent updates to reduce main-thread work
        return Math.min(prev + Math.floor(Math.random() * 12 + 6), 95);
      });
    }, 1200); 

    return () => clearInterval(interval);
  }, [compact]);

  useEffect(() => {
    if (!initialMessage && !compact) {
      setDisplayMessage(MESSAGES[msgIndex]);
    }
  }, [msgIndex, initialMessage, compact]);

  useEffect(() => {
    if (!compact) {
      setDisplayTip(MICRO_TIPS[tipIndex]);
    }
  }, [tipIndex, compact]);

  if (compact) {
    const loader = (
      <div className="flex items-center justify-center gap-2 py-2">
        <div className="relative flex h-7 w-7 items-center justify-center">
          <div className="absolute inset-0 rounded-sm border-2 border-primary/15" />
          <div className="absolute inset-0 rounded-sm border-2 border-transparent border-t-primary border-r-primary/70 animate-spin" />
        </div>
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest animate-pulse">
          {initialMessage || 'Processing... | కాస్త వేచండి'}
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
    ? "fixed inset-0 z-[9999] bg-background/80 backdrop-blur-lg flex flex-col items-center justify-center p-6 overflow-hidden"
    : "flex flex-col items-center justify-center p-12 w-full min-h-[300px] relative overflow-hidden";

  if (!fullScreen) {
    return (
      <div className="w-full min-h-[240px] rounded border border-border/40 bg-background/60 p-6 md:p-8">
        <div className="space-y-5">
          <div className="rounded-sm border border-border/40 bg-card/70 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Loading</p>
                <p className="text-sm font-bold text-foreground/90">Getting things ready... కాస్త వేచండి</p>
              </div>
              <span className="text-xs font-black text-primary">{progress}%</span>
            </div>
            <div className="mt-3 h-1.5 w-full rounded-sm bg-muted/40 overflow-hidden">
              <div className="h-full rounded-sm bg-primary transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-sm" />
            ))}
          </div>
          <Skeleton className="h-48 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <div className="relative mb-10 flex h-32 w-32 items-center justify-center">
        <div className="absolute inset-0 rounded-sm border-2 border-primary/10" />
        <div className="absolute inset-0 rounded-sm border-2 border-transparent border-t-primary animate-spin-slow" />
        <div className="absolute h-24 w-24 rounded-sm bg-primary/5 blur-2xl" />

        <div className="relative p-3 bg-white/75 dark:bg-black/45 backdrop-blur-md rounded shadow-xl ring-1 ring-black/5 dark:ring-white/10">
          <img 
            src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAYAAAA9zQYyAAACa0lEQVR42u3d0U1CQRCG0Z0NDdmD1mAHGCsy2oE1aA+WtDz5pDFcuVx25p5TgBL58jsi0Wg3MMYYjV2IiNj08wmYSoGHiKkUd4iYSnF3MTODtfoJIVNprbuYqbTWIWQqrXUXM5XWuouZSlF3MVMp6i5mKkXdxUylqLuYqRR19+Whkm6dqbTSXcxUitrJQe2TwzqTeaW7mKkUtZODfbzKAamDdm5Q4eyw0Dg5YFbh3MBCg6BB0LAsaPczFhoEDYIGQSNoEDQIGgQNgkbQIGgQNAgaBI2gQdAgaBA0CBpBg6BB0CBo+OGQ8lG/PHjmtvL8YaFB0CBoEDSCBkGDoEHQIGgEDYIGQYOgQdA0bx9N5PH186of//3p3mO20CBoEDSCBkGDoEHQIGgEDYIGQYOgQdAIGgQNggZBg6ARNAgaBA2CBkEjaBA0CBoEjaChkBhjjOZ/fdP8r28QNAgaBI2gQdAgaBA0CBpBg6BB0CBoaLXebQcWGkGDoEHQIGgQNIIGQYOgQdAgaAQN0ztM/ei+3jxDs7o7WmgQNAgaQYOgQdAgaBA0ggZBg6BB0CBoBA2CBkGDoKH5c7pYaBA0CBoEDYJG0CBoEDQIGr6DjojwZcBCg6BB0LAsaHc0FUREWGicHDB90M4Osp8bFhonB6QJ2tlB5nPj14UWNVljdnKwjxvaSpNxnf9caFGTLWYnB/t62c5Kk2mdz1poUZMl5rNPDlGTIeZFN7SomT3mxT8UipqZY/7XqxyiZtaYW2vtojj9bWlmCXmV16GtNTPFfPFCW2tmCXn13xRaa2bo52oRWmxuMYKbrKq42eo7+Ql+nrFZkIJjZwAAAABJRU5ErkJggg==" 
            alt="CampusCore" 
            className="h-14 w-14 rounded-sm object-cover"
          />
        </div>
      </div>

      <div className="flex flex-col items-center text-center gap-1.5 relative z-10 transition-all duration-500">
        <h1 className="text-xl font-black tracking-tight text-foreground/90 uppercase">
          {title || (
            <>Campus<span className="text-primary italic">Core</span></>
          )}
        </h1>

        <div className="h-5 overflow-hidden">
          <p key={displayMessage} className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] animate-fade-in-up">
            {displayMessage}
          </p>
        </div>

        <div className="mt-2 h-1.5 w-64 max-w-[80vw] rounded-sm bg-muted/45 overflow-hidden">
          <div className="h-full rounded-sm bg-primary transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-[10px] font-bold text-muted-foreground/90 tracking-wide">{progress}%</p>
        <p key={displayTip} className="text-[11px] text-muted-foreground/90 max-w-md animate-fade-in-up">{displayTip}</p>
      </div>

      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes logo-float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
          100% { transform: translateY(0px); }
        }
        @keyframes logo-pulse {
          0% { transform: scale(0.98); opacity: 0.4; }
          50% { transform: scale(1.02); opacity: 0.6; }
          100% { transform: scale(0.98); opacity: 0.4; }
        }
        @keyframes logo-ping {
          0% { transform: scale(1); opacity: 0.3; }
          100% { transform: scale(1.1); opacity: 0; }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
        .animate-logo-float {
          animation: logo-float 3s ease-in-out infinite;
        }
        .animate-logo-pulse {
          animation: logo-pulse 3s ease-in-out infinite;
        }
        .animate-logo-ping {
          animation: logo-ping 2.5s ease-out infinite;
        }
      `}</style>
    </div>
  );
};

export default BrandedLoading;
