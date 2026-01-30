import { Bell, Menu, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store'
import { useNavigate } from 'react-router-dom'
import ConnectionStatus from '../ConnectionStatus'

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void
}

export default function Header({ setSidebarOpen }: HeaderProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-30 bg-primary border-b border-border">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden text-primary-foreground/80 hover:text-accent"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="flex-1" />

        <div className="flex items-center space-x-4">
          <ConnectionStatus />
          
          <button className="text-primary-foreground/80 hover:text-accent relative">
            <Bell className="h-6 w-6" />
            <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
          </button>

          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-sm font-medium text-primary-foreground">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-primary-foreground/70 capitalize">{user?.role}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
