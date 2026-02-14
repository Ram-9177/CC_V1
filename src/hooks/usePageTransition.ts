import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Hook to handle page transition animations
 * Smooths out the loading experience
 */
export const usePageTransition = () => {
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsLoading(true)
    
    // Simulate loading completion after a minimal delay
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 100)

    return () => clearTimeout(timer)
  }, [location.pathname])

  return { isLoading }
}

/**
 * Hook to delay showing loading spinner
 * Avoids flashy loading state for fast transitions
 */
export const useDelayedLoading = (show: boolean, delay: number = 300) => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!show) {
      setVisible(false)
      return
    }

    const timer = setTimeout(() => {
      setVisible(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [show, delay])

  return visible
}

/**
 * Hook to detect route changes and prefetch data
 */
export const useRouteChange = (callback: () => void) => {
  const location = useLocation()

  useEffect(() => {
    callback()
  }, [location.pathname, callback])
}
