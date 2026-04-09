import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardCheck, Utensils, User, ShieldCheck, MapPinned, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { canAccessPath } from '@/lib/rbac';

interface BottomNavProps {
  onOpenSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export function BottomNav({ onOpenSidebar, isSidebarOpen }: BottomNavProps) {
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
    
    // Filter items based on access before slicing
    const filteredItems = navItems.filter(item => 
      canAccessPath(user.role, item.href, user.student_type, user.is_student_hr)
    );
    
    // Keep max 5 items for mobile bottom nav
    return filteredItems.slice(0, 5);
  }, [user]);

  // Bottom Nav is primarily for mobile users
  if (!user || items.length === 0) return null;

  return (
    <>
      {/* Bottom Navigation - Mobile only, above safe area */}
      <nav
        className={cn(
          "lg:hidden fixed bottom-3 left-0 right-0 z-50 px-3 pb-safe transition-all duration-500 ease-out",
          isSidebarOpen ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
        )}
        style={{ transform: `translateY(${isSidebarOpen ? '5rem' : '0'})` }}
      >
        {/* Safe area spacer for notched devices */}
        <div className="mx-auto max-w-lg pointer-events-auto">
          {/* Cards approach for better UX on mobile - floating style */}
          <div className="bg-card/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
            <div className="flex justify-around items-center h-[3.75rem] px-3">
              {items.map((item) => {
                const isActive = location.pathname.startsWith(item.href);
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "relative flex flex-col items-center justify-center min-w-0 transition-all duration-200 group active:scale-90 px-3",
                      isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className={cn(
                      "h-5 w-5 transition-all duration-200",
                      isActive ? "stroke-[2.5px] text-primary" : "stroke-[2px] text-muted-foreground group-hover:text-foreground"
                    )} />
                    
                    <span className={cn(
                      "font-semibold tracking-tight transition-all duration-200 text-[9px] mt-0.5 max-w-[56px] truncate text-center",
                      isActive ? "text-primary opacity-100" : "text-muted-foreground opacity-80"
                    )}>
                      {item.name}
                    </span>
                  </Link>
                );
              })}

              {/* "More" button - opens sidebar for full feature access */}
              <button
                onClick={onOpenSidebar}
                className="relative flex flex-col items-center justify-center min-w-0 transition-all duration-200 group active:scale-90 text-muted-foreground hover:text-foreground px-3"
              >
                <Menu className="h-5 w-5 stroke-[2px] mb-0.5" />
                <span className="font-semibold tracking-tight text-[9px] opacity-60 max-w-[56px] truncate text-center">
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
