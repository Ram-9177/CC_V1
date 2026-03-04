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

  // Bottom Nav is primarily for mobile users
  if (!user) return null;

  /* Define items per role — ALL roles get the essential tabs + "More" */
  let items = [
    { name: 'Home', href: '/dashboard', icon: Home },
    ...(user.role === 'student' ? [
      { name: 'Passes', href: '/gate-passes', icon: ClipboardCheck },
      { name: 'Meals', href: '/meals', icon: Utensils },
    ] : []),
    ...(user.role === 'warden' || user.role === 'head_warden' ? [
       { name: 'Students', href: '/tenants', icon: User },
       { name: 'Passes', href: '/gate-passes', icon: ClipboardCheck },
    ] : []),
     ...(['admin', 'super_admin'].includes(user.role) ? [
       { name: 'Students', href: '/tenants', icon: User },
       { name: 'Passes', href: '/gate-passes', icon: ClipboardCheck },
    ] : []),
    ...(user.role === 'chef' || user.role === 'head_chef' ? [
       { name: 'Meals', href: '/meals', icon: Utensils },
    ] : []),
    ...(user.role === 'gate_security' ? [
       { name: 'Scan', href: '/gate-scans', icon: ShieldCheck },
       { name: 'Passes', href: '/gate-passes', icon: ClipboardCheck },
    ] : []),
    ...(user.role === 'security_head' ? [
       { name: 'Scan', href: '/gate-scans', icon: ShieldCheck },
       { name: 'Map', href: '/room-mapping', icon: MapPinned },
    ] : []),
    { name: 'Profile', href: '/profile', icon: User },
  ];

  // Keep max 4 items to make room for "More" button
  items = items.slice(0, 4);

  return (
    <>
      {/* Bottom Navigation - Mobile only, above safe area */}
      <nav className="lg:hidden fixed bottom-6 left-0 right-0 z-50 pointer-events-none px-6">
        {/* Safe area spacer for notched devices */}
        <div className="mx-auto max-w-lg pointer-events-auto">
          {/* Cards approach for better UX on mobile - floating style */}
          <div className="bg-white/90 backdrop-blur-2xl border border-white/20 rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] ring-1 ring-black/5 overflow-hidden">
            <div className="flex justify-around items-stretch h-[82px] px-2">
              {items.map((item) => {
                const isActive = location.pathname.startsWith(item.href);
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "relative flex flex-col items-center justify-center flex-1 min-w-[60px] h-full transition-all duration-300 group active:scale-90",
                      isActive ? "text-primary" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {/* Active indicator bar - subtle top dot */}
                    {isActive && (
                      <div className="absolute top-2 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                    )}
                    
                    {/* Icon container with improved touch target */}
                    <div className={cn(
                      "relative z-10 transition-all duration-300 p-2.5 rounded-2xl flex items-center justify-center mb-1",
                      isActive ? "bg-primary/10 scale-110" : ""
                    )}>
                      <Icon className={cn(
                        "h-6 w-6 transition-all duration-300",
                        isActive ? "stroke-[2.5px]" : "stroke-[2px]"
                      )} />
                    </div>
                    
                    {/* Label - optimized size */}
                    <span className={cn(
                      "font-bold tracking-widest transition-all duration-300 uppercase text-[10px]",
                      isActive ? "text-primary opacity-100" : "text-slate-400 opacity-60"
                    )}>
                      {item.name}
                    </span>
                  </Link>
                );
              })}

              {/* "More" button - opens sidebar for full feature access */}
              <button
                onClick={onOpenSidebar}
                className="relative flex flex-col items-center justify-center flex-1 min-w-[60px] h-full transition-all duration-300 group active:scale-90 text-slate-400 hover:text-slate-600"
              >
                <div className="relative z-10 transition-all duration-300 p-2.5 rounded-2xl flex items-center justify-center mb-1">
                  <Menu className="h-6 w-6 stroke-[2px] transition-all duration-300" />
                </div>
                <span className="font-bold tracking-widest transition-all duration-300 uppercase text-[10px] text-slate-400 opacity-60">
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
