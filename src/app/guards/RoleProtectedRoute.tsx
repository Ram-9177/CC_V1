import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { canAccessPath, getRoleHome, COMMON_PATHS } from '@/lib/rbac'
import { useMyPermissions } from '@/hooks/useMyPermissions'

export function RoleProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const role = user?.role ?? null
  const { data: permissions } = useMyPermissions()

  let isAllowed: boolean
  if (permissions?.allowed_paths) {
    const p = location.pathname
    const isCommon = COMMON_PATHS.some((cp) => p === cp || p.startsWith(`${cp}/`))
    const isDynamic = permissions.allowed_paths.some((ap) => p === ap || p.startsWith(`${ap}/`))
    isAllowed = isCommon || isDynamic
  } else {
    isAllowed = canAccessPath(role, location.pathname, user?.student_type, user?.is_student_hr)
  }

  if (!isAllowed) {
    return <Navigate to={getRoleHome(role)} replace />
  }

  return <>{children}</>
}
