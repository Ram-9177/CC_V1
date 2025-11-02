import React from 'react';
import { Home, FileText, Calendar, UtensilsCrossed, User, LayoutDashboard, CheckSquare, QrCode, Bell } from 'lucide-react';
import { Role, ROLES } from '../lib/constants';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const NAV_CONFIGS: Record<Role, NavItem[]> = {
  [ROLES.STUDENT]: [
    { icon: Home, label: 'Home', path: '/student/home' },
    { icon: FileText, label: 'Gate Pass', path: '/student/gate-pass' },
    { icon: Calendar, label: 'Attendance', path: '/student/attendance' },
    { icon: UtensilsCrossed, label: 'Meals', path: '/student/meals' },
    { icon: User, label: 'Profile', path: '/student/profile' }
  ],
  [ROLES.WARDEN]: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/warden/dashboard' },
    { icon: CheckSquare, label: 'Approvals', path: '/warden/approvals' },
    { icon: QrCode, label: 'Gate Console', path: '/warden/gate-console' },
    { icon: Bell, label: 'Notices', path: '/warden/notices' },
    { icon: User, label: 'Profile', path: '/warden/profile' }
  ],
  [ROLES.WARDEN_HEAD]: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/warden/dashboard' },
    { icon: CheckSquare, label: 'Approvals', path: '/warden/approvals' },
    { icon: QrCode, label: 'Gate Console', path: '/warden/gate-console' },
    { icon: Bell, label: 'Notices', path: '/warden/notices' },
    { icon: User, label: 'Profile', path: '/warden/profile' }
  ],
  [ROLES.GATEMAN]: [
    { icon: QrCode, label: 'Gate Queue', path: '/gateman/queue' },
    { icon: CheckSquare, label: 'Scan & Mark', path: '/gateman/scan' },
    { icon: FileText, label: 'High-Search', path: '/gateman/search' },
    { icon: User, label: 'Profile', path: '/gateman/profile' }
  ],
  [ROLES.CHEF]: [
    { icon: UtensilsCrossed, label: 'Meals Board', path: '/chef/meals' },
    { icon: FileText, label: 'Intents', path: '/chef/intents' },
    { icon: Bell, label: 'Notices', path: '/chef/notices' },
    { icon: User, label: 'Profile', path: '/chef/profile' }
  ],
  [ROLES.SUPER_ADMIN]: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
    { icon: User, label: 'Users', path: '/admin/users' },
    { icon: FileText, label: 'Reports', path: '/admin/reports' },
    { icon: Bell, label: 'Notices', path: '/admin/notices' },
    { icon: User, label: 'Profile', path: '/admin/profile' }
  ]
};

interface MobileNavProps {
  role: Role;
  currentPath?: string;
  onNavigate?: (path: string) => void;
  platform?: 'ios' | 'android';
}

export function MobileNav({ role, currentPath = '', onNavigate, platform = 'ios' }: MobileNavProps) {
  const navItems = NAV_CONFIGS[role] || NAV_CONFIGS[ROLES.STUDENT];
  
  const handleClick = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 bg-card border-t border-border ${
        platform === 'ios' ? 'pb-6' : 'pb-2'
      }`}
      style={{ 
        maxWidth: platform === 'ios' ? '390px' : '412px',
        margin: '0 auto'
      }}
    >
      <div className="flex items-center justify-around px-2 pt-2">
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path;
          
          return (
            <button
              key={idx}
              onClick={() => handleClick(item.path)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[44px] ${
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-[11px]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
