import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useState, useMemo, memo, useEffect } from 'react'
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
// useNavigate imported above
import { useAuthStore } from '@/lib/store'

const categories: SidebarCategory[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
      { name: 'Digital ID', href: '/digital-id', icon: QrCode },
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

function Sidebar({ open, setOpen }: SidebarProps) {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const role = user?.role ?? null
  const { isInstallable, install } = usePWAStore()
  const [showInstallDialog, setShowInstallDialog] = useState(false)

  // PASS 1 – Sidebar Scroll Behavior: Lock the main page scroll when sidebar is open.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [open])

  const filteredCategories = useMemo(() => categories.map(cat => ({
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
  })).filter(cat => cat.items.length > 0), [role]);

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
            "fixed inset-y-0 left-0 z-[100] w-[280px] lg:w-72 bg-white dark:bg-slate-950 border-r border-border/40 shadow-2xl transform transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] lg:translate-x-0 flex flex-col h-[100dvh]",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
        <div className="flex items-center justify-between h-24 px-6 shrink-0 bg-slate-50/50 dark:bg-slate-900/50 border-b border-border/30">
          <Link to="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3 active:scale-95 transition-transform group">
            <div className="relative">
              <img 
                src="/pwa/icon-180.png" 
                alt="Logo" 
                className="h-12 w-12 rounded-[1rem] shadow-xl group-hover:rotate-6 transition-transform"
              />
              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-primary rounded-full border-2 border-white dark:border-slate-950 shadow-sm" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-foreground tracking-tighter leading-none">Hostel<span className="text-primary italic">Connect</span></span>
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground mt-1.5 opacity-60">Smart Management</span>
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-primary transition-all p-2.5 bg-background border border-border shadow-sm rounded-2xl active:rotate-90"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto scrollbar-none overscroll-contain [-webkit-overflow-scrolling:touch]">
          {/* User Card at top */}
          {user && (
            <div className="px-2">
              <Link 
                to="/profile" 
                onClick={() => setOpen(false)}
                className="flex items-center gap-4 p-4 rounded-[1.5rem] bg-slate-50 dark:bg-slate-900 border border-border hover:border-primary/40 hover:shadow-lg transition-all duration-300 group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                   <User className="h-8 w-8 text-primary" />
                </div>
                <div className="h-12 w-12 rounded-2xl bg-primary/20 p-[2px] shadow-inner flex-shrink-0">
                  <div className="h-full w-full rounded-2xl bg-primary flex items-center justify-center">
                     <span className="text-sm font-black text-black">
                      {(user.first_name?.[0] || user.username?.[0])?.toUpperCase()}
                     </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-foreground truncate group-hover:text-primary transition-colors">
                    {user.first_name ? `${user.first_name} ${user.last_name || ''}` : user.username}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {user.role?.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* Navigation Categories */}
          <div className="space-y-10 pb-12">
            {filteredCategories.map((category) => (
            <div key={category.title} className="space-y-4">
              <h3 className="px-5 text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/60 select-none">
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
                        "flex items-center px-5 py-3 text-[13px] font-bold rounded-2xl transition-all duration-300 group relative overflow-hidden",
                        isActive
                          ? "bg-primary text-black shadow-[0_8px_20px_-6px_rgba(var(--primary),0.5)]"
                          : "text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-900"
                      )}
                    >
                      <item.icon className={cn("h-5 w-5 mr-3.5 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-black" : "text-slate-400 group-hover:text-slate-900")} />
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
        <div className="p-6 border-t border-border/40 space-y-3 bg-white dark:bg-slate-950 shrink-0 pb-safe pb-8 sm:pb-6">
          {isInstallable && (
            <button
               onClick={() => setShowInstallDialog(true)}
               className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all text-left group"
            >
               <Download className="h-5 w-5 text-primary group-hover:animate-bounce" />
               <span className="text-xs font-black uppercase tracking-widest text-primary">Install Connect</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-rose-500 hover:bg-rose-500/10 transition-all text-left group active:scale-[0.98]"
          >
            <LogOut className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
            <span className="text-xs font-black uppercase tracking-widest">Logout System</span>
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

const MemoizedSidebar = memo(Sidebar);
export default MemoizedSidebar;
