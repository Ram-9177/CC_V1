import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useState, useMemo, memo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { 
  Home, 
  DoorOpen, 
  Bed,
  ClipboardCheck, 
  Utensils, 
  FileText, 
  BarChart3, 
  User, 
  Calendar,
  Bell,
  QrCode,
  Users,
  Activity,
  X,
  Hammer,
  UserPlus,
  Download,
  Smartphone,
  CheckCircle2,
  Trophy
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { canAccessPath } from '@/lib/rbac'
import { useMyPermissions } from '@/hooks/useMyPermissions'
import type { SidebarCategory } from '@/types'
import { usePWAStore } from '@/lib/pwa-store'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { useUIStore } from '@/lib/ui-store'
import { useRoleStats } from '@/hooks/useRoleStats'

const roleWorkflows: Record<string, { title: string; items: { name: string; href: string; icon: React.ElementType }[] }[]> = {
  warden: [
    {
      title: 'Warden Desk',
      items: [
        { name: 'Control Center', href: '/dashboard', icon: Home },
        { name: 'Complaints', href: '/complaints', icon: Hammer },
        { name: 'Room Inventory', href: '/rooms', icon: DoorOpen },
        { name: 'Room Mapping', href: '/room-mapping', icon: Bed },
      ]
    },
    {
      title: 'Operations',
      items: [
        { name: 'Gatepass Approvals', href: '/gate-passes', icon: ClipboardCheck },
        { name: 'Attendance Registry', href: '/attendance', icon: Activity },
        { name: 'Tenants & Users', href: '/tenants', icon: Users },
      ]
    },
    {
      title: 'Insights',
      items: [
        { name: 'Metric Analysis', href: '/metrics', icon: BarChart3 },
        { name: 'Hostel Reports', href: '/reports', icon: FileText },
      ]
    }
  ],
  head_warden: [
    {
      title: 'Admin Control',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: Home },
        { name: 'All Complaints', href: '/complaints', icon: Hammer },
        { name: 'Gatepass Oversight', href: '/gate-passes', icon: ClipboardCheck },
      ]
    },
    {
      title: 'Management',
      items: [
        { name: 'Room Control', href: '/rooms', icon: DoorOpen },
        { name: 'Tenant Control', href: '/tenants', icon: Users },
        { name: 'Attendance', href: '/attendance', icon: Activity },
      ]
    },
    {
      title: 'Analytics',
      items: [
        { name: 'System Metrics', href: '/metrics', icon: BarChart3 },
        { name: 'Global Reports', href: '/reports', icon: FileText },
      ]
    }
  ],
  chef: [
    {
      title: 'Dining Central',
      items: [
        { name: 'Meal Forecast', href: '/dashboard', icon: Home },
        { name: 'Meal Registry', href: '/meals', icon: Utensils },
        { name: 'Attendance', href: '/attendance', icon: Activity },
      ]
    },
    {
      title: 'Feedback',
      items: [
        { name: 'Food Complaints', href: '/complaints', icon: Hammer },
      ]
    }
  ],
  head_chef: [
    {
      title: 'Kitchen Admin',
      items: [
        { name: 'Meal Control', href: '/dashboard', icon: Home },
        { name: 'Meal Registry', href: '/meals', icon: Utensils },
        { name: 'Service Registry', href: '/attendance', icon: Activity },
        { name: 'System Complaints', href: '/complaints', icon: Hammer },
      ]
    }
  ],
  gate_security: [
    {
      title: 'Security Desk',
      items: [
        { name: 'Live Scans', href: '/dashboard', icon: QrCode },
        { name: 'Gatepass Registry', href: '/gate-passes', icon: ClipboardCheck },
        { name: 'Terminal Check', href: '/gate-scans', icon: QrCode },
        { name: 'Visitor Log', href: '/visitors', icon: UserPlus },
      ]
    }
  ],
  security_head: [
    {
      title: 'Security Hub',
      items: [
        { name: 'All Scans', href: '/dashboard', icon: QrCode },
        { name: 'Pass Registry', href: '/gate-passes', icon: ClipboardCheck },
        { name: 'Personnel Check', href: '/gate-scans', icon: QrCode },
        { name: 'System Reports', href: '/reports', icon: FileText },
      ]
    }
  ],
  hr: [
    {
      title: 'HR Management',
      items: [
        { name: 'Ops Dashboard', href: '/dashboard', icon: Home },
        { name: 'User Management', href: '/tenants', icon: Users },
        { name: 'Room Inventory', href: '/rooms', icon: DoorOpen },
        { name: 'HR Reports', href: '/reports', icon: FileText },
      ]
    }
  ],
  pd: [
    {
      title: 'Sports Central',
      items: [
        { name: 'Sports Dashboard', href: '/sports-dashboard', icon: Trophy },
        { name: 'Events Desk', href: '/events', icon: Calendar },
        { name: 'Booking Control', href: '/sports-booking', icon: Trophy },
      ]
    }
  ],
  principal: [
    {
      title: 'Board Ops',
      items: [
        { name: 'Campus Pulse', href: '/metrics', icon: BarChart3 },
        { name: 'Notice Control', href: '/notices', icon: FileText },
        { name: 'Public Events', href: '/events', icon: Calendar },
      ]
    }
  ],
  student: [
    {
      title: 'Student Portal',
      items: [
        { name: 'My Dashboard', href: '/dashboard', icon: Home },
        { name: 'Digital ID', href: '/digital-id', icon: QrCode },
        { name: 'Exit Passes', href: '/gate-passes', icon: ClipboardCheck },
      ]
    },
    {
      title: 'Hostel Life',
      items: [
        { name: 'My Room', href: '/rooms', icon: DoorOpen },
        { name: 'Dining Hall', href: '/meals', icon: Utensils },
        { name: 'Leave Applications', href: '/leaves', icon: Calendar },
        { name: 'Visitor Passes', href: '/visitors', icon: UserPlus },
      ]
    },
    {
      title: 'Campus Life',
      items: [
        { name: 'Notice Board', href: '/notices', icon: FileText },
        { name: 'Events', href: '/events', icon: Calendar },
        { name: 'Sports Booking', href: '/sports-booking', icon: Trophy },
      ]
    },
    {
      title: 'Support',
      items: [
        { name: 'Raise Complaint', href: '/complaints', icon: Hammer },
      ]
    }
  ]
}

