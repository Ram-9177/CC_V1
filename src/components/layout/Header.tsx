import { Bell, Menu, LogOut, ArrowLeft, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import ConnectionStatus from '../ConnectionStatus'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { usePWAStore } from '@/lib/pwa-store'
import { useRealtimeNotificationSync } from '@/hooks/useWebSocket'
import { memo } from 'react'

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void
}

const Header = memo(function Header({ setSidebarOpen }: HeaderProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { isInstallable, install } = usePWAStore()
  
  // Real-time zero-refresh sync
  useRealtimeNotificationSync()

  const { data: unreadCount } = useQuery<{ unread_count: number }>({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const response = await api.get('/notifications/notifications/unread_count/')
      return response.data
    },
    enabled: !!user,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
    staleTime: 10 * 1000,
  })

  const hasUnreadNotifications = (unreadCount?.unread_count ?? 0) > 0

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-background/90 backdrop-blur-2xl border-b border-border/40 shadow-sm transition-all duration-300">
      <div className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-4 md:px-6 lg:px-10 gap-2">
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Mobile hamburger - always visible on mobile */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all duration-200 active:scale-95" 
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Back button - only on non-home pages */}
          {location.pathname !== '/dashboard' && location.pathname !== '/' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-10 w-10 p-0 rounded-2xl bg-secondary/50 hover:bg-secondary hover:text-primary text-muted-foreground transition-all duration-200 shadow-sm border border-border/30 active:scale-95"
              title="Go back"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1 sm:gap-2 md:gap-3 lg:gap-4 font-medium tracking-tight flex-shrink-0">
          {/* Connection status - hide on very small screens */}
          <div className="hidden sm:block">
            <ConnectionStatus />
          </div>

          {/* Install PWA Button - Desktop only, appears when installable */}
          {isInstallable && (
            <Button
              variant="outline"
              size="sm"
              onClick={install}
              className="hidden md:flex items-center gap-2 rounded-2xl border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all duration-300 shadow-sm px-4 h-10 border-2 font-black uppercase tracking-tighter text-[10px]"
            >
              <Download className="h-3.5 w-3.5" />
              Install App
            </Button>
          )}

          {/* Notifications bell */}
          <Link
            to="/notifications"
            className="p-2.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl relative transition-all duration-200 group active:scale-95 flex-shrink-0 border border-transparent hover:border-primary/20"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 origin-center motion-safe:group-hover:animate-shake" />
            {hasUnreadNotifications ? (
              <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-red-500 rounded-full ring-2 ring-background animate-pulse" />
            ) : null}
          </Link>

          {/* Divider - hide on mobile */}
          <div className="h-6 w-[1px] bg-border/40 mx-1 hidden md:block" />

          {/* User profile section - hide username on small screens */}
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 pl-1 sm:pl-2 flex-shrink-0">
            <div className="text-right hidden md:block">
              <p className="text-xs sm:text-sm font-black text-foreground leading-tight mb-0.5">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{user?.role?.replace('_', ' ')}</p>
            </div>
            
            <Link 
              to="/digital-id"
              className="h-10 w-10 rounded-2xl bg-primary/20 p-[2px] shadow-sm md:hidden flex-shrink-0 active:scale-95 transition-transform cursor-pointer border border-primary/20"
            >
              <div className="h-full w-full rounded-2xl bg-white flex items-center justify-center text-primary text-[10px] sm:text-xs font-black uppercase">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              aria-label="Logout"
              className="text-muted-foreground hover:text-destructive h-10 w-10 rounded-2xl hover:bg-destructive/10 transition-all duration-200 active:scale-95 flex-shrink-0"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
})

export default Header
