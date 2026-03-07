import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Utensils, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

// Global Meal Timings (fallback if not provided by backend)
const DEFAULT_TIMINGS = {
  breakfast: { start: '07:00', end: '09:00' },
  lunch: { start: '12:20', end: '13:30' },
  dinner: { start: '19:30', end: '20:50' },
};

interface DiningCountdownProps {
  className?: string;
}

export function DiningCountdown({ className }: DiningCountdownProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const mealSchedule = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const getMealDate = (timeStr: string, isNextDay = false) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const date = new Date(today);
      date.setHours(hours, minutes, 0, 0);
      if (isNextDay) date.setDate(date.getDate() + 1);
      return date;
    };

    const schedule = [
      { 
        type: 'breakfast', 
        start: getMealDate(DEFAULT_TIMINGS.breakfast.start), 
        end: getMealDate(DEFAULT_TIMINGS.breakfast.end) 
      },
      { 
        type: 'lunch', 
        start: getMealDate(DEFAULT_TIMINGS.lunch.start), 
        end: getMealDate(DEFAULT_TIMINGS.lunch.end) 
      },
      { 
        type: 'dinner', 
        start: getMealDate(DEFAULT_TIMINGS.dinner.start), 
        end: getMealDate(DEFAULT_TIMINGS.dinner.end) 
      },
      { 
        type: 'breakfast', 
        start: getMealDate(DEFAULT_TIMINGS.breakfast.start, true), 
        end: getMealDate(DEFAULT_TIMINGS.breakfast.end, true) 
      },
    ];

    return schedule;
  }, [now]);

  const currentMealState = useMemo(() => {
    // Check if we are currently in a meal
    const active = mealSchedule.find(m => now >= m.start && now <= m.end);
    if (active) {
      return { 
        meal: active, 
        isActive: true, 
        label: `Current: ${active.type.charAt(0).toUpperCase() + active.type.slice(1)}`,
        target: active.end 
      };
    }

    // Find next meal
    const next = mealSchedule.find(m => now < m.start);
    if (next) {
      return { 
        meal: next, 
        isActive: false, 
        label: `Next: ${next.type.charAt(0).toUpperCase() + next.type.slice(1)}`,
        target: next.start 
      };
    }

    return null;
  }, [now, mealSchedule]);

  const countdown = useMemo(() => {
    if (!currentMealState) return '00:00:00';
    const diff = currentMealState.target.getTime() - now.getTime();
    if (diff <= 0) return '00:00:00';

    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, [now, currentMealState]);

  if (!currentMealState) return null;

  return (
    <div className={cn("flex flex-col gap-1 w-full", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
           <div className={cn(
             "w-2 h-2 rounded-full",
             currentMealState.isActive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" : "bg-amber-500"
           )} />
           <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none">
             {currentMealState.label}
           </span>
        </div>
        <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">
          {currentMealState.isActive ? "END " : "ST "}
          {currentMealState.isActive 
            ? currentMealState.meal.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : currentMealState.meal.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        </span>
      </div>

      <div className="flex items-center gap-3 bg-white border border-slate-100/50 rounded-2xl p-4 shadow-sm transition-all hover:bg-slate-50 relative group">
        <div className={cn(
          "p-3 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
          currentMealState.isActive ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"
        )}>
           {currentMealState.isActive ? <Utensils className="w-5 h-5 shadow-sm" /> : <Clock className="w-5 h-5" />}
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">
            {currentMealState.isActive ? 'Closes In' : 'Starts In'}
          </p>
          <p className="font-mono text-xl font-black text-slate-900 tracking-tighter tabular-nums">
            {countdown}
          </p>
        </div>
        <Link 
          to="/meals" 
          className="p-3 bg-slate-900 text-white rounded-xl shadow-lg shadow-black/10 hover:bg-slate-800 transition-all hover:scale-105 active:scale-95"
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
