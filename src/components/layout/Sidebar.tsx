import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useState, useMemo, memo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { 
  User, 
  Bell,
  Activity,
  X,
  Smartphone,
  CheckCircle2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { buildNavigation } from '@/core/navigation/buildNavigation'
import { filterByPermissions } from '@/core/navigation/filterByPermissions'
import { attachCounts } from '@/core/navigation/attachCounts'
import { useMyPermissions } from '@/hooks/useMyPermissions'
import { usePWAStore } from '@/lib/pwa-store'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { useUIStore } from '@/lib/ui-store'
import { useRoleStats } from '@/hooks/useRoleStats'

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
    const navigation = buildNavigation({ role, isStudentHr: user?.is_student_hr })
    const permittedNavigation = filterByPermissions({
      categories: navigation,
      role,
      studentType: user?.student_type,
      isStudentHr: user?.is_student_hr,
      permissions,
    })
    return attachCounts({ categories: permittedNavigation, role, routeStats })
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
          className="fixed inset-0 z-40 bg-slate-950/40 transition-opacity lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[100] w-[280px] lg:w-72 bg-card border-r border-border shadow-2xl transform transition-all duration-300 ease-out lg:translate-x-0 lg:top-3 lg:bottom-3 lg:left-3 lg:h-auto lg:rounded-[1.75rem] lg:border overflow-hidden flex flex-col h-[100dvh]",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-20 px-6 shrink-0 shadow-sm border-b" style={{ backgroundColor: '#F1F8FF', borderColor: 'rgba(59, 130, 246, 0.15)' }}>
          <Link to="/dashboard" onClick={() => setOpen(false)} className="flex items-center active:scale-95 transition-transform group">
            <img
              src="/CC.png"
              alt="Campus Core"
              className="h-12 w-auto max-w-[190px] object-contain"
            />
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden text-muted-foreground hover:bg-accent lg:hover:text-primary transition-all p-2.5 bg-card border border-border shadow-sm rounded-xl active:rotate-90"
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
                className="flex items-center gap-4 p-4 rounded-[1.15rem] bg-primary/5 border border-border/75 hover:border-primary/25 hover:bg-card transition-all duration-300 group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity text-foreground">
                   <User className="h-8 w-8" />
                </div>
                <div className="h-12 w-12 rounded-2xl bg-card p-[2px] shadow-inner flex-shrink-0 border border-border/60">
                  <div className="h-full w-full rounded-2xl bg-primary/10 flex items-center justify-center">
                     <span className="text-sm font-black text-foreground">
                      {(user.first_name?.[0] || user.username?.[0])?.toUpperCase()}
                     </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-foreground truncate uppercase tracking-normaler">
                    {user.first_name || user.username}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-normal truncate">
                      {user.role?.replace('_', ' ') || 'User'}
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          )}

          <div className="space-y-10 pb-24">
            {filteredCategories.map((category, index) => (
              <div key={category.title} className="space-y-3">
                <h3 className={`px-6 select-none ${index % 2 === 0 ? 'section-heading' : 'section-heading-blue'}`} style={{fontFamily: '"Lovelo", sans-serif'}}>
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
                          "w-full flex items-center px-4 py-3 text-sm font-semibold rounded-lg border transition-all duration-200 group relative",
                            isActive
                            ? "bg-gradient-to-r from-primary/15 to-primary/5 text-primary border-primary/30 shadow-sm"
                            : "text-foreground/70 border-transparent hover:bg-primary/10 hover:border-primary/20 hover:text-primary"
                        )}
                      >
                        <item.icon className={cn(
                          "h-5 w-5 mr-3 shrink-0 transition-transform group-hover:scale-110", 
                          isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                        )} />
                        <span className="relative z-10 flex-1 text-left min-w-0 truncate">{item.name}</span>
                        {item.count > 0 && (
                          <div className={cn(
                            "px-2.5 py-0.5 rounded-lg text-[10px] font-bold min-w-[24px] text-center shadow-sm animate-in zoom-in duration-300",
                            isActive ? "bg-primary text-white" : "bg-secondary text-white border border-secondary/70"
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
              <div className="flex items-center justify-between p-3 rounded-xl bg-accent/45 border border-border/75 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-normal text-muted-foreground">Online</span>
                </div>
                <Badge variant="outline" className="text-[8px] font-black uppercase tracking-normaler border-border text-foreground bg-card/75">PROD</Badge>
              </div>
            </div>
          </div>
        </nav>

        <div className="p-6 border-t border-border space-y-3 bg-card shrink-0 pb-[calc(1.5rem+env(safe-area-inset-bottom,20px))]">
          {!isStandalone && (
            <button
               onClick={() => setShowInstallDialog(prev => !prev)}
               className={cn(
                 "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left group",
                 showInstallDialog ? "bg-accent/65 border-border" : "bg-accent/35 border-primary/20 hover:bg-accent/55"
               )}
            >
               <Smartphone className={cn("h-5 w-5 text-primary group-hover:rotate-12 transition-transform")} />
              <span className="text-xs font-black uppercase tracking-normal text-primary truncate">
                {isInstallable ? 'Install App' : 'Get Mobile App'}
              </span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all text-left group active:scale-[0.98]"
          >
            <LogOut className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
            <span className="text-xs font-black uppercase tracking-normal truncate">Logout System</span>
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
                    <p className="text-sm font-black text-foreground tracking-normal">Install App</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-normal">Add to Home Screen</p>
                  </div>
                </div>
                <button onClick={() => setShowInstallDialog(false)} className="p-1.5 rounded-sm hover:bg-muted text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-5 py-3 space-y-3">
                {isInstallable ? (
                  <>
                    {[
                      { icon: CheckCircle2, title: 'Instant Access', desc: 'Launch from home screen' },
                      { icon: Bell, title: 'Alerts', desc: 'Real-time notifications' },
                    ].map((feature) => (
                      <div key={feature.title} className="flex items-center gap-3">
                        <feature.icon className="h-4 w-4 text-primary shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-foreground">{feature.title}</span>
                          <span className="text-[10px] text-muted-foreground ml-1.5">{feature.desc}</span>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="p-3 rounded-sm bg-muted/30 border border-dashed text-[11px] space-y-2">
                    <p className="font-bold text-foreground">To install on your device:</p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Open your browser menu (⋮ or <Activity className="w-3 h-3 inline pb-1" />)</li>
                      <li>Select <span className="text-foreground font-semibold">"Add to Home Screen"</span></li>
                      <li>Confirm the installation</li>
                    </ol>
                  </div>
                )}
              </div>

              <div className="flex gap-2 px-5 pt-1 pb-5">
                <Button variant="ghost" size="sm" onClick={() => setShowInstallDialog(false)} className="flex-1 rounded-sm font-black text-[10px] uppercase tracking-normal">Later</Button>
                {isInstallable && (
                  <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm font-black text-[10px] uppercase tracking-normal shadow-lg shadow-primary/30" onClick={() => { install(); setShowInstallDialog(false); }}>Install Now</Button>
                )}
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
