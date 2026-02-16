import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

/**
 * Hook to enforce online-only access until logout
 * Users must stay online unless they explicitly logout
 */
export function useOfflineProtection() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [offlineStartTime, setOfflineStartTime] = useState<number | null>(null)
  const OFFLINE_TIMEOUT = 30 * 60 * 1000 // 30 minutes timeout

  useEffect(() => {
    if (!user) return // Only protect authenticated users

    const handleOnline = () => {
      setIsOnline(true)
      setOfflineStartTime(null)
      toast.success('Back online')
    }

    const handleOffline = () => {
      setIsOnline(false)
      setOfflineStartTime(Date.now())
      toast.warning('You are now offline. Please go online to continue.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [user])

  // Check offline timeout
  useEffect(() => {
    if (!offlineStartTime || !user) return

    const timer = setTimeout(() => {
      if (!navigator.onLine) {
        toast.error('Session timeout: You have been offline for too long. Please log in again.')
        logout()
        navigate('/login')
      }
    }, OFFLINE_TIMEOUT)

    return () => clearTimeout(timer)
  }, [offlineStartTime, user, logout, navigate])

  return {
    isOnline,
    offlineStartTime,
    timeoutMs: OFFLINE_TIMEOUT,
  }
}
