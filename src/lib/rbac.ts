export type Role = 'student' | 'staff' | 'admin' | 'super_admin' | 'head_warden' | 'warden' | 'chef' | 'head_chef' | 'gate_security' | 'security_head'

// Role constants - must match backend exactly
export const ROLE_STUDENT = 'student'
export const ROLE_STAFF = 'staff'
export const ROLE_ADMIN = 'admin'
export const ROLE_SUPER_ADMIN = 'super_admin'
export const ROLE_HEAD_WARDEN = 'head_warden'
export const ROLE_WARDEN = 'warden'
export const ROLE_CHEF = 'chef'
export const ROLE_HEAD_CHEF = 'head_chef'
export const ROLE_GATE_SECURITY = 'gate_security'
export const ROLE_SECURITY_HEAD = 'security_head'

// Role groups
export const ADMIN_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN]
export const AUTHORITY_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN, ROLE_WARDEN]
export const STAFF_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN, ROLE_WARDEN, ROLE_STAFF, ROLE_CHEF, ROLE_HEAD_CHEF]
export const SECURITY_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_SECURITY_HEAD, ROLE_GATE_SECURITY]
export const WARDEN_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN, ROLE_WARDEN]
export const CHEF_ROLES = [ROLE_CHEF, ROLE_HEAD_CHEF]
export const GATE_ROLES = [ROLE_GATE_SECURITY, ROLE_SECURITY_HEAD]
export const MANAGEMENT_ROLES = [...AUTHORITY_ROLES, ROLE_STAFF]

// Helper functions
export const isAdmin = (role?: string | null) => role ? ADMIN_ROLES.includes(role as Role) : false
export const isStaff = (role?: string | null) => role ? STAFF_ROLES.includes(role as Role) : false
export const isStudent = (role?: string | null) => role === ROLE_STUDENT
export const isWarden = (role?: string | null) => role ? WARDEN_ROLES.includes(role as Role) : false
export const isSecurity = (role?: string | null) => role ? SECURITY_ROLES.includes(role as Role) : false
export const isManagement = (role?: string | null) => role ? MANAGEMENT_ROLES.includes(role as Role) : false

export const ROLE_HOME: Record<Role, string> = {
  student: '/dashboard',
  staff: '/dashboard',
  admin: '/dashboard',
  super_admin: '/dashboard',
  head_warden: '/dashboard',
  warden: '/dashboard',
  chef: '/meals',
  head_chef: '/meals',
  gate_security: '/gate-passes',
  security_head: '/gate-passes',
}

const COMMON_PATHS = [
    '/dashboard', '/profile', '/notifications', '/messages', '/notices', '/events', '/digital-id', '/fines', '/disciplinary'
]

const ROLE_ALLOWED_PATHS: Record<Role, string[]> = {
  student: [
    ...COMMON_PATHS,
    '/gate-passes',
    '/attendance',
    '/meals',
    '/complaints',
    '/leaves',
    '/visitors',
  ],
  staff: [
    ...COMMON_PATHS,
    '/rooms',
    '/gate-passes',
    '/attendance',
    '/meals',
    '/gate-scans',
    '/tenants',
    '/room-mapping',
  ],
  warden: [
    ...COMMON_PATHS,
    '/rooms',
    '/gate-passes',
    '/attendance',
    '/meals',
    '/gate-scans',
    '/tenants',
    '/metrics',
    '/reports',
    '/room-mapping',
    '/complaints',
    '/leaves',
    '/visitors',
  ],
  head_warden: [
      ...COMMON_PATHS,
      '/rooms',
      '/gate-passes',
      '/attendance',
      '/meals',
      '/gate-scans',
      '/tenants',
      '/metrics',
      '/reports',
      '/room-mapping',
      '/leaves',
      '/visitors',
  ],
  admin: [
    ...COMMON_PATHS,
    '/rooms',
    '/gate-passes',
    '/attendance',
    '/meals',
    '/gate-scans',
    '/colleges',
    '/tenants',
    '/metrics',
    '/reports',
    '/room-mapping',
    '/visitors',
    '/complaints',
    '/leaves',
  ],
  super_admin: [  // All Access
    ...COMMON_PATHS,
    '/rooms',
    '/gate-passes',
    '/attendance',
    '/meals',
    '/gate-scans',
    '/colleges',
    '/tenants',
    '/metrics',
    '/reports',
    '/room-mapping',
    '/visitors',
    '/complaints',
    '/leaves',
  ],
  chef: [
      ...COMMON_PATHS,
      '/meals',
      '/attendance',
      '/complaints',
  ],
  head_chef: [
      ...COMMON_PATHS,
      '/meals',
      '/attendance',
      '/complaints',
  ],
  gate_security: [
      ...COMMON_PATHS,
      '/gate-passes',
      '/visitors',
  ],
  security_head: [
      ...COMMON_PATHS,
      '/gate-passes',
      '/reports',
      '/metrics',
      '/visitors',
  ]
}

export function getRoleHome(role?: string | null) {
  if (!role) return '/dashboard'
  const normalized = role.toLowerCase() as Role
  return ROLE_HOME[normalized] ?? '/dashboard'
}

export function canAccessPath(role: string | null | undefined, path: string) {
  if (!role) return false
  const normalized = role.toLowerCase() as Role
  const allowed = ROLE_ALLOWED_PATHS[normalized]
  if (!allowed) return false

  if (path === '/' || path === '') return true

  return allowed.some((route) => path === route || path.startsWith(`${route}/`))
}
