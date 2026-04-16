import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'

export function ProtectedRoute({
  children,
  isSessionVerified,
}: {
  children: React.ReactNode
  isSessionVerified: boolean
}) {
  const { isAuthenticated } = useAuthStore()

  if (!isSessionVerified) {
    return null
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}
