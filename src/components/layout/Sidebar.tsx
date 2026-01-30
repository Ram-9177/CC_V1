import { Link, useLocation } from 'react-router-dom'
import { 
  Home, 
  DoorOpen, 
  ClipboardCheck, 
  Utensils, 
  FileText, 
  BarChart3, 
  User, 
  Building2,
  Calendar,
  Bell,
  MessageSquare,
  QrCode,
  Users,
  Activity,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store'
import { canAccessPath } from '@/lib/rbac'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Rooms', href: '/rooms', icon: DoorOpen },
  { name: 'Gate Passes', href: '/gate-passes', icon: ClipboardCheck },
  { name: 'Attendance', href: '/attendance', icon: ClipboardCheck },
  { name: 'Meals', href: '/meals', icon: Utensils },
  { name: 'Notices', href: '/notices', icon: FileText },
  { name: 'Events', href: '/events', icon: Calendar },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Messages', href: '/messages', icon: MessageSquare },
  { name: 'Gate Scans', href: '/gate-scans', icon: QrCode },
  { name: 'Colleges', href: '/colleges', icon: Building2 },
  { name: 'Tenants', href: '/tenants', icon: Users },
  { name: 'Metrics', href: '/metrics', icon: Activity },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Profile', href: '/profile', icon: User },
]

interface SidebarProps {
  open: boolean
  setOpen: (open: boolean) => void
}

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const role = user?.role ?? null

  const filteredNavigation = navigation.filter((item) => canAccessPath(role, item.href))

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-primary border-r border-border transform transition-transform duration-300 ease-in-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-border">
          <div className="flex items-center space-x-2">
            <Building2 className="h-8 w-8 text-primary-foreground" />
            <span className="text-xl font-bold text-primary-foreground">SMG Hostel</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden text-primary-foreground/80 hover:text-accent"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {filteredNavigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium rounded-none border-b border-transparent transition-colors",
                  isActive
                    ? "text-accent border-accent"
                    : "text-primary-foreground/80 hover:text-accent hover:border-accent"
                )}
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}
