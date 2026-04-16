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
  QrCode,
  Users,
  Activity,
  Hammer,
  UserPlus,
  Trophy,
  AlertTriangle,
  MessageSquare,
  Building,
  FileStack,
  GitPullRequest,
} from 'lucide-react'
import type { SidebarCategory, SidebarItem } from '@/types'

type NavigationCategoryConfig = {
  title: string
  items: SidebarItem[]
}

const roleWorkflows: Record<string, NavigationCategoryConfig[]> = {
  warden: [
    {
      title: 'Warden Desk',
      items: [
        { name: 'Control Center', href: '/dashboard', icon: Home },
        { name: 'Room Inventory', href: '/rooms', icon: DoorOpen },
        { name: 'Room Requests', href: '/room-requests', icon: GitPullRequest },
        { name: 'Room Mapping', href: '/room-mapping', icon: Bed },
        { name: 'Tenants & Users', href: '/tenants', icon: Users },
      ],
    },
    {
      title: 'Daily Operations',
      items: [
        { name: 'Gatepass Approvals', href: '/gate-passes', icon: ClipboardCheck },
        { name: 'Attendance Registry', href: '/attendance', icon: Activity },
        { name: 'Leave Requests', href: '/leaves', icon: Calendar },
        { name: 'Visitor Log', href: '/visitors', icon: UserPlus },
      ],
    },
    {
      title: 'Welfare & Discipline',
      items: [
        { name: 'Complaints', href: '/complaints', icon: Hammer },
        { name: 'Disciplinary Action', href: '/fines', icon: AlertTriangle },
        { name: 'Support Messages', href: '/messages', icon: MessageSquare },
      ],
    },
    {
      title: 'Insights',
      items: [
        { name: 'Metric Analysis', href: '/metrics', icon: BarChart3 },
        { name: 'Hostel Reports', href: '/reports', icon: FileText },
      ],
    },
  ],
  head_warden: [
    {
      title: 'Head Warden HQ',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: Home },
        { name: 'Room Control', href: '/rooms', icon: DoorOpen },
        { name: 'Room Requests', href: '/room-requests', icon: GitPullRequest },
        { name: 'Tenant Control', href: '/tenants', icon: Users },
      ],
    },
    {
      title: 'Operations',
      items: [
        { name: 'Gatepass Oversight', href: '/gate-passes', icon: ClipboardCheck },
        { name: 'Attendance', href: '/attendance', icon: Activity },
        { name: 'Leave Approvals', href: '/leaves', icon: Calendar },
        { name: 'Visitor Management', href: '/visitors', icon: UserPlus },
      ],
    },
    {
      title: 'Welfare & Discipline',
      items: [
        { name: 'All Complaints', href: '/complaints', icon: Hammer },
        { name: 'Disciplinary Log', href: '/fines', icon: AlertTriangle },
        { name: 'Audit Logs', href: '/audit-logs', icon: FileStack },
        { name: 'Support Messages', href: '/messages', icon: MessageSquare },
      ],
    },
    {
      title: 'Analytics',
      items: [
        { name: 'System Metrics', href: '/metrics', icon: BarChart3 },
        { name: 'Global Reports', href: '/reports', icon: FileText },
      ],
    },
  ],
  chef: [
    {
      title: 'Dining Central',
      items: [
        { name: 'Meal Forecast', href: '/dashboard', icon: Home },
        { name: 'Meal Registry', href: '/meals', icon: Utensils },
        { name: 'Attendance', href: '/attendance', icon: Activity },
      ],
    },
    {
      title: 'Feedback',
      items: [
        { name: 'Food Complaints', href: '/complaints', icon: Hammer },
        { name: 'Notices', href: '/notices', icon: FileText },
      ],
    },
  ],
  head_chef: [
    {
      title: 'Kitchen Admin',
      items: [
        { name: 'Meal Control', href: '/dashboard', icon: Home },
        { name: 'Meal Registry', href: '/meals', icon: Utensils },
        { name: 'Service Registry', href: '/attendance', icon: Activity },
      ],
    },
    {
      title: 'Oversight',
      items: [
        { name: 'System Complaints', href: '/complaints', icon: Hammer },
        { name: 'Notices', href: '/notices', icon: FileText },
        { name: 'Reports', href: '/reports', icon: FileText },
      ],
    },
  ],
  gate_security: [
    {
      title: 'Security Desk',
      items: [
        { name: 'Live Scans', href: '/dashboard', icon: QrCode },
        { name: 'Gatepass Registry', href: '/gate-passes', icon: ClipboardCheck },
        { name: 'Terminal Check', href: '/gate-scans', icon: QrCode },
        { name: 'Visitor Log', href: '/visitors', icon: UserPlus },
      ],
    },
  ],
  security_head: [
    {
      title: 'Security Hub',
      items: [
        { name: 'All Scans', href: '/dashboard', icon: QrCode },
        { name: 'Pass Registry', href: '/gate-passes', icon: ClipboardCheck },
        { name: 'Personnel Check', href: '/gate-scans', icon: QrCode },
        { name: 'Visitor Log', href: '/visitors', icon: UserPlus },
      ],
    },
    {
      title: 'Intelligence',
      items: [
        { name: 'Metrics', href: '/metrics', icon: BarChart3 },
        { name: 'System Reports', href: '/reports', icon: FileText },
      ],
    },
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
      ],
    },
    {
      title: 'Administration',
      items: [
        { name: 'Attendance', href: '/attendance', icon: Activity },
        { name: 'Notices', href: '/notices', icon: FileText },
        { name: 'HR Reports', href: '/reports', icon: FileText },
        { name: 'Messages', href: '/messages', icon: MessageSquare },
      ],
    },
  ],
  pd: [
    {
      title: 'Sports & Events',
      items: [
        { name: 'Sports Dashboard', href: '/sports-dashboard', icon: Trophy },
        { name: 'Events Desk', href: '/events', icon: Calendar },
        { name: 'Booking Control', href: '/sports-booking', icon: Trophy },
        { name: 'Hall Bookings', href: '/hall-booking', icon: Building },
      ],
    },
    {
      title: 'Career & Campus',
      items: [
        { name: 'Placements', href: '/placements', icon: FileStack },
        { name: 'Notices Control', href: '/notices', icon: FileText },
        { name: 'Disciplinary Log', href: '/fines', icon: AlertTriangle },
      ],
    },
  ],
  principal: [
    {
      title: 'Institutional View',
      items: [
        { name: 'Campus Pulse', href: '/metrics', icon: BarChart3 },
        { name: 'Analytics', href: '/analytics', icon: Activity },
        { name: 'Placement Reports', href: '/placements', icon: Trophy },
      ],
    },
    {
      title: 'Administration',
      items: [
        { name: 'Notice Control', href: '/notices', icon: FileText },
        { name: 'Hall Bookings', href: '/hall-booking', icon: Building },
        { name: 'Campus Events', href: '/events', icon: Calendar },
        { name: 'Disciplinary History', href: '/fines', icon: AlertTriangle },
        { name: 'Global Reports', href: '/reports', icon: FileText },
      ],
    },
  ],
  admin: [
    {
      title: 'System Control',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: Home },
        { name: 'Colleges', href: '/colleges', icon: Building },
        { name: 'All Users', href: '/tenants', icon: Users },
      ],
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
      ],
    },
    {
      title: 'Welfare',
      items: [
        { name: 'Complaints', href: '/complaints', icon: Hammer },
        { name: 'Disciplinary', href: '/fines', icon: AlertTriangle },
        { name: 'Messages', href: '/messages', icon: MessageSquare },
        { name: 'Notices', href: '/notices', icon: FileText },
      ],
    },
    {
      title: 'Intelligence',
      items: [
        { name: 'Analytics', href: '/analytics', icon: Activity },
        { name: 'Metrics', href: '/metrics', icon: BarChart3 },
        { name: 'Reports', href: '/reports', icon: FileText },
        { name: 'Placements', href: '/placements', icon: Trophy },
      ],
    },
  ],
  super_admin: [
    {
      title: 'Platform',
      items: [
        { name: 'Tenants & Colleges', href: '/colleges', icon: Building },
        { name: 'All Users', href: '/tenants', icon: Users },
        { name: 'Dashboard', href: '/dashboard', icon: Home },
      ],
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
      ],
    },
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
      ],
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
      ],
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
      ],
    },
  ],
}

