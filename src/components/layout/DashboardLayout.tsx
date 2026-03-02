import { Outlet } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomNav from './BottomNav'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useNotification, useRealtimeQuery } from '@/hooks/useWebSocket'
import { useRoutePrefetch } from '@/hooks/useRoutePrefetch'
import ErrorBoundary from '@/components/ErrorBoundary'
import { InstallPrompt } from '@/components/InstallPrompt'

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { prefetchDashboard, prefetchRooms, prefetchGatePasses, prefetchAttendance } = useRoutePrefetch()

  // Prefetch common pages on layout mount
  useEffect(() => {
    prefetchDashboard()
    
    // Request Notification Permissions on First Authenticated Load
    if ('Notification' in window && Notification.permission === 'default') {
      // Small timeout to not block rendering instantly
      setTimeout(() => {
        Notification.requestPermission().catch(console.error);
      }, 2000);
    }
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

  const processedNotifications = useRef<Set<string>>(new Set());

  // Keep in-app notifications fresh across the whole app with deduplication.
  useNotification('notification', (payload: any) => {
    // Deduplication logic using id or composite key
    const uniqueKey = payload?.id ? String(payload.id) : (payload?.title + payload?.message);
    if (processedNotifications.current.has(uniqueKey)) return;
    processedNotifications.current.add(uniqueKey);
    
    // Clear old entries (keep last 50)
    if (processedNotifications.current.size > 50) {
      const firstKey = processedNotifications.current.values().next().value;
      if (firstKey) processedNotifications.current.delete(firstKey);
    }

    if (payload?.title) {
      toast(payload.title, {
        description: payload.message,
        action: payload.action_url ? {
          label: 'View',
          onClick: () => navigate(payload.action_url)
        } : undefined,
      })
    }
    
    // Update local store via invalidation (background)
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
      <div className="lg:pl-64 flex flex-col min-h-screen relative">
        {/* Header - Sticky on all devices */}
        <Header setSidebarOpen={setSidebarOpen} />
        
        {/* Main content - Mobile optimized */}
        <main className="flex-1 flex flex-col pt-2 sm:pt-4 md:pt-0">
          {/* Responsive padding and container */}
          <div className="flex-1">
            <div className="w-full h-full">
              {/* Mobile: full width with proper spacing - optimized */}
              <div className="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 lg:px-10 lg:py-8 mx-auto w-full max-w-[1600px]">
                {/* Content Container */}
                <div className="pb-24 sm:pb-32 md:pb-12 lg:pb-12">
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
