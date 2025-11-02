import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/context';
import { hasBackend } from '../lib/config';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Badge } from './ui/badge';
import { Bell, Home, LogOut, User, Menu as MenuIcon, ChevronLeft } from 'lucide-react';
import { t } from '../lib/i18n';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { HallticketChip } from './HallticketChip';
import { getUnreadCount } from '../lib/notices';
import { useSocketEvent } from '../lib/socket';
import { OfflineBadge } from './OfflineBadge';
import { OutboxBadge } from './OutboxBadge';
import type { Role } from '../lib/types';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout, role, switchRole } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'STUDENT':
        return 'bg-blue-600';
      case 'GATEMAN':
        return 'bg-green-600';
      case 'WARDEN':
      case 'WARDEN_HEAD':
        return 'bg-purple-600';
      case 'CHEF':
        return 'bg-orange-600';
      case 'SUPER_ADMIN':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  const navigation = {
    STUDENT: [
      { name: 'Dashboard', path: '/student' },
      { name: 'Gate Pass', path: '/student/gate-pass' },
      { name: 'Attendance', path: '/student/attendance' },
      { name: 'Meals', path: '/student/meals' },
      { name: 'Notices', path: '/student/notices' },
    ],
    GATEMAN: [
      { name: 'Dashboard', path: '/gateman' },
      { name: 'Gate Queue', path: '/gateman/queue' },
      { name: 'Scan', path: '/gateman/scan' },
      { name: 'Recent Events', path: '/gateman/events' },
      { name: 'Rooms', path: '/gateman/rooms' },
    ],
    WARDEN: [
      { name: 'Dashboard', path: '/warden' },
      { name: 'Approvals', path: '/warden/approvals' },
      { name: 'Attendance', path: '/warden/attendance' },
      { name: 'Rooms', path: '/warden/rooms' },
      { name: 'Users CSV', path: '/warden/users' },
      { name: 'Notices', path: '/warden/notices' },
    ],
    WARDEN_HEAD: [
      { name: 'Dashboard', path: '/warden' },
      { name: 'Approvals', path: '/warden/approvals' },
      { name: 'Attendance', path: '/warden/attendance' },
      { name: 'Rooms', path: '/warden/rooms' },
      { name: 'Users CSV', path: '/warden/users' },
      { name: 'Notices', path: '/warden/notices' },
      // Extra control: access to Gateman tools
      { name: 'Gateman Dashboard', path: '/gateman' },
      { name: 'Gate Queue', path: '/gateman/queue' },
      { name: 'Scan', path: '/gateman/scan' },
      { name: 'Recent Events', path: '/gateman/events' },
      // Extra control: access to Chef tools
      { name: 'Chef Dashboard', path: '/chef' },
      { name: 'Meals Board', path: '/chef/meals' },
      { name: 'Intents Summary', path: '/chef/intents' },
      { name: 'Chef Notices', path: '/chef/notices' },
      // Extra control: admin ops
      { name: 'Admin Dashboard', path: '/admin' },
      { name: 'Admin Users', path: '/admin/users' },
      { name: 'Admin Reports', path: '/admin/reports' },
      { name: 'Admin Ops', path: '/admin/ops' },
      { name: 'Admin Notices', path: '/admin/notices' },
      { name: 'Admin Rooms', path: '/admin/rooms' },
    ],
    CHEF: [
      { name: 'Dashboard', path: '/chef' },
      { name: 'Meals Board', path: '/chef/meals' },
      { name: 'Intents Summary', path: '/chef/intents' },
      { name: 'Users CSV', path: '/chef/users' },
      { name: 'Notices', path: '/chef/notices' },
    ],
    SUPER_ADMIN: [
      // Admin
      { name: 'Admin Dashboard', path: '/admin' },
      { name: 'Admin Users', path: '/admin/users' },
      { name: 'Admin Tenants', path: '/admin/tenants' },
      { name: 'Admin Colleges', path: '/admin/colleges' },
      { name: 'Admin Features', path: '/admin/features' },
      { name: 'Admin Reports', path: '/admin/reports' },
      { name: 'Admin Ops', path: '/admin/ops' },
      { name: 'Admin Notices', path: '/admin/notices' },
      { name: 'Admin Rooms', path: '/admin/rooms' },
      // Warden suite
      { name: 'Warden Dashboard', path: '/warden' },
      { name: 'Warden Approvals', path: '/warden/approvals' },
      { name: 'Warden Attendance', path: '/warden/attendance' },
      { name: 'Warden Rooms', path: '/warden/rooms' },
      { name: 'Warden Users CSV', path: '/warden/users' },
      { name: 'Warden Notices', path: '/warden/notices' },
      // Gateman tools
      { name: 'Gateman Dashboard', path: '/gateman' },
      { name: 'Gate Queue', path: '/gateman/queue' },
      { name: 'Scan', path: '/gateman/scan' },
      { name: 'Recent Events', path: '/gateman/events' },
      { name: 'Gateman Rooms', path: '/gateman/rooms' },
      // Chef tools
      { name: 'Chef Dashboard', path: '/chef' },
      { name: 'Meals Board', path: '/chef/meals' },
      { name: 'Intents Summary', path: '/chef/intents' },
      { name: 'Chef Users CSV', path: '/chef/users' },
      { name: 'Chef Notices', path: '/chef/notices' },
    ],
  };
  const getHomePath = (r: Role | string) => {
    switch (r) {
      case 'STUDENT':
        return '/student';
      case 'GATEMAN':
        return '/gateman';
      case 'WARDEN':
      case 'WARDEN_HEAD':
        return '/warden';
      case 'CHEF':
        return '/chef';
      case 'SUPER_ADMIN':
        return '/admin';
      default:
        return '/';
    }
  };

  const getProfilePath = (r: Role | string) => {
    switch (r) {
      case 'STUDENT':
        return '/student/profile';
      case 'GATEMAN':
        return '/gateman/profile';
      case 'WARDEN':
      case 'WARDEN_HEAD':
        return '/warden/profile';
      case 'CHEF':
        return '/chef/profile';
      case 'SUPER_ADMIN':
        return '/admin/profile';
      default:
        return '/student/profile';
    }
  };

  const currentNav = navigation[role] || navigation.STUDENT;
  const [unread, setUnread] = useState<number>(0);

  async function refreshUnread() {
    try {
      const { count } = await getUnreadCount();
      setUnread(count || 0);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refreshUnread();
  }, []);

  useSocketEvent('notice:created', refreshUnread);
  useSocketEvent('notice:updated', refreshUnread);
  useSocketEvent('notice:deleted', refreshUnread);

  const NavLinks = () => (
    <>
      {currentNav.map((item) => (
        <Button
          key={item.path}
          variant="ghost"
          className="w-full justify-start"
          onClick={() => navigate(item.path)}
        >
          {item.name}
        </Button>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:inline-flex"
              aria-label="Go back"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  if (window.history.length > 1) navigate(-1);
                  else navigate('/');
                }
              }}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <MenuIcon className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="p-6 border-b">
                  <h2 className="font-semibold">Navigation</h2>
                </div>
                <div className="p-4 space-y-2">
                  <NavLinks />
                </div>
              </SheetContent>
            </Sheet>

            <button onClick={() => navigate(getHomePath(role))} className="flex items-center gap-2">
              <Home className="h-6 w-6" />
              <span className="text-xl font-semibold hidden sm:inline">HostelConnect</span>
            </button>
            <div className="hidden md:flex items-center gap-2">
              <OutboxBadge />
              <OfflineBadge />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => {
                const noticesPath = (currentNav.find(i => i.name.toLowerCase().includes('notices'))?.path) || '/student/notices';
                navigate(noticesPath);
              }}
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] leading-4 h-4 min-w-4 px-1 rounded-full text-center">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <Avatar className={`h-8 w-8 ${getRoleColor(role)}`}>
                    <AvatarFallback className="text-white">
                      {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left">
                    <div className="text-sm font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.hallticket}</div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="p-2">
                  <HallticketChip hallticket={user.hallticket} name={user.name} />
                  <div className="mt-2">
                    <Badge variant="secondary">{role}</Badge>
                  </div>
                  {user.hostelName && (
                    <p className="text-sm text-muted-foreground mt-2">{user.hostelName}</p>
                  )}
                </div>
                <DropdownMenuSeparator />
                {!hasBackend() && (
                  <>
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Switch Role (Demo)</div>
                    <div className="px-2 pb-1 grid grid-cols-2 gap-1">
                      {(['STUDENT','GATEMAN','WARDEN','WARDEN_HEAD','CHEF','SUPER_ADMIN'] as const).map((r) => (
                        <Button key={r} variant="outline" size="sm" className="justify-start"
                          onClick={() => {
                            // quick role switch
                            try {
                              // update auth role and navigate
                              switchRole(r as any);
                              navigate(getHomePath(r));
                            } catch {}
                          }}
                        >
                          {r.replace('_',' ')}
                        </Button>
                      ))}
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => navigate(getProfilePath(role))}>
                  <User className="h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="container flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-64 flex-col gap-2 border-r p-4 min-h-[calc(100vh-4rem)]">
          <NavLinks />
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
