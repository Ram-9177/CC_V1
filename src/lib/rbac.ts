export type Role = 'student' | 'staff' | 'admin' | 'super_admin' | 'principal' | 'director' | 'hod' | 'head_warden' | 'warden' | 'incharge' | 'chef' | 'head_chef' | 'gate_security' | 'security_head' | 'hr' | 'pd' | 'pt'

// Role constants - must match backend exactly
export const ROLE_STUDENT = 'student'
export const ROLE_STAFF = 'staff'
export const ROLE_ADMIN = 'admin'
export const ROLE_SUPER_ADMIN = 'super_admin'
export const ROLE_PRINCIPAL = 'principal'
export const ROLE_DIRECTOR = 'director'
export const ROLE_HOD = 'hod'
export const ROLE_HEAD_WARDEN = 'head_warden'
export const ROLE_WARDEN = 'warden'
export const ROLE_INCHARGE = 'incharge'
export const ROLE_CHEF = 'chef'
export const ROLE_HEAD_CHEF = 'head_chef'
export const ROLE_GATE_SECURITY = 'gate_security'
export const ROLE_SECURITY_HEAD = 'security_head'
export const ROLE_PD = 'pd'
export const ROLE_PT = 'pt'
export const ROLE_HR = 'hr'

// Role groups
export const ADMIN_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN]
export const AUTHORITY_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN, ROLE_WARDEN]
export const STAFF_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_PRINCIPAL, ROLE_DIRECTOR, ROLE_HOD, ROLE_HEAD_WARDEN, ROLE_WARDEN, ROLE_INCHARGE, ROLE_STAFF, ROLE_CHEF, ROLE_HEAD_CHEF, ROLE_PD, ROLE_PT, ROLE_HR]
export const SECURITY_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_SECURITY_HEAD, ROLE_GATE_SECURITY]
export const WARDEN_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN, ROLE_WARDEN]
export const CHEF_ROLES = [ROLE_CHEF, ROLE_HEAD_CHEF]
export const GATE_ROLES = [ROLE_GATE_SECURITY, ROLE_SECURITY_HEAD]
export const MANAGEMENT_ROLES = [...AUTHORITY_ROLES, ROLE_STAFF, ROLE_PRINCIPAL, ROLE_DIRECTOR, ROLE_HOD, ROLE_INCHARGE]
export const TOP_LEVEL_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN]

// Role hierarchy weights
export const ROLE_HIERARCHY: Record<Role, number> = {
  student: 0,
  staff: 40,
  warden: 50,
  gate_security: 25,
  chef: 20,
  head_warden: 60,
  security_head: 35,
  head_chef: 30,
  incharge: 55,
  hod: 70,
  principal: 80,
  director: 75,
  hr: 45,
  pd: 20,
  pt: 15,
  admin: 90,
  super_admin: 100,
}

// Helper functions
export const isAdmin = (role?: string | null) => role ? ADMIN_ROLES.includes(role as Role) : false
export const isStaff = (role?: string | null) => role ? STAFF_ROLES.includes(role as Role) : false
export const isStudent = (role?: string | null) => role === ROLE_STUDENT
export const isWarden = (role?: string | null) => role ? WARDEN_ROLES.includes(role as Role) : false
export const isSecurity = (role?: string | null) => role ? SECURITY_ROLES.includes(role as Role) : false
export const isManagement = (role?: string | null) => role ? MANAGEMENT_ROLES.includes(role as Role) : false
export const isTopLevelManagement = (role?: string | null) => role ? TOP_LEVEL_ROLES.includes(role as Role) : false

/**
 * Check if the first role is strictly higher than the second role in the hierarchy.
 */
export const isHigherRole = (role1: string | null | undefined, role2: string | null | undefined): boolean => {
  if (!role1 || !role2) return false
  const r1 = role1.toLowerCase() as Role
  const r2 = role2.toLowerCase() as Role
  return (ROLE_HIERARCHY[r1] || 0) > (ROLE_HIERARCHY[r2] || 0)
}

/**
 * Check if a user can edit another user based on hierarchy.
 * Admin/Super Admin can edit anyone.
 * Others can only edit if they are higher in hierarchy and in the same branch (handled via logic in UI or backend).
 */
export const canEditUser = (currentUserRole: string | null | undefined, targetUserRole: string | null | undefined): boolean => {
   if (!currentUserRole || !targetUserRole) return false
   if (isAdmin(currentUserRole)) return true
   return isHigherRole(currentUserRole, targetUserRole)
}

export const ROLE_HOME: Record<Role, string> = {
  student: '/dashboard',
  staff: '/dashboard',
  admin: '/dashboard',
  super_admin: '/colleges',
  principal: '/reports',
  director: '/reports',
  hod: '/events',
  head_warden: '/dashboard',
  warden: '/dashboard',
  incharge: '/dashboard',
  chef: '/meals',
  head_chef: '/meals',
  gate_security: '/gate-passes',
  security_head: '/gate-passes',
  hr: '/dashboard',
  pd: '/sports-dashboard',
  pt: '/sports-dashboard',
}

export const COMMON_PATHS = [
    '/dashboard', '/profile', '/notifications', '/messages', '/notices', '/digital-id', '/unauthorized'
]


