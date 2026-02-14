import { Link, useLocation } from 'react-router-dom'
import { 
  Home, 
  DoorOpen, 
  Bed,
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
  X,
  ChevronRight,
  Hammer,
  UserPlus,
  ShieldAlert
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store'
import { canAccessPath } from '@/lib/rbac'
import type { SidebarCategory } from '@/types'

const categories: SidebarCategory[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
      { name: 'Profile', href: '/profile', icon: User },
    ]
  },
  {
    title: 'Management',
    items: [
      { name: 'Rooms', href: '/rooms', icon: DoorOpen },
      { name: 'Room Mapping', href: '/room-mapping', icon: Bed },
      { name: 'Tenants', href: '/tenants', icon: Users },
      { name: 'Fines & Risk', href: '/fines', icon: ShieldAlert },
      { name: 'Colleges', href: '/colleges', icon: Building2 },
    ]
  },
  {
    title: 'Operations',
    items: [
      { name: 'Gate Passes', href: '/gate-passes', icon: ClipboardCheck },
      { name: 'Attendance', href: '/attendance', icon: Activity },
      { name: 'Meals', href: '/meals', icon: Utensils },
      { name: 'Complaints', href: '/complaints', icon: Hammer },
      { name: 'Visitors', href: '/visitors', icon: UserPlus },
      { name: 'Gate Scans', href: '/gate-scans', icon: QrCode },
    ]
  },
  {
    title: 'Community',
    items: [
      { name: 'Notices', href: '/notices', icon: FileText },
      { name: 'Events', href: '/events', icon: Calendar },
      { name: 'Messages', href: '/messages', icon: MessageSquare },
      { name: 'Notifications', href: '/notifications', icon: Bell },
    ]
  },
  {
    title: 'Reports',
    items: [
      { name: 'Metrics', href: '/metrics', icon: BarChart3 },
    ]
  }
]
  /* Removed duplicate categories block */

interface SidebarProps {
  open: boolean
  setOpen: (open: boolean) => void
}

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const role = user?.role ?? null

  const filteredCategories = categories.map(cat => ({
    ...cat,
    items: cat.items.filter(item => canAccessPath(role, item.href))
  })).filter(cat => cat.items.length > 0)

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar - Theme Aware Premium Glass */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 bg-background/80 backdrop-blur-xl border-r border-border/60 shadow-xl shadow-black/10 transform transition-transform duration-500 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] lg:translate-x-0 flex flex-col",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
        <div className="flex items-center justify-between h-20 px-6 border-b border-border/40 shrink-0">
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="p-2.5 bg-gradient-to-br from-primary to-orange-600 rounded-xl shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all duration-300">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground tracking-tight leading-none group-hover:text-primary transition-colors">HostelConnect</span>
              <span className="text-xs font-black text-black tracking-wide">Premium Edition</span>
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-primary transition-colors p-2 hover:bg-muted rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-8 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          {filteredCategories.map((category) => (
            <div key={category.title} className="space-y-3 animate-slide-in-from-bottom" style={{ animationDuration: '0.5s' }}>
              <h3 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-black select-none opacity-80">
                {category.title}
              </h3>
              <div className="space-y-1.5">
                {category.items.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 group relative overflow-hidden",
                        isActive
                          ? "bg-primary/10 text-primary shadow-sm"
                          : "text-black hover:bg-muted/50 hover:text-black hover:shadow-sm"
                      )}
                    >
                      {isActive && (
                         <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-full" />
                      )}
                      
                      <div className={cn(
                        "p-1.5 rounded-lg mr-3 transition-all duration-300",
                        isActive ? "bg-primary/20 text-primary" : "bg-transparent text-black group-hover:bg-background group-hover:text-black group-hover:shadow-sm"
                      )}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      
                      <span className="relative z-10">{item.name}</span>
                      
                      {/* Hover Effect */}
                      {!isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-muted/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Card at bottom - Floating Glass */}
        {user && (
          <div className="p-4 mt-auto border-t border-border/40 bg-gradient-to-t from-background/80 to-transparent backdrop-blur-lg">
            <Link 
              to="/profile" 
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 group"
            >
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-orange-500 p-[2px] shadow-lg shadow-primary/20">
                <div className="h-full w-full rounded-full bg-primary flex items-center justify-center">
                   <span className="text-sm font-black text-black">
                    {user.first_name?.[0]}{user.last_name?.[0]}
                   </span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                  {user.first_name} {user.last_name}
                </p>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  <p className="text-xs font-black text-black uppercase tracking-wide">
                    {user.role?.replace('_', ' ')}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </Link>
          </div>
        )}
      </aside>
    </>
  )
}
