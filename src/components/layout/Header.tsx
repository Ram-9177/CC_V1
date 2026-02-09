import { Bell, Menu, LogOut, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import ConnectionStatus from '../ConnectionStatus'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void
}

export default function Header({ setSidebarOpen }: HeaderProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

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
    <header className="sticky top-0 z-30 bg-white border-b border-border shrink-0 shadow-sm">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>

          {location.pathname !== '/dashboard' && location.pathname !== '/' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="p-2 text-slate-600 hover:text-slate-900 transition-colors h-10 w-10 rounded-xl hover:bg-slate-100 flex items-center justify-center"
              title="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 sm:gap-4 font-medium tracking-tight">
          <ConnectionStatus />

          <Link
            to="/notifications"
            className="p-2 text-slate-600 hover:text-primary relative transition-colors"
          >
            <Bell className="h-5 w-5" />
            {hasUnreadNotifications ? (
              <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white" />
            ) : null}
          </Link>

          <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

          <div className="flex items-center gap-3 pl-2">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900 leading-none mb-1">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{user?.role}</p>
            </div>
            
            <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold sm:hidden">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-slate-500 hover:text-destructive h-9 w-9 rounded-xl hover:bg-destructive/10"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