const defaultCategories: SidebarCategory[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
      { name: 'My Profile', href: '/profile', icon: User },
    ]
  },
  {
    title: 'Hostel Management',
    items: [
      { name: 'Rooms', href: '/rooms', icon: DoorOpen },
      { name: 'Room Mapping', href: '/room-mapping', icon: Bed },
      { name: 'Tenants', href: '/tenants', icon: Users },
      { name: 'Attendance', href: '/attendance', icon: Activity },
      { name: 'Complaints', href: '/complaints', icon: Hammer },
    ]
  },
  {
    title: 'Gate & Security',
    items: [
      { name: 'Gatepass', href: '/gate-passes', icon: ClipboardCheck },
      { name: 'Gate Scans', href: '/gate-scans', icon: QrCode },
      { name: 'Visitors', href: '/visitors', icon: UserPlus },
    ]
  },
  {
    title: 'Resources',
    items: [
      { name: 'Meals', href: '/meals', icon: Utensils },
      { name: 'Notices', href: '/notices', icon: FileText },
      { name: 'Events', href: '/events', icon: Calendar },
      { name: 'Sports', href: '/sports-dashboard', icon: Trophy },
    ]
  }
]

interface SidebarProps {
  open: boolean
  setOpen: (open: boolean) => void
}

function Sidebar({ open, setOpen }: SidebarProps) {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const role = user?.role ?? null
  const { isInstallable, isStandalone, install } = usePWAStore()
  const [showInstallDialog, setShowInstallDialog] = useState(false)

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

  const { data: permissions } = useMyPermissions()
  const { data: routeStats } = useRoleStats()

  const filteredCategories = useMemo(() => {
    const rawCategories = (role && roleWorkflows[role]) || defaultCategories;

    return rawCategories.map(cat => ({
      ...cat,
      items: cat.items.filter(item => {
        const isStudent = role === 'student'
        const isManagementItem = ['/rooms', '/room-mapping', '/tenants', '/colleges', '/metrics'].includes(item.href)
        if (isStudent && isManagementItem) return false
        if (isStudent && item.href === '/sports-booking') return true

        if (permissions?.allowed_paths) {
          return permissions.allowed_paths.some(
            ap => item.href === ap || (item.href !== '/' && item.href.startsWith(`${ap}/`))
          )
        }

        return canAccessPath(role, item.href, user?.student_type)
      }).map(item => {
          let count = 0;
          if (item.href === '/gate-passes') count = routeStats?.pending_gate_passes || 0;
          if (item.href === '/complaints') count = routeStats?.pending_complaints || 0;
          if (item.href === '/leaves') count = routeStats?.pending_leaves || 0;
          if (item.href === '/meals' && (role === 'warden' || role === 'head_warden')) count = routeStats?.pending_meal_requests || 0;
          if (item.href === '/messages') count = routeStats?.unread_messages || 0;

          return { ...item, count };
      })
    })).filter(cat => cat.items.length > 0)
  }, [role, user?.student_type, permissions, routeStats]);

  const navigate = useNavigate()
  const logout = useAuthStore(state => state.logout)

  const handleLogout = () => {
    logout()
    navigate('/login')
    setOpen(false)
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[100] w-[280px] lg:w-72 bg-white dark:bg-slate-950 border-r border-border/40 shadow-2xl transform transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:translate-x-0 flex flex-col h-[100dvh]",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-24 px-6 shrink-0 bg-slate-50/50 dark:bg-slate-900/50 border-b border-border/30">
          <Link to="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3 active:scale-95 transition-transform group">
            <div className="relative">
              <img 
                src="/pwa/icon-180.png" 
                alt="Logo" 
                loading="lazy"
                className="h-12 w-12 rounded shadow-xl group-hover:rotate-6 transition-transform"
              />
              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-primary rounded-sm border-2 border-white dark:border-slate-950 shadow-sm" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-foreground tracking-tighter leading-none">
                <span className="text-primary italic">C</span>ampus<span className="text-primary italic">C</span>ore
              </span>
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground mt-1.5 opacity-60">Smart Management</span>
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-primary transition-all p-2.5 bg-background border border-border shadow-sm rounded-sm active:rotate-90"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto stylish-scrollbar overscroll-contain">
          {user && (
            <div className="px-2">
              <Link 
                to="/profile" 
                onClick={() => setOpen(false)}
                className="flex items-center gap-4 p-4 rounded bg-slate-50 dark:bg-slate-900 border border-border hover:border-primary/40 hover:shadow-lg transition-all duration-200 group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                   <User className="h-8 w-8 text-primary" />
                </div>
                <div className="h-12 w-12 rounded-sm bg-primary/20 p-[2px] shadow-inner flex-shrink-0">
                  <div className="h-full w-full rounded-sm bg-primary flex items-center justify-center">
                     <span className="text-sm font-black text-black">
                      {(user.first_name?.[0] || user.username?.[0])?.toUpperCase()}
                     </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-foreground truncate group-hover:text-primary transition-colors">
                    {user.first_name ? `${user.first_name} ${user.last_name || ''}` : user.username}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <div className="h-1.5 w-1.5 rounded-sm bg-green-500 animate-pulse" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {user.role?.replace('_', ' ')}
                    </p>
                    {user.role === 'student' && user.student_type && (
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm",
                        user.student_type === 'hosteller'
                          ? "bg-primary/20 text-primary"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                      )}>
                        {user.student_type === 'hosteller' ? 'Hosteller' : 'Day Scholar'}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          )}

          <div className="space-y-10 pb-24">
            {filteredCategories.map((category) => (
              <div key={category.title} className="space-y-4">
                <h3 className="px-5 text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/60 select-none">
                  {category.title}
                </h3>
                <div className="space-y-1.5">
                  {category.items.map((item) => {
                    const isActive = location.pathname === item.href
                    return (
                      <button
                        key={item.href}
                        onClick={(e) => {
                          if (item.href === '/digital-id') {
                            e.preventDefault();
                            useUIStore.getState().openDigitalID();
                            setOpen(false);
                          } else {
                            setOpen(false);
                            navigate(item.href);
                          }
                        }}
                        className={cn(
                          "w-full flex items-center px-5 py-3 text-[13px] font-bold rounded-sm transition-all duration-200 group relative overflow-hidden",
                          isActive
                            ? "bg-primary text-black shadow-lg"
                            : "text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-900"
                        )}
                      >
                        <item.icon className={cn("h-5 w-5 mr-3.5 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-black" : "text-slate-400 group-hover:text-slate-900")} />
                        <span className="relative z-10 flex-1 text-left">{item.name}</span>
                        {item.count > 0 && (
                          <div className={cn(
                            "px-1.5 py-0.5 rounded-sm text-[9px] font-black min-w-[18px] text-center shadow-sm animate-in zoom-in duration-300",
                            isActive ? "bg-black text-primary" : "bg-primary text-black"
                          )}>
                            {item.count}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="px-5 py-4 border-t border-border/10">
              <div className="flex items-center justify-between p-3 rounded-sm bg-slate-50 dark:bg-slate-900/50 border border-border/30">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-sm bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">System Operational</span>
                </div>
                <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter border-green-500/20 text-green-600 dark:text-green-400 bg-green-500/5">v1.2.4-PROD</Badge>
              </div>
            </div>
          </div>
        </nav>

        <div className="p-6 border-t border-border/40 space-y-3 bg-white dark:bg-slate-950 shrink-0 pb-8">
          {isInstallable && !isStandalone && (
            <button
               onClick={() => setShowInstallDialog(prev => !prev)}
               className={cn(
                 "w-full flex items-center gap-3 px-4 py-3 rounded-sm border transition-all text-left group",
                 showInstallDialog ? "bg-primary/20 border-primary/40" : "bg-primary/10 border-primary/20 hover:bg-primary/20"
               )}
            >
               <Download className={cn("h-5 w-5 text-primary group-hover:animate-bounce")} />
              <span className="text-xs font-black uppercase tracking-widest text-primary">Install CampusCore</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-sm text-rose-500 hover:bg-rose-500/10 transition-all text-left group active:scale-[0.98]"
          >
            <LogOut className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
            <span className="text-xs font-black uppercase tracking-widest">Logout System</span>
          </button>
        </div>
      </aside>

      {createPortal(
        <>
          <div
            className={cn(
              "fixed inset-0 z-[9998] transition-opacity duration-300",
              showInstallDialog ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            )}
            onClick={() => setShowInstallDialog(false)}
          />

          <div
            className={cn(
              "fixed left-0 z-[9999] w-[280px] lg:w-72 px-3 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
              showInstallDialog ? "bottom-[160px] opacity-100 translate-y-0" : "bottom-[152px] opacity-0 translate-y-3 pointer-events-none"
            )}
          >
            <div className="rounded overflow-hidden shadow-2xl border border-primary/20 bg-white dark:bg-slate-950">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-primary/10 rounded-sm">
                    <Smartphone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-foreground tracking-tight">Install App</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Add to Home Screen</p>
                  </div>
                </div>
                <button onClick={() => setShowInstallDialog(false)} className="p-1.5 rounded-sm hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-5 py-2 space-y-2">
                {[
                  { icon: CheckCircle2, title: 'Instant Access', desc: 'Launch directly' },
                  { icon: Bell, title: 'Alerts', desc: 'Real-time notifications' },
                ].map((feature) => (
                  <div key={feature.title} className="flex items-center gap-3 py-1.5">
                    <feature.icon className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-foreground">{feature.title}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">{feature.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 px-5 pt-3 pb-5">
                <Button variant="ghost" size="sm" onClick={() => setShowInstallDialog(false)} className="flex-1 rounded-sm font-black text-[10px] uppercase tracking-widest">Later</Button>
                <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90 text-black rounded-sm font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/30" onClick={() => { install(); setShowInstallDialog(false); }}>Install Now</Button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}

const MemoizedSidebar = memo(Sidebar);
export default MemoizedSidebar;