const defaultCategories: SidebarCategory[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
      { name: 'My Profile', href: '/profile', icon: User },
    ],
  },
  {
    title: 'Hostel Management',
    items: [
      { name: 'Rooms', href: '/rooms', icon: DoorOpen },
      { name: 'Room Mapping', href: '/room-mapping', icon: Bed },
      { name: 'Tenants', href: '/tenants', icon: Users },
      { name: 'Attendance', href: '/attendance', icon: Activity },
      { name: 'Complaints', href: '/complaints', icon: Hammer },
    ],
  },
  {
    title: 'Gate & Security',
    items: [
      { name: 'Gatepass', href: '/gate-passes', icon: ClipboardCheck },
      { name: 'Gate Scans', href: '/gate-scans', icon: QrCode },
      { name: 'Visitors', href: '/visitors', icon: UserPlus },
    ],
  },
  {
    title: 'Resources',
    items: [
      { name: 'Meals', href: '/meals', icon: Utensils },
      { name: 'Notices', href: '/notices', icon: FileText },
      { name: 'Events', href: '/events', icon: Calendar },
      { name: 'Sports', href: '/sports-dashboard', icon: Trophy },
    ],
  },
]

export type NavigationBuildInput = {
  role: string | null
  isStudentHr?: boolean
}

export function buildNavigation({ role, isStudentHr }: NavigationBuildInput): SidebarCategory[] {
  const rawCategories = (role && roleWorkflows[role]) || defaultCategories
  const categories = rawCategories.map((category) => ({
    ...category,
    items: [...category.items],
  }))

  if (role === 'student' && isStudentHr) {
    const hostelLife = categories.find((category) => category.title === 'Hostel Life')
    if (hostelLife && !hostelLife.items.some((item) => item.href === '/room-mapping')) {
      hostelLife.items.push({ name: 'Room Mapping', href: '/room-mapping', icon: Bed })
    }
  }

  return categories
}
