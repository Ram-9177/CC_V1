export type Role = 'student' | 'staff' | 'admin'

export const ROLE_HOME: Record<Role, string> = {
  student: '/dashboard',
  staff: '/dashboard',
  admin: '/dashboard',
}

const ROLE_ALLOWED_PATHS: Record<Role, string[]> = {
  student: [
    '/dashboard',
    '/gate-passes',
    '/attendance',
    '/meals',
    '/notices',
    '/events',
    '/notifications',
    '/messages',
    '/profile',
  ],
  staff: [
    '/dashboard',
    '/rooms',
    '/gate-passes',
    '/attendance',
    '/meals',
    '/notices',
    '/events',
    '/notifications',
    '/messages',
    '/gate-scans',
    '/tenants',
    '/profile',
  ],
  admin: [
    '/dashboard',
    '/rooms',
    '/gate-passes',
    '/attendance',
    '/meals',
    '/notices',
    '/events',
    '/notifications',
    '/messages',
    '/gate-scans',
    '/colleges',
    '/tenants',
    '/metrics',
    '/reports',
    '/profile',
  ],
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
