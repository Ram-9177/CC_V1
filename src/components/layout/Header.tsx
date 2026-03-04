import { Menu, Bell } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void
}

export default function Header({ setSidebarOpen }: HeaderProps) {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()

  // Fetch unread notification count
  const { data: unreadCount } = useQuery<number>({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      try {
        const res = await api.get('/notifications/unread_count/')
        return res.data?.count ?? 0
      } catch {
        return 0
      }
    },
    refetchInterval: 30000,
    enabled: !!user,
  })

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/60 safe-top">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-10">
        {/* Left: Mobile hamburger + Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 rounded-xl hover:bg-muted/50"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-black text-foreground tracking-tight hidden sm:block lg:hidden">
            HostelConnect
          </h1>
        </div>

        {/* Right: Notifications + User */}
        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <button
            onClick={() => navigate('/notifications')}
            className="relative p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {(unreadCount ?? 0) > 0 && (
              <span className="absolute top-1.5 right-1.5 h-4 min-w-[16px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-sm">
                {(unreadCount ?? 0) > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Avatar */}
          <Link
            to="/profile"
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-muted/50 transition-all"
          >
            <div className="h-8 w-8 rounded-xl bg-primary/20 flex items-center justify-center">
              {user?.profile_picture ? (
                <img
                  src={user.profile_picture}
                  alt="Profile"
                  className="h-full w-full rounded-xl object-cover"
                />
              ) : (
                <span className="text-[10px] font-black text-primary">
                  {(user?.first_name?.[0] || user?.username?.[0])?.toUpperCase()}
                </span>
              )}
            </div>
          </Link>
        </div>
      </div>
    </header>
  )
}
