import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
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
  Hammer,
  UserPlus,
  ShieldAlert,
  Download,
  Smartphone,
  CalendarDays
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { canAccessPath } from '@/lib/rbac'
import type { SidebarCategory } from '@/types'
import { usePWAStore } from '@/lib/pwa-store'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'

const categories: SidebarCategory[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
      { name: 'Digital ID', href: '/profile', icon: QrCode },
      { name: 'My Profile', href: '/profile', icon: User },
    ]
  },
  {
    title: 'Hostel Management',
    items: [
      { name: 'Rooms', href: '/rooms', icon: DoorOpen },
      { name: 'Room Mapping', href: '/room-mapping', icon: Bed },
      { name: 'Users & Tenants', href: '/tenants', icon: Users },
      { name: 'Attendance', href: '/attendance', icon: Activity },
      { name: 'Fines & Risk', href: '/fines', icon: ShieldAlert },
      { name: 'Colleges', href: '/colleges', icon: Building2 },
      { name: 'Complaints', href: '/complaints', icon: Hammer },
      { name: 'Leaves', href: '/leaves', icon: CalendarDays },
    ]
  },
  {
    title: 'Kitchen Management',
    items: [
      { name: 'Meals', href: '/meals', icon: Utensils },
    ]
  },
  {
    title: 'Gate Management',
    items: [
      { name: 'Gate Passes', href: '/gate-passes', icon: ClipboardCheck },
      { name: 'Gate Scans', href: '/gate-scans', icon: QrCode },
      { name: 'Visitors', href: '/visitors', icon: UserPlus },
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
  const { isInstallable, install } = usePWAStore()
  const [showInstallDialog, setShowInstallDialog] = useState(false)

  const filteredCategories = categories.map(cat => ({
    ...cat,
    items: cat.items.filter(item => {
      // Always allow install action
      if (item.action === 'install') return true
      
      // Strict role override: Student should only see essential tabs
      const isStudent = role === 'student'
      const isManagementItem = ['/rooms', '/room-mapping', '/tenants', '/colleges', '/metrics'].includes(item.href)
      
      if (isStudent && isManagementItem) return false
      
      return canAccessPath(role, item.href)
    })
  })).filter(cat => cat.items.length > 0)

  const navigate = useNavigate()
  const logout = useAuthStore(state => state.logout)

  const handleLogout = () => {
    logout()
    navigate('/login')
    setOpen(false)
  }

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
            "fixed inset-y-0 left-0 z-50 w-64 bg-background/80 backdrop-blur-xl border-r border-border/60 shadow-lg shadow-primary/10 transform transition-transform duration-500 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] lg:translate-x-0 flex flex-col h-screen",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
        <div className="flex items-center justify-between h-20 px-6 shrink-0">
          <Link to="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3 active:scale-95 transition-transform">
            <div className="relative">
              <img 
                src="/pwa/icon-180.png" 
                alt="Logo" 
                className="h-10 w-10 rounded-xl shadow-lg ring-1 ring-primary/10"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black text-foreground tracking-tighter leading-none">HostelConnect</span>
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-primary/80 mt-1">Smart ERP</span>
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-primary transition-all p-2 bg-muted/50 rounded-xl"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent min-h-0">
          {/* User Card at top */}
          {user && (
            <div className="mb-4 px-1">
              <Link 
                to="/profile" 
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 p-3 rounded-2xl bg-primary/5 border border-primary/10 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 group"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/20 p-[2px] shadow-sm border border-primary/20 flex-shrink-0">
                  <div className="h-full w-full rounded-xl bg-primary flex items-center justify-center">
                     <span className="text-xs font-black text-black">
                      {(user.first_name?.[0] || user.username?.[0])?.toUpperCase()}
                     </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-foreground truncate group-hover:text-primary transition-colors">
                    {user.first_name ? `${user.first_name} ${user.last_name || ''}` : user.username}
                  </p>
                  <p className="text-[9px] font-black text-black/50 uppercase tracking-widest mt-0.5">
                    {user.role?.replace('_', ' ')}
                  </p>
                </div>
              </Link>
            </div>
          )}

          {/* Navigation Categories */}
          <div className="space-y-6 pb-8">
            {filteredCategories.map((category) => (
            <div key={category.title} className="space-y-2">
              <h3 className="px-4 text-[9px] font-black uppercase tracking-[0.2em] text-black/40 select-none">
                {category.title}
              </h3>
              <div className="space-y-1">
                {category.items.map((item) => {
                  const isActive = location.pathname === item.href
                  
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center px-4 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 group relative overflow-hidden",
                        isActive
                          ? "bg-primary text-black shadow-md shadow-primary/20"
                          : "text-slate-600 hover:bg-muted"
                      )}
                    >
                      <item.icon className={cn("h-4 w-4 mr-3 shrink-0", isActive ? "text-black" : "text-slate-400 group-hover:text-slate-600")} />
                      <span className="relative z-10">{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
            ))}
          </div>
        </nav>

        {/* Sticky Footer Area */}
        <div className="p-4 border-t border-border/40 space-y-2 bg-background/80 backdrop-blur-sm shrink-0">
          {isInstallable && (
            <button
               onClick={() => setShowInstallDialog(true)}
               className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all text-left"
            >
               <Download className="h-4 w-4 text-primary" />
               <span className="text-[11px] font-black uppercase tracking-wider text-primary">Install App</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all text-left group"
          >
            <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span className="text-[11px] font-black uppercase tracking-wider">Logout Session</span>
          </button>
        </div>

        {/* PWA Install Dialog */}
        <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
          <DialogContent className="max-w-[calc(100vw-32px)] sm:max-w-md rounded-[2rem] border-primary/20 shadow-2xl overflow-hidden p-0">
             <div className="bg-primary/5 p-6 border-b border-primary/10">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black flex items-center gap-2 tracking-tight">
                    <Smartphone className="h-6 w-6 text-primary" />
                    INSTALL APP
                  </DialogTitle>
                  <DialogDescription className="text-sm font-medium text-slate-500 mt-2">
                    Access HostelConnect directly from your home screen for the fastest experience.
                  </DialogDescription>
                </DialogHeader>
             </div>

            <div className="p-6 space-y-3">
              {[
                { icon: Download, title: 'Instant Launch', desc: 'No browser overhead' },
                { icon: Activity, title: 'Push Alerts', desc: 'Real-time notifications' },
                { icon: ShieldAlert, title: 'Secure Access', desc: 'Biometric support ready' }
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                  <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 mt-0.5">
                    <feature.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-black text-xs text-slate-800 uppercase tracking-wide">{feature.title}</p>
                    <p className="text-[11px] font-medium text-slate-500">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 bg-slate-50/50 flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setShowInstallDialog(false)}
                className="flex-1 rounded-2xl font-black text-[11px] uppercase tracking-widest"
              >
                Later
              </Button>
              <Button
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl"
                onClick={() => {
                  install()
                  setShowInstallDialog(false)
                }}
              >
                Install Now
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </aside>
    </>
  )
}
