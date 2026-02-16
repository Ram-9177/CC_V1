import { Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomNav from './BottomNav'
import { useNotification, useRealtimeQuery } from '@/hooks/useWebSocket'
import { useRoutePrefetch } from '@/hooks/useRoutePrefetch'
import ErrorBoundary from '@/components/ErrorBoundary'
import { InstallPrompt } from '@/components/InstallPrompt'

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const queryClient = useQueryClient()
  const { prefetchDashboard, prefetchRooms, prefetchGatePasses, prefetchAttendance } = useRoutePrefetch()

  // Prefetch common pages on layout mount
  useEffect(() => {
    prefetchDashboard()
  }, [])

  // Setup link prefetch on hover
  useEffect(() => {
    const handleMouseEnter = (e: MouseEvent) => {
      const target = e.target as HTMLAnchorElement
      if (!target.href) return

      const pathname = new URL(target.href).pathname
      
      // Prefetch based on route
      if (pathname.includes('rooms')) {
        prefetchRooms()
      } else if (pathname.includes('gate-passes')) {
        prefetchGatePasses()
      } else if (pathname.includes('attendance')) {
        prefetchAttendance()
      }
    }

    document.addEventListener('mouseenter', handleMouseEnter, true)
    return () => document.removeEventListener('mouseenter', handleMouseEnter, true)
  }, [prefetchRooms, prefetchGatePasses, prefetchAttendance])

  // Keep in-app notifications fresh across the whole app.
  useNotification('notification', () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
    queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
  })
  // Used for bulk-created notifications (e.g. meals) which don't fire per-row signals.
  useRealtimeQuery('notifications_updated', ['notifications', 'notifications-unread-count'])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Desktop Sidebar */}
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      
      {/* Main content area */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Header - Sticky on all devices */}
        <Header setSidebarOpen={setSidebarOpen} />
        
        {/* Main content - Mobile optimized */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Responsive padding and container */}
          <div className="flex-1 overflow-y-auto">
            <div className="w-full h-full">
              {/* Mobile: full width with proper spacing */}
              <div className="p-2 sm:p-4 md:p-6 lg:px-8 mx-auto w-full max-w-7xl">
                {/* Add bottom padding for mobile bottom nav */}
                <div className="pb-20 sm:pb-24 md:pb-8 lg:pb-8">
                  <ErrorBoundary>
                    <Outlet />
                  </ErrorBoundary>
                </div>
              </div>
            </div>
          </div>
        </main>
        

        {/* Mobile Bottom Navigation */}
        <BottomNav />
      </div>
      
      {/* PWA Install Prompt */}
      <InstallPrompt />
    </div>
  )
}
