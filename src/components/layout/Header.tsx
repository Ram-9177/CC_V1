import { memo, useEffect, useState } from 'react'
import { Menu, Bell, Moon, Sun } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { getStudentAvatar } from '@/lib/student'
import { useUnreadCount } from '@/hooks/features/useNotifications'

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
  const { data: unreadCount } = useUnreadCount(!!user)

  return (
    <header className="sticky top-0 z-30 border-b shadow-sm transition-all text-foreground" style={{ backgroundColor: '#F1F8FF', borderColor: 'rgba(59, 130, 246, 0.25)' }}>
      <div className="grid h-20 items-center justify-between px-4 sm:px-6 grid-cols-[auto_1fr]">
        {/* Left: Mobile hamburger */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-700 hover:text-orange-600 hover:bg-white/60 transition-all p-2 -ml-2 rounded-xl border border-transparent hover:border-blue-300"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* Right: Notifications + User */}
        <div className="flex items-center justify-end gap-1.5">
          <div className="hidden lg:flex items-center gap-2 rounded-full border border-blue-300/50 bg-white px-2.5 py-1.5 text-[11px] text-slate-900 shadow-sm">
            <kbd className="rounded-full border border-blue-300/70 bg-orange-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-normal text-orange-600">
              {isMacPlatform ? 'Cmd' : 'Ctrl'}+K
            </kbd>
            <span className="font-semibold">Search</span>
          </div>

          <button
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            className="relative rounded-xl border border-blue-300/50 bg-white p-2 text-slate-900 shadow-sm transition-all hover:border-blue-400 hover:bg-orange-50 hover:text-orange-600"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {/* Notification Bell */}
          <button
            onClick={() => navigate('/notifications')}
            className="relative rounded-xl border border-blue-300/50 bg-white p-2 text-slate-900 shadow-sm transition-all hover:border-blue-400 hover:bg-orange-50 hover:text-orange-600"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {(unreadCount?.unread_count ?? 0) > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-orange-600 rounded-full border-2 border-white shadow-[0_0_8px_rgba(249,115,22,0.7)] animate-pulse" />
            )}
          </button>

          {/* User Avatar */}
          <Link
            to="/profile"
            className="flex items-center gap-2 rounded-xl border border-blue-300/50 p-1.5 transition-all hover:border-blue-400 hover:bg-orange-50 group"
          >
            <div className="h-8 w-8 min-w-8 rounded-full bg-blue-200 flex items-center justify-center border border-blue-300/60 group-hover:border-blue-400 group-hover:bg-blue-300 transition-all overflow-hidden shadow-sm">
              <img
                src={getStudentAvatar(user).replace('/upload/', '/upload/w_100,q_auto,f_auto/')}
                alt="Profile"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            </div>
          </Link>
        </div>
      </div>
    </header>
  )
}

const MemoizedHeader = memo(Header);
export default MemoizedHeader;
