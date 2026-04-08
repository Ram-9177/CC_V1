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
  Trophy,
  AlertTriangle,
  MessageSquare,
  Building,
  FileStack,
  GitPullRequest
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
        { name: 'Room Inventory', href: '/rooms', icon: DoorOpen },
        { name: 'Room Requests', href: '/room-requests', icon: GitPullRequest },
        { name: 'Room Mapping', href: '/room-mapping', icon: Bed },
        { name: 'Tenants & Users', href: '/tenants', icon: Users },
      ]
    },
    {
      title: 'Daily Operations',
      items: [
        { name: 'Gatepass Approvals', href: '/gate-passes', icon: ClipboardCheck },
        { name: 'Attendance Registry', href: '/attendance', icon: Activity },
        { name: 'Leave Requests', href: '/leaves', icon: Calendar },
        { name: 'Visitor Log', href: '/visitors', icon: UserPlus },
      ]
    },
    {
      title: 'Welfare & Discipline',
      items: [
        { name: 'Complaints', href: '/complaints', icon: Hammer },
        { name: 'Disciplinary Action', href: '/fines', icon: AlertTriangle },
        { name: 'Support Messages', href: '/messages', icon: MessageSquare },
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
      title: 'Head Warden HQ',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: Home },
        { name: 'Room Control', href: '/rooms', icon: DoorOpen },
        { name: 'Room Requests', href: '/room-requests', icon: GitPullRequest },
        { name: 'Tenant Control', href: '/tenants', icon: Users },
      ]
    },
    {
      title: 'Operations',
      items: [
        { name: 'Gatepass Oversight', href: '/gate-passes', icon: ClipboardCheck },
        { name: 'Attendance', href: '/attendance', icon: Activity },
        { name: 'Leave Approvals', href: '/leaves', icon: Calendar },
        { name: 'Visitor Management', href: '/visitors', icon: UserPlus },
      ]
    },
    {
      title: 'Welfare & Discipline',
      items: [
        { name: 'All Complaints', href: '/complaints', icon: Hammer },
        { name: 'Disciplinary Log', href: '/fines', icon: AlertTriangle },
        { name: 'Audit Logs', href: '/audit-logs', icon: FileStack },
        { name: 'Support Messages', href: '/messages', icon: MessageSquare },
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
        { name: 'Notices', href: '/notices', icon: FileText },
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
      ]
    },
    {
      title: 'Oversight',
      items: [
        { name: 'System Complaints', href: '/complaints', icon: Hammer },
        { name: 'Notices', href: '/notices', icon: FileText },
        { name: 'Reports', href: '/reports', icon: FileText },
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
        { name: 'Visitor Log', href: '/visitors', icon: UserPlus },
      ]
    },
    {
      title: 'Intelligence',
      items: [
        { name: 'Metrics', href: '/metrics', icon: BarChart3 },
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
        { name: 'Room Requests', href: '/room-requests', icon: GitPullRequest },
        { name: 'Placements', href: '/placements', icon: Trophy },
      ]
    },
    {
      title: 'Administration',
      items: [
        { name: 'Attendance', href: '/attendance', icon: Activity },
        { name: 'Notices', href: '/notices', icon: FileText },
        { name: 'HR Reports', href: '/reports', icon: FileText },
        { name: 'Messages', href: '/messages', icon: MessageSquare },
      ]
    }
  ],
  pd: [
    {
      title: 'Sports & Events',
      items: [
        { name: 'Sports Dashboard', href: '/sports-dashboard', icon: Trophy },
        { name: 'Events Desk', href: '/events', icon: Calendar },
        { name: 'Booking Control', href: '/sports-booking', icon: Trophy },
        { name: 'Hall Bookings', href: '/hall-booking', icon: Building },
      ]
    },
    {
      title: 'Career & Campus',
      items: [
        { name: 'Placements', href: '/placements', icon: FileStack },
        { name: 'Notices Control', href: '/notices', icon: FileText },
        { name: 'Disciplinary Log', href: '/fines', icon: AlertTriangle },
      ]
    }
  ],
  principal: [
    {
      title: 'Institutional View',
      items: [
        { name: 'Campus Pulse', href: '/metrics', icon: BarChart3 },
        { name: 'Analytics', href: '/analytics', icon: Activity },
        { name: 'Placement Reports', href: '/placements', icon: Trophy },
      ]
    },
    {
      title: 'Administration',
      items: [
        { name: 'Notice Control', href: '/notices', icon: FileText },
        { name: 'Hall Bookings', href: '/hall-booking', icon: Building },
        { name: 'Campus Events', href: '/events', icon: Calendar },
        { name: 'Disciplinary History', href: '/fines', icon: AlertTriangle },
        { name: 'Global Reports', href: '/reports', icon: FileText },
      ]
    }
  ],
  admin: [
    {
      title: 'System Control',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: Home },
        { name: 'Colleges', href: '/colleges', icon: Building },
        { name: 'All Users', href: '/tenants', icon: Users },
      ]
    },
    {
      title: 'Hostel Ops',
      items: [
        { name: 'Rooms', href: '/rooms', icon: DoorOpen },
        { name: 'Gate Passes', href: '/gate-passes', icon: ClipboardCheck },
        { name: 'Attendance', href: '/attendance', icon: Activity },
        { name: 'Meals', href: '/meals', icon: Utensils },
        { name: 'Visitors', href: '/visitors', icon: UserPlus },
        { name: 'Leaves', href: '/leaves', icon: Calendar },
        { name: 'Room Requests', href: '/room-requests', icon: GitPullRequest },
      ]
    },
    {
      title: 'Welfare',
      items: [
        { name: 'Complaints', href: '/complaints', icon: Hammer },
        { name: 'Disciplinary', href: '/fines', icon: AlertTriangle },
        { name: 'Messages', href: '/messages', icon: MessageSquare },
        { name: 'Notices', href: '/notices', icon: FileText },
      ]
    },
    {
      title: 'Intelligence',
      items: [
        { name: 'Analytics', href: '/analytics', icon: Activity },
        { name: 'Metrics', href: '/metrics', icon: BarChart3 },
        { name: 'Reports', href: '/reports', icon: FileText },
        { name: 'Placements', href: '/placements', icon: Trophy },
      ]
    }
  ],
  super_admin: [
    {
      title: 'Platform',
      items: [
        { name: 'Tenants & Colleges', href: '/colleges', icon: Building },
        { name: 'All Users', href: '/tenants', icon: Users },
        { name: 'Dashboard', href: '/dashboard', icon: Home },
      ]
    },
    {
      title: 'Full Access',
      items: [
        { name: 'Analytics', href: '/analytics', icon: Activity },
        { name: 'Metrics', href: '/metrics', icon: BarChart3 },
        { name: 'Gate Passes', href: '/gate-passes', icon: ClipboardCheck },
        { name: 'Complaints', href: '/complaints', icon: Hammer },
        { name: 'Rooms', href: '/rooms', icon: DoorOpen },
        { name: 'Placements', href: '/placements', icon: Trophy },
        { name: 'Reports', href: '/reports', icon: FileText },
        { name: 'Audit Logs', href: '/audit-logs', icon: FileStack },
        { name: 'Room Requests', href: '/room-requests', icon: GitPullRequest },
      ]
    }
  ],
  student: [
    {
      title: 'Core',
      items: [
        { name: 'My Dashboard', href: '/dashboard', icon: Home },
        { name: 'Exit Passes', href: '/gate-passes', icon: ClipboardCheck },
        { name: 'Dining Hall', href: '/meals', icon: Utensils },
        { name: 'Leave Application', href: '/leaves', icon: Calendar },
        { name: 'My Profile', href: '/profile', icon: User },
        { name: 'Digital ID', href: '/digital-id', icon: QrCode },
      ]
    },
    {
      title: 'Campus',
      items: [
        { name: 'Events', href: '/events', icon: Calendar },
        { name: 'Sports Booking', href: '/sports-booking', icon: Trophy },
        { name: 'Notice Board', href: '/notices', icon: FileText },
        { name: 'Hall Booking', href: '/hall-booking', icon: Building },
        { name: 'Placements', href: '/placements', icon: Trophy },
        { name: 'Resume Builder', href: '/resume', icon: FileStack },
      ]
    },
    {
      title: 'Support',
      items: [
        { name: 'Raise Complaint', href: '/complaints', icon: Hammer },
        { name: 'Help Desk', href: '/messages', icon: MessageSquare },
        { name: 'My Room', href: '/rooms', icon: DoorOpen },
        { name: 'Room Change', href: '/room-requests', icon: GitPullRequest },
        { name: 'Visitor Passes', href: '/visitors', icon: UserPlus },
        { name: 'My Fines', href: '/fines', icon: AlertTriangle },
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
    const rawCategories = (role && roleWorkflows[role]) || defaultCategories
    const categories = rawCategories.map((category) => ({
      ...category,
      items: [...category.items],
    }))

    if (role === 'student' && user?.is_student_hr) {
      const hostelLife = categories.find((category) => category.title === 'Hostel Life')
      if (hostelLife && !hostelLife.items.some((item) => item.href === '/room-mapping')) {
        hostelLife.items.push({ name: 'Room Mapping', href: '/room-mapping', icon: Bed })
      }
    }

    return categories.map(cat => ({
      ...cat,
      items: cat.items.filter(item => {
        const isStudent = role === 'student'
        const isManagementItem = ['/rooms', '/room-mapping', '/tenants', '/colleges', '/metrics'].includes(item.href)
        const canUseStudentHrTools = isStudent && !!user?.is_student_hr
        if (isStudent && isManagementItem && !(canUseStudentHrTools && item.href === '/room-mapping')) return false
        if (isStudent && item.href === '/sports-booking') return true

        if (permissions?.allowed_paths) {
          return permissions.allowed_paths.some(
            ap => item.href === ap || (item.href !== '/' && item.href.startsWith(`${ap}/`))
          )
        }

        return canAccessPath(role, item.href, user?.student_type, user?.is_student_hr)
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
  }, [role, user?.is_student_hr, user?.student_type, permissions, routeStats]);

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
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[100] w-[280px] lg:w-72 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-r border-border shadow-2xl transform transition-all duration-300 ease-out lg:translate-x-0 flex flex-col h-[100dvh]",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-24 px-6 shrink-0 bg-card/95 border-b border-border">
          <Link to="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3 active:scale-95 transition-transform group">
            <div className="flex flex-col">
              <span className="text-xl font-black text-foreground tracking-tighter leading-none uppercase">
                Campus<span className="text-primary italic font-black">C</span>ore
              </span>
              <span className="text-[9px] font-black uppercase tracking-[0.35em] text-muted-foreground mt-1.5 truncate">Smart Management</span>
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden text-muted-foreground hover:bg-muted lg:hover:text-primary transition-all p-2.5 bg-muted/55 border border-border shadow-sm rounded-sm active:rotate-90"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto stylish-scrollbar overscroll-contain">
          {/* User Card at top */}
          {user && (
            <div className="px-2">
              <Link 
                to="/profile" 
                onClick={() => setOpen(false)}
                className="flex items-center gap-4 p-4 rounded-sm bg-card border border-border hover:border-primary/35 hover:shadow-md transition-all duration-300 group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity text-foreground">
                   <User className="h-8 w-8" />
                </div>
                <div className="h-12 w-12 rounded-sm bg-accent/35 p-[2px] shadow-inner flex-shrink-0">
                  <div className="h-full w-full rounded-sm bg-accent/70 flex items-center justify-center">
                     <span className="text-sm font-black text-foreground">
                      {(user.first_name?.[0] || user.username?.[0])?.toUpperCase()}
                     </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-foreground truncate uppercase tracking-tighter">
                    {user.first_name || user.username}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">
                      {user.role?.replace('_', ' ') || 'User'}
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          )}

          <div className="space-y-10 pb-24">
            {filteredCategories.map((category) => (
              <div key={category.title} className="space-y-3">
                <h3 className="px-6 text-[11px] font-black uppercase tracking-widest text-stone-400 select-none">
                  {category.title}
                </h3>
                <div className="space-y-1.5 px-3">
                  {category.items.map((item) => {
                    const isActive = location.pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        to={item.href === '/digital-id' ? '#' : item.href}
                        onClick={(e) => {
                          if (item.href === '/digital-id') {
                            e.preventDefault();
                            useUIStore.getState().setDigitalIDOpen(true);
                          }
                          setOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 group relative",
                          isActive
                            ? "bg-stone-900 text-white shadow-md"
                            : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                        )}
                      >
                        <item.icon className={cn(
                          "h-5 w-5 mr-3 shrink-0 transition-transform group-hover:scale-110", 
                          isActive ? "text-white" : "text-stone-400 group-hover:text-stone-900"
                        )} />
                        <span className="relative z-10 flex-1 text-left min-w-0 truncate">{item.name}</span>
                        {item.count > 0 && (
                          <div className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-bold min-w-[20px] text-center shadow-sm animate-in zoom-in duration-300",
                            isActive ? "bg-white text-stone-900" : "bg-stone-200 text-stone-700"
                          )}>
                            {item.count}
                          </div>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="px-5 pt-4">
              <div className="flex items-center justify-between p-3 rounded-sm bg-card border border-border shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Online</span>
                </div>
                <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter border-accent/40 text-foreground bg-accent/25">PROD</Badge>
              </div>
            </div>
          </div>
        </nav>

        <div className="p-6 border-t border-border space-y-3 bg-card shrink-0 pb-[calc(1.5rem+env(safe-area-inset-bottom,20px))]">
          {isInstallable && !isStandalone && (
            <button
               onClick={() => setShowInstallDialog(prev => !prev)}
               className={cn(
                 "w-full flex items-center gap-3 px-4 py-3 rounded-sm border transition-all text-left group",
                 showInstallDialog ? "bg-accent/35 border-accent/55" : "bg-muted/50 border-primary/20 hover:bg-accent/25"
               )}
            >
               <Download className={cn("h-5 w-5 text-primary group-hover:animate-bounce")} />
              <span className="text-xs font-black uppercase tracking-widest text-primary truncate">Install CampusCore</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-sm text-rose-500 hover:bg-rose-500/10 transition-all text-left group active:scale-[0.98]"
          >
            <LogOut className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
            <span className="text-xs font-black uppercase tracking-widest truncate">Logout System</span>
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
            <div className="rounded overflow-hidden shadow-2xl border border-border bg-card">
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
                <button onClick={() => setShowInstallDialog(false)} className="p-1.5 rounded-sm hover:bg-muted text-muted-foreground">
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
                <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/30" onClick={() => { install(); setShowInstallDialog(false); }}>Install Now</Button>
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
