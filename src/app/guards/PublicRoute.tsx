import { Navigate } from 'react-router-dom'
import { getRoleHome } from '@/lib/rbac'
import type { User } from '@/types'

export function PublicRoute({
  children,
  isSessionVerified,
  isAuthenticated,
  user,
}: {
  children: React.ReactNode
  isSessionVerified: boolean
  isAuthenticated: boolean
  user: User | null
}) {
  if (!isSessionVerified) {
    return null
  }

  return !isAuthenticated ? <>{children}</> : <Navigate to={getRoleHome(user?.role)} replace />
}
