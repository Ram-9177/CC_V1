import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardCheck, Utensils, Bell, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';

export function BottomNav() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  // Bottom Nav is primarily for mobile users
  if (!user) return null;

  const items = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Passes', href: '/gate-passes', icon: ClipboardCheck },
    { name: 'Meals', href: '/meals', icon: Utensils },
    { name: 'Notices', href: '/notices', icon: Bell },
    { name: 'Profile', href: '/profile', icon: User },
  ];

  return (
    <>
      {/* Bottom Navigation - Mobile only, above safe area */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-background via-background to-transparent pointer-events-none">
        {/* Safe area spacer for notched devices */}
        <div className="h-1" />
        
        <div className="px-3 pb-4 pt-2 pointer-events-auto safe-area-inset-bottom">
          {/* Cards approach for better UX on mobile */}
          <div className="mx-auto max-w-2xl bg-background/95 backdrop-blur-2xl border border-border/50 rounded-3xl shadow-2xl ring-1 ring-black/5 overflow-hidden">
            <div className="flex justify-around items-stretch h-20 px-1">
              {user.role === 'student' && items.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "relative flex flex-col items-center justify-center flex-1 min-w-[56px] h-20 transition-all duration-300 group active:scale-95",
                      isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <div className="absolute inset-0 bg-primary/5 rounded-2xl -m-2" />
                    )}
                    
                    {/* Icon container with improved touch target */}
                    <div className={cn(
                      "relative z-10 transition-all duration-300 p-2.5 rounded-2xl flex items-center justify-center",
                      isActive ? "bg-primary/15 scale-110 shadow-lg shadow-primary/20" : "group-active:bg-primary/5"
                    )}>
                      <Icon className={cn(
                        "h-5.5 w-5.5 transition-all duration-300",
                        isActive ? "stroke-[2.5px]" : "stroke-[2px]"
                      )} />
                    </div>
                    
                    {/* Label - always visible but with animation */}
                    <span className={cn(
                      "text-[9px] font-bold tracking-wider transition-all duration-300 mt-1 text-center px-1 leading-tight",
                      isActive ? "text-primary opacity-100" : "text-muted-foreground opacity-70 text-[8px]"
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
      
      {/* Safe area spacer for bottom navigation */}
      <div className="lg:hidden h-24 sm:h-28" />
    </>
  );
}

export default BottomNav;
