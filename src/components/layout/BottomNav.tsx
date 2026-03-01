import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardCheck, Utensils, User, ShieldCheck, MapPinned } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';

export function BottomNav() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  // Bottom Nav is primarily for mobile users
  if (!user) return null;

  /* Define items per role */
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
       { name: 'Rooms', href: '/rooms', icon: Home },
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

  // Limit to 5 items max for mobile layout constraints
  items = items.slice(0, 5);

  return (
    <>
      {/* Bottom Navigation - Mobile only, above safe area */}
      <nav className="lg:hidden fixed bottom-6 left-0 right-0 z-50 pointer-events-none px-4">
        {/* Safe area spacer for notched devices */}
        <div className="mx-auto max-w-lg pointer-events-auto">
          {/* Cards approach for better UX on mobile - floating style */}
          <div className="bg-background/80 backdrop-blur-3xl border border-border/50 rounded-[2.5rem] shadow-[0_15px_40px_-5px_rgba(0,0,0,0.15)] ring-1 ring-black/5 overflow-hidden">
            <div className="flex justify-around items-stretch h-18 px-1">
              {items.map((item) => {
                const isActive = location.pathname.startsWith(item.href);
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "relative flex flex-col items-center justify-center flex-1 min-w-[64px] h-full transition-all duration-300 group active:scale-95",
                      isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {/* Active indicator bar - subtle top dot */}
                    {isActive && (
                      <div className="absolute top-1.5 h-1 w-1 rounded-full bg-primary" />
                    )}
                    
                    {/* Icon container with improved touch target */}
                    <div className={cn(
                      "relative z-10 transition-all duration-300 p-2 rounded-xl flex items-center justify-center",
                      isActive ? "bg-primary/10 scale-105" : ""
                    )}>
                      <Icon className={cn(
                        "h-5 w-5 transition-all duration-300",
                        isActive ? "stroke-[2.5px]" : "stroke-[2px]"
                      )} />
                    </div>
                    
                    {/* Label - optimized size */}
                    <span className={cn(
                      "font-black tracking-widest transition-all duration-300 mt-0.5 text-center px-1 uppercase text-[8px]",
                      isActive ? "text-primary opacity-100" : "text-muted-foreground opacity-60"
                    )}>
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>
      
      {/* Safe area spacer for bottom navigation - matches the floating nav height + offset */}
      <div className="lg:hidden h-28 safe-bottom" />
    </>
  );
}

export default BottomNav;
