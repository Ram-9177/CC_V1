import { Bell, Menu, LogOut, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import ConnectionStatus from '../ConnectionStatus'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
// import { usePWAStore } from '@/lib/pwa-store'

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void
}

export default function Header({ setSidebarOpen }: HeaderProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  // const { isInstallable, install } = usePWAStore()

  const { data: unreadCount } = useQuery<{ unread_count: number }>({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const response = await api.get('/notifications/notifications/unread_count/')
      return response.data
    },
    enabled: !!user,
  })

  const hasUnreadNotifications = (unreadCount?.unread_count ?? 0) > 0

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur-xl border-b border-border/40 shadow-sm transition-all duration-300 safe-area-inset-top">
      {/* Mobile safe area adjustment */}
      <div className="flex items-center justify-between h-12 sm:h-14 md:h-16 px-2 sm:px-3 md:px-4 lg:px-8 gap-1 sm:gap-2">
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Mobile hamburger - always visible on mobile */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 sm:p-2.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg sm:rounded-xl transition-all duration-200 active:scale-95" 
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* Back button - only on non-home pages */}
          {location.pathname !== '/dashboard' && location.pathname !== '/' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-10 w-10 p-0 rounded-xl bg-primary/5 hover:bg-primary/15 hover:text-primary text-muted-foreground transition-all duration-200 shadow-sm border border-border/30 active:scale-95"
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

          {/* Install PWA Button - Disabled */}

          {/* Notifications bell */}
          <Link
            to="/notifications"
            className="p-2 sm:p-2.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg sm:rounded-xl relative transition-all duration-200 group active:scale-95 flex-shrink-0"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4 sm:h-5 sm:w-5 origin-center motion-safe:group-hover:animate-shake" />
            {hasUnreadNotifications ? (
              <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full ring-2 ring-background animate-pulse" />
            ) : null}
          </Link>

          {/* Divider - hide on mobile */}
          <div className="h-6 w-[1px] bg-border/40 mx-0.5 hidden md:block" />

          {/* User profile section - hide username on small screens */}
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 pl-1 sm:pl-2 flex-shrink-0">
            <div className="text-right hidden md:block">
              <p className="text-xs sm:text-sm font-bold text-foreground leading-tight mb-0.5">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{user?.role?.replace('_', ' ')}</p>
            </div>
            
            <Link 
              to="/digital-id"
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-br from-primary to-orange-500 p-[2px] shadow-lg shadow-primary/20 md:hidden flex-shrink-0 active:scale-95 transition-transform cursor-pointer"
            >
              <div className="h-full w-full rounded-full bg-background flex items-center justify-center text-primary text-[10px] sm:text-xs font-bold">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              aria-label="Logout"
              className="text-muted-foreground hover:text-destructive h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl hover:bg-destructive/10 transition-all duration-200 active:scale-95 flex-shrink-0 p-1.5 sm:p-2"
            >
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
