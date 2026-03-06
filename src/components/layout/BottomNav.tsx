import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardCheck, Utensils, User, ShieldCheck, MapPinned, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';

interface BottomNavProps {
  onOpenSidebar?: () => void;
}

export function BottomNav({ onOpenSidebar }: BottomNavProps) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  // Define items per role, memoized to prevent re-renders
  const items = useMemo(() => {
    if (!user) return [];
    
    const navItems = [
      { name: 'Home', href: '/dashboard', icon: Home },
    ];

    if (user.role === 'student') {
      navItems.push(
        { name: 'Passes', href: '/gate-passes', icon: ClipboardCheck },
        { name: 'Meals', href: '/meals', icon: Utensils }
      );
    } else if (user.role === 'warden' || user.role === 'head_warden') {
      navItems.push(
        { name: 'Students', href: '/tenants', icon: User },
        { name: 'Passes', href: '/gate-passes', icon: ClipboardCheck }
      );
    } else if (['admin', 'super_admin'].includes(user.role)) {
      navItems.push(
        { name: 'Students', href: '/tenants', icon: User },
        { name: 'Passes', href: '/gate-passes', icon: ClipboardCheck }
      );
    } else if (user.role === 'chef' || user.role === 'head_chef') {
      navItems.push(
        { name: 'Meals', href: '/meals', icon: Utensils }
      );
    } else if (user.role === 'gate_security') {
      navItems.push(
        { name: 'Scan', href: '/gate-scans', icon: ShieldCheck },
        { name: 'Passes', href: '/gate-passes', icon: ClipboardCheck }
      );
    } else if (user.role === 'security_head') {
      navItems.push(
        { name: 'Scan', href: '/gate-scans', icon: ShieldCheck },
        { name: 'Map', href: '/room-mapping', icon: MapPinned }
      );
    }
    
    navItems.push({ name: 'Profile', href: '/profile', icon: User });
    
    // Keep max 4 items to make room for "More" button
    return navItems.slice(0, 4);
  }, [user]);

  // Bottom Nav is primarily for mobile users
  if (!user || items.length === 0) return null;



  return (
    <>
      {/* Bottom Navigation - Mobile only, above safe area */}
      <nav className="lg:hidden fixed bottom-4 left-0 right-0 z-50 pointer-events-none px-4 pb-safe">
        {/* Safe area spacer for notched devices */}
        <div className="mx-auto max-w-lg pointer-events-auto">
          {/* Cards approach for better UX on mobile - floating style */}
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] ring-1 ring-black/5 overflow-hidden">
            <div className="flex justify-around items-stretch h-[86px] px-2">
              {items.map((item) => {
                const isActive = location.pathname.startsWith(item.href);
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "relative flex flex-col items-center justify-center flex-1 min-w-[64px] h-full transition-all duration-300 group active:scale-90",
                      isActive ? "text-primary" : "text-slate-400 dark:text-slate-500 hover:text-slate-600"
                    )}
                  >
                    {/* Active indicator bar - subtle top dot */}
                    {isActive && (
                      <div className="absolute top-2.5 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_rgba(var(--primary),0.8)]" />
                    )}
                    
                    {/* Icon container with improved touch target */}
                    <div className={cn(
                      "relative z-10 transition-all duration-300 p-2.5 rounded-2xl flex items-center justify-center mb-1",
                      isActive ? "bg-primary/10 scale-110 shadow-inner" : ""
                    )}>
                      <Icon className={cn(
                        "h-6 w-6 transition-all duration-300",
                        isActive ? "stroke-[2.5px]" : "stroke-[2px]"
                      )} />
                    </div>
                    
                    {/* Label - optimized size */}
                    <span className={cn(
                      "font-black tracking-widest transition-all duration-300 uppercase text-[9px]",
                      isActive ? "text-primary opacity-100" : "text-slate-400 dark:text-slate-500 opacity-60"
                    )}>
                      {item.name}
                    </span>
                  </Link>
                );
              })}

              {/* "More" button - opens sidebar for full feature access */}
              <button
                onClick={onOpenSidebar}
                className="relative flex flex-col items-center justify-center flex-1 min-w-[64px] h-full transition-all duration-300 group active:scale-90 text-slate-400 dark:text-slate-500 hover:text-slate-600"
              >
                <div className="relative z-10 transition-all duration-300 p-2.5 rounded-2xl flex items-center justify-center mb-1">
                  <Menu className="h-6 w-6 stroke-[2px] transition-all duration-300" />
                </div>
                <span className="font-black tracking-widest transition-all duration-300 uppercase text-[9px] opacity-60">
                  More
                </span>
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Safe area spacer for bottom navigation - matches the floating nav height + offset */}
      <div className="lg:hidden h-32 safe-bottom" />
    </>
  );
}

export default BottomNav;
