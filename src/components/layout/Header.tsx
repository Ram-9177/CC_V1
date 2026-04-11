import { memo, useEffect, useState } from 'react'
import { Menu, Bell, Moon, Sun } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { NavbarAccentIllustration } from '@/components/illustrations'

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void
}

function Header({ setSidebarOpen }: HeaderProps) {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const isMacPlatform = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme)
      return
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setTheme(prefersDark ? 'dark' : 'light')
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  // Fetch unread notification count
  const { data: unreadCount } = useQuery<number>({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      try {
        const res = await api.get('/notifications/unread_count/')
        return res.data?.count ?? 0
      } catch {
        return 0
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <header className="sticky top-0 z-30 bg-background/90 border-b border-border backdrop-blur-xl shadow-sm transition-all text-foreground">
      <div className="grid h-14 items-center gap-2 px-4 sm:px-6 grid-cols-[1fr_auto] xl:grid-cols-[auto_1fr_auto]">
        {/* Left: Mobile hamburger + Title */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all p-2 -ml-2 rounded-xl"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Elevated Brand Identity */}
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            aria-label="Go to dashboard"
            className="flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
          >
            <span className="text-xl sm:text-2xl font-black tracking-tighter text-foreground drop-shadow-sm uppercase items-baseline flex">
              CAMPUS<span className="text-primary italic text-2xl sm:text-4xl leading-none">C</span>ORE
            </span>
          </button>
        </div>

        <div
          className="hidden min-w-0 justify-center overflow-hidden xl:flex pointer-events-none"
          aria-hidden
        >
          <div className="rounded-xl border border-border/60 bg-muted/30 px-2.5 py-1">
            <NavbarAccentIllustration className="opacity-[0.78] max-w-[min(160px,26vw)]" />
          </div>
        </div>

        {/* Right: Notifications + User */}
        <div className="flex items-center justify-end gap-1">
          <div className="hidden lg:flex items-center gap-2 rounded-lg border border-border bg-card/80 px-2 py-1 text-[11px] text-muted-foreground">
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-foreground">
              {isMacPlatform ? 'Cmd' : 'Ctrl'}+K
            </kbd>
            <span className="font-semibold">Search</span>
          </div>

          <button
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            className="relative p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {/* Notification Bell */}
          <button
            onClick={() => navigate('/notifications')}
            className="relative p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {(unreadCount ?? 0) > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-primary rounded-full border-2 border-background shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse" />
            )}
          </button>

          {/* User Avatar */}
          <Link
            to="/profile"
            className="flex items-center gap-2 p-1.5 rounded-xl transition-all hover:bg-muted group"
          >
            <div className="h-8 w-8 min-w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:border-primary/40 group-hover:bg-primary/20 transition-all overflow-hidden shadow-sm">
              {user?.profile_picture ? (
                <img
                  src={`${user.profile_picture}`.replace('/upload/', '/upload/w_100,q_auto,f_auto/')}
                  alt="Profile"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <span className="text-[11px] font-black text-primary tracking-wider">
                  {user?.first_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase()}
                </span>
              )}
            </div>
          </Link>
        </div>
      </div>
    </header>
  )
}

const MemoizedHeader = memo(Header);
export default MemoizedHeader;