const ROLE_ALLOWED_PATHS: Record<Role, string[]> = {
  student: [
    ...COMMON_PATHS,
    '/rooms',
    '/attendance',
    '/meals',
    '/leaves',
    '/visitors',
    '/complaints',
    '/gate-passes',
    '/fines',
    '/events',
    '/sports-booking',
    '/resume',
    '/hall-booking',
    '/placements',
    '/room-requests',
  ],
  staff: [
    ...COMMON_PATHS,
    '/sports-booking',
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
    '/fines',
    '/sports-booking',
  ],
  head_warden: [
    ...COMMON_PATHS,
    '/rooms', '/gate-passes', '/attendance', '/meals',
    '/tenants', '/metrics', '/reports', '/room-mapping', '/complaints',
    '/leaves', '/visitors', '/room-requests',
    '/events', '/fines', '/analytics', '/hall-booking', '/sports-booking', '/audit-logs',
  ],
  admin: [
    ...COMMON_PATHS,
    '/rooms', '/gate-passes', '/attendance', '/meals',
    '/events', '/complaints', '/visitors',
    '/gate-scans', '/colleges', '/tenants', '/metrics', '/reports',
    '/room-mapping', '/sports-dashboard', '/sports-booking', '/hall-booking', '/fines',
    '/placements', '/analytics', '/leaves', '/room-requests', '/audit-logs', '/alumni',
  ],
  super_admin: [
    ...COMMON_PATHS,
    '/rooms', '/gate-passes', '/attendance', '/meals', '/gate-scans',
    '/colleges', '/tenants', '/metrics', '/reports', '/room-mapping',
    '/visitors', '/complaints', '/leaves', '/sports-dashboard', '/sports-booking', '/hall-booking',
    '/placements', '/analytics', '/fines', '/events', '/room-requests', '/audit-logs', '/alumni',
  ],
  chef: [
      ...COMMON_PATHS,
      '/meals',
      '/attendance',
      '/complaints',
      '/sports-booking',
  ],
  head_chef: [
      ...COMMON_PATHS,
      '/meals',
      '/attendance',
      '/complaints',
      '/analytics',
      '/sports-booking',
  ],
  gate_security: [
      ...COMMON_PATHS,
      '/gate-passes',
      '/gate-scans',
      '/visitors',
      '/fines',
      '/sports-booking',
  ],
  security_head: [
      ...COMMON_PATHS,
      '/gate-passes',
      '/gate-scans',
      '/reports',
      '/metrics',
      '/visitors',
      '/fines',
      '/analytics',
      '/sports-booking',
  ],
  hr: [
    ...COMMON_PATHS,
    '/rooms', '/complaints', '/reports', '/tenants', '/attendance', '/placements', '/room-requests',
    '/fines', '/sports-booking',
  ],
  pd: [
    ...COMMON_PATHS,
    '/events', '/sports-booking', '/sports-dashboard', '/hall-booking',
    '/placements', '/fines',
  ],
  pt: [
    ...COMMON_PATHS,
    '/events',
    '/sports-booking',
    '/sports-dashboard',
    '/fines',
  ],
  principal: [
    ...COMMON_PATHS,
    '/reports', '/metrics', '/analytics', '/hall-booking', '/fines', '/placements',
    '/events', '/sports-booking',
  ],
  director: [
    ...COMMON_PATHS,
    '/reports',
    '/hall-booking',
    '/sports-booking',
  ],
  hod: [
    ...COMMON_PATHS,
    '/events',
    '/hall-booking',
    '/fines',
    '/sports-booking',
  ],
  incharge: [
    ...COMMON_PATHS,
    '/rooms',
    '/sports-booking',
    '/gate-passes',
  ],
}

const DAY_SCHOLAR_RESTRICTED_PATHS = [
  '/rooms',
  '/meals',
  '/gate-passes',
  '/leaves',
  '/visitors',
  '/room-mapping',
  '/room-requests'
]

export function getRoleHome(role?: string | null) {
  if (!role) return '/dashboard'
  const normalized = role.toLowerCase() as Role
  return ROLE_HOME[normalized] ?? '/dashboard'
}

export function canAccessPath(
  role: string | null | undefined, 
  path: string, 
  studentType?: string | null,
  isStudentHR?: boolean | null,
) {
  // If no role but path is common, allow (prevents flash on refresh)
  const isCommon = COMMON_PATHS.some(cp => path === cp || path.startsWith(`${cp}/`))
  if (isCommon) return true

  if (!role) return false
  const normalized = role.toLowerCase() as Role

  if (normalized === 'student' && isStudentHR) {
    if (path === '/room-mapping' || path.startsWith('/room-mapping/')) {
      return true
    }
  }

  // Student Type Restrictions (Day Scholar vs Hosteller)
  if (normalized === 'student' && studentType === 'day_scholar') {
    if (DAY_SCHOLAR_RESTRICTED_PATHS.some(p => path === p || path.startsWith(`${p}/`))) {
      return false
    }
  }

  const allowed = ROLE_ALLOWED_PATHS[normalized]
  if (!allowed) return false

  if (path === '/' || path === '') return true

  return allowed.some((route) => path === route || path.startsWith(`${route}/`))
}
