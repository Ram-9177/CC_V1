import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardCheck, Utensils, Bell, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';

export function BottomNav() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  // Bottom Nav is primarily for students
  if (user?.role !== 'student') return null;

  const items = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Passes', href: '/gate-passes', icon: ClipboardCheck },
    { name: 'Meals', href: '/meals', icon: Utensils },
    { name: 'Notices', href: '/notices', icon: Bell },
    { name: 'Profile', href: '/profile', icon: User },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border px-4 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-between items-center h-16 max-w-md mx-auto">
        {items.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 transition-all",
                "min-w-[64px] h-full"
              )}
            >
              {isActive && (
                <span className="absolute -top-1 w-12 h-1 bg-primary rounded-full" />
              )}
              <item.icon className={cn(
                "h-5 w-5 transition-colors duration-200",
                isActive ? "text-primary scale-110" : "text-muted-foreground/60"
              )} />
              <span className={cn(
                "text-[10px] font-bold tracking-tight transition-colors duration-200",
                isActive ? "text-primary" : "text-muted-foreground/60"
              )}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default BottomNav;
