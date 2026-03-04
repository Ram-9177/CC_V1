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
  ChevronRight,
  Hammer,
  UserPlus,
  ShieldAlert,
  Download,
  Smartphone,
  CalendarDays
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store'
import { canAccessPath } from '@/lib/rbac'
import type { SidebarCategory } from '@/types'
import { usePWAStore } from '@/lib/pwa-store'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
            "fixed inset-y-0 left-0 z-50 w-64 bg-background/80 backdrop-blur-xl border-r border-border/60 shadow-lg shadow-primary/10 transform transition-transform duration-500 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] lg:translate-x-0 flex flex-col",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
        <div className="flex items-center justify-between h-24 px-6 shrink-0">
          <Link to="/dashboard" className="flex items-center gap-3 active:scale-95 transition-transform">
            <div className="relative">
              <img 
                src="/pwa/icon-180.png" 
                alt="Logo" 
                className="h-14 w-14 rounded-2xl shadow-xl shadow-primary/20 ring-1 ring-primary/10"
              />
              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-success rounded-full border-2 border-background ring-1 ring-black/5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-foreground tracking-tighter leading-none">HostelConnect</span>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80 mt-1">Smart ERP</span>
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-primary transition-all p-2 bg-muted/50 rounded-xl"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          {/* User Card at top - Refined Placement */}
          {user && (
            <div className="mb-6 px-1">
              <Link 
                to="/profile" 
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/10 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 group"
              >
                <div className="h-12 w-12 rounded-2xl bg-primary/20 p-[2px] shadow-sm border border-primary/20 flex-shrink-0">
                  <div className="h-full w-full rounded-2xl bg-primary flex items-center justify-center">
                     <span className="text-base font-black text-black">
                      {user.first_name?.[0]}{user.last_name?.[0]}
                     </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-foreground truncate group-hover:text-primary transition-colors">
                    {user.first_name} {user.last_name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-[10px] font-black text-black/60 uppercase tracking-widest">
                      {user.role?.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </Link>
            </div>
          )}

          {/* Mobile Install Prompt Badge - Sticky at top */}
          {isInstallable && (
            <div className="lg:hidden sticky top-0 z-20 -mx-4 px-4 pt-2 pb-4 bg-gradient-to-b from-background via-background to-transparent">
              <button
                onClick={() => setShowInstallDialog(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-all duration-300 group relative overflow-visible shadow-sm"
              >
                {/* Animated background pulse */}
                <div className="absolute inset-0 bg-primary/30 opacity-0 group-hover:opacity-100 animate-pulse rounded-lg transition-opacity duration-300" />
                
                {/* Icon with bounce animation */}
                <div className="relative flex-shrink-0 p-1.5 bg-primary/30 group-hover:bg-primary/40 rounded-lg transition-all duration-300 animate-install-bounce">
                  <Download className="h-4 w-4 text-primary relative z-10" />
                </div>
                
                {/* Text */}
                <div className="flex-1 text-left min-w-0">
                  <p className="text-xs font-bold text-black leading-tight">Install App</p>
                  <p className="text-[10px] text-black/50 truncate">Tap to add home</p>
                </div>
                
                {/* Animated pulse dot */}
                <div className="flex-shrink-0 h-2 w-2 bg-primary rounded-full animate-pulse" />
              </button>
            </div>
          )}

          {/* Navigation Categories */}
          <div className="space-y-8">
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
                        "flex items-center px-4 py-3 text-sm font-bold rounded-xl transition-all duration-300 group relative overflow-hidden text-black",
                        isActive
                          ? "border-primary bg-primary/10 shadow-lg shadow-primary/10 scale-[1.02]"
                          : "hover:bg-muted/50 hover:text-black hover:shadow-sm"
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
                      
                      <span className="relative z-10 text-black">{item.name}</span>
                      
                      {/* Hover Effect */}
                      {!isActive && (
                        <div className="absolute inset-0 bg-muted/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
            ))}
          </div>
        </nav>

        {/* Install App Banner - Disabled */}

        {/* Install App Section - Elegant & Refined */}
        {isInstallable && (
          <>
            <div className="px-4 py-3 border-t border-border/40">
              <button
                onClick={() => setShowInstallDialog(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-all duration-300 group"
              >
                <div className="p-2 bg-primary/20 group-hover:bg-primary/30 rounded-lg transition-all">
                  <Download className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-black">Install App</p>
                  <p className="text-xs text-black/60">Add to home screen</p>
                </div>
                <ChevronRight className="h-4 w-4 text-primary/50 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </button>
            </div>

            {/* Install App Dialog - Elevated Popup */}
            <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
              <DialogContent className="max-w-md rounded-2xl border-primary/20 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                    <Smartphone className="h-6 w-6 text-primary" />
                    Install HostelConnect
                  </DialogTitle>
                  <DialogDescription className="text-base mt-2">
                    Add the app to your home screen for quick access and offline functionality. Works on all devices!
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <Download className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">Fast Installation</p>
                      <p className="text-xs text-muted-foreground">Takes just 10 seconds</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <Activity className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">Offline Access</p>
                      <p className="text-xs text-muted-foreground">Use the app without internet</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <Smartphone className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">Native Experience</p>
                      <p className="text-xs text-muted-foreground">Full-screen app with instant launch</p>
                    </div>
                  </div>
                </div>

                <DialogFooter className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowInstallDialog(false)}
                    className="flex-1"
                  >
                    Maybe Later
                  </Button>
                  <Button
                    className="flex-1 bg-primary hover:bg-primary/90"
                    onClick={() => {
                      install()
                      setShowInstallDialog(false)
                      setOpen(false)
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Install Now
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

      </aside>
    </>
  )
}
