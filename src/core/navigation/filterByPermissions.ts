import { canAccessPath } from '@/lib/rbac'
import type { RBACPermissions, SidebarCategory } from '@/types'

export type FilterNavigationInput = {
  categories: SidebarCategory[]
  role: string | null
  studentType?: 'hosteller' | 'day_scholar'
  isStudentHr?: boolean
  permissions?: RBACPermissions
}

export function filterByPermissions({
  categories,
  role,
  studentType,
  isStudentHr,
  permissions,
}: FilterNavigationInput): SidebarCategory[] {
  return categories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => {
        const isStudent = role === 'student'
        const isManagementItem = ['/rooms', '/room-mapping', '/tenants', '/colleges', '/metrics'].includes(item.href)
        const canUseStudentHrTools = isStudent && !!isStudentHr
        if (isStudent && isManagementItem && !(canUseStudentHrTools && item.href === '/room-mapping')) return false
        if (isStudent && item.href === '/sports-booking') return true

        if (permissions?.allowed_paths) {
          return permissions.allowed_paths.some(
            (ap) => item.href === ap || (item.href !== '/' && item.href.startsWith(`${ap}/`))
          )
        }

        return canAccessPath(role, item.href, studentType, isStudentHr)
      }),
    }))
    .filter((category) => category.items.length > 0)
}
