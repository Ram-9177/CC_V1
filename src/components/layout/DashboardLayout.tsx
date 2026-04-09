import { safeLazy } from "@/lib/safeLazy";

import { Link, Outlet, useLocation } from 'react-router-dom'
import { Suspense, useState, useEffect, useRef, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Home, Sparkles, X } from 'lucide-react'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomNav from './BottomNav'
import { toast } from 'sonner'
import { useRealtimeQuery } from '@/hooks/useWebSocket'
import { useRoutePrefetch } from '@/hooks/useRoutePrefetch'
import ErrorBoundary from '@/components/ErrorBoundary'
import { CommandPalette } from '@/components/common/CommandPalette'
import { useUIStore } from '@/lib/ui-store'
import { PageSkeleton } from '@/components/common/PageSkeleton'
import { bridgeWebSocketToEventBus, useEventBus } from '@/lib/event-bus'
import { updatesWS } from '@/lib/websocket'
import { useRealtimeNotificationSync } from '@/hooks/useWebSocket'
import { useNotificationStore } from '@/lib/notification-store'
import { perfMark, perfMeasure } from '@/lib/perf'
import { getNetworkProfile } from '@/lib/networkProfile'

const InstallPrompt = safeLazy(() => import('@/components/InstallPrompt').then(m => ({ default: m.InstallPrompt })))
const MealNotificationManager = safeLazy(() => import('@/components/dashboard/MealNotificationManager').then(m => ({ default: m.MealNotificationManager })))
const DigitalIDDialog = safeLazy(() => import('@/components/profile/DigitalIDDialog').then(m => ({ default: m.DigitalIDDialog })))

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showOnboardingHint, setShowOnboardingHint] = useState(false)
  const location = useLocation()
  const queryClient = useQueryClient()
  const { prefetchDashboard, prefetchRooms, prefetchGatePasses, prefetchAttendance } = useRoutePrefetch()
  const incrementUnread = useNotificationStore(s => s.incrementUnread)
  const networkProfile = useMemo(() => getNetworkProfile(), [])

  const isDigitalIDOpen = useUIStore(s => s.isDigitalIDOpen)
  const setDigitalIDOpen = useUIStore(s => s.setDigitalIDOpen)

  useRealtimeNotificationSync()

  // Bootstrap the typed EventBus bridge — runs once per authenticated session
  useEffect(() => {
    bridgeWebSocketToEventBus(updatesWS)
  }, [])

  // Prefetch common pages on layout mount
  useEffect(() => {
    prefetchDashboard()
  }, [])

  // Setup link prefetch on hover
  useEffect(() => {
    if (networkProfile.tier === '2g' || networkProfile.saveData) return
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
  }, [prefetchRooms, prefetchGatePasses, prefetchAttendance, networkProfile.saveData, networkProfile.tier])

  const processedNotifications = useRef<Set<string>>(new Set());

  // Typed EventBus notification handler — replaces direct WS subscription
  useEventBus('notification.new', (payload) => {
    const uniqueKey = String(payload.id)
    if (processedNotifications.current.has(uniqueKey)) return
    processedNotifications.current.add(uniqueKey)
    if (processedNotifications.current.size > 50) {
      const first = processedNotifications.current.values().next().value
      if (first) processedNotifications.current.delete(first)
    }
    toast(payload.title, { description: payload.body })
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  })

  // Unread count delta — patch store directly, zero DB queries
  useEventBus('notification_unread_increment', (e) => {
    incrementUnread(e.delta)
  })

  // Bulk notification updates (e.g. meal broadcast)
  useRealtimeQuery('notifications_updated', ['notifications', 'notifications-unread-count'])

  const routeLabelMap = useMemo<Record<string, string>>(() => ({
    dashboard: 'Dashboard',
    rooms: 'Rooms',
    'room-mapping': 'Room Mapping',
    'room-requests': 'Room Requests',
    'gate-passes': 'Gate Passes',
    'gate-scans': 'Gate Scans',
    attendance: 'Attendance',
    meals: 'Meals',
    notices: 'Notices',
    events: 'Events',
    messages: 'Messages',
    notifications: 'Notifications',
    complaints: 'Complaints',
    visitors: 'Visitors',
    fines: 'Fines',
    colleges: 'Colleges',
    tenants: 'User Management',
    profile: 'Profile',
    reports: 'Reports',
    metrics: 'Metrics',
    'audit-logs': 'Audit Logs',
    'sports-dashboard': 'Sports Dashboard',
    'sports-booking': 'Sports Booking',
    'hall-booking': 'Hall Booking',
    leaves: 'Leaves',
    placements: 'Placements',
    analytics: 'Analytics',
    resume: 'Resume Builder',
    'digital-id': 'Digital ID',
  }), [])

  const breadcrumbs = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean)
    const crumbs: Array<{ label: string; path: string }> = []
    let currentPath = ''

    for (const segment of segments) {
      currentPath += `/${segment}`
      crumbs.push({
        label: routeLabelMap[segment] ?? segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        path: currentPath,
      })
    }

    if (crumbs.length > 0 && crumbs[0].path !== '/dashboard') {
      crumbs.unshift({ label: 'Dashboard', path: '/dashboard' })
    }

    return crumbs
  }, [location.pathname, routeLabelMap])

  const onboardingTips = useMemo<Record<string, string>>(() => ({
    '/dashboard': 'Use the command palette for quick navigation and actions across modules. Keyboard shortcut: Cmd/Ctrl + K.',
    '/gate-passes': 'Start in Overview for lifecycle status, then use Pass History for full records.',
    '/room-mapping': 'Select a block first, then click a bed to allocate, move, or vacate students.',
    '/tenants': 'Filter by college and status before bulk actions to avoid accidental edits.',
    '/complaints': 'Prioritize pending complaints and escalate only after adding clear remarks.',
  }), [])

  const onboardingKey = `onboarding:hint:${location.pathname}`
  const onboardingTip = onboardingTips[location.pathname]

  useEffect(() => {
    const start = `route:${location.pathname}:start`
    const end = `route:${location.pathname}:painted`
    perfMark(start)
    queueMicrotask(() => {
      perfMark(end)
      perfMeasure('route:paint', start, end, { path: location.pathname })
    })
  }, [location.pathname])

  useEffect(() => {
    if (!onboardingTip) {
      setShowOnboardingHint(false)
      return
    }
    setShowOnboardingHint(localStorage.getItem(onboardingKey) !== 'dismissed')
  }, [onboardingTip, onboardingKey])

  const dismissOnboardingHint = () => {
    localStorage.setItem(onboardingKey, 'dismissed')
    setShowOnboardingHint(false)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      {/* Desktop Sidebar */}
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      
      {/* Main content area */}
      <div className="lg:pl-[19rem] flex flex-col min-h-screen relative overflow-x-hidden lg:pr-3 lg:py-3">
        <div className="flex flex-col min-h-screen bg-background lg:rounded-lg overflow-hidden">
          {/* Header - Sticky on all devices */}
          <Header setSidebarOpen={setSidebarOpen} />
          
          {/* Main content - Mobile optimized */}
          <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col pt-2 sm:pt-4 md:pt-0 overflow-x-hidden">
            {/* Unified Global Navigation */}
            <CommandPalette />
            
            {/* Responsive padding and container */}
            <div className="flex-1">
              <div className="w-full h-full">
                {/* Global shell: enforces uniform alignment across all SaaS pages */}
                <div className="layout-container py-2 sm:py-3 md:py-4 lg:py-6">
                  {breadcrumbs.length > 0 && (
                    <nav className="page-breadcrumb-rail" aria-label="Breadcrumb">
                      <Link to="/dashboard" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                        <Home className="h-4 w-4" />
                      </Link>
                      {breadcrumbs.map((crumb, index) => {
                        const isLast = index === breadcrumbs.length - 1
                        return (
                          <div key={crumb.path} className="flex items-center gap-1">
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                            {isLast ? (
                              <span className="font-semibold text-foreground">{crumb.label}</span>
                            ) : (
                              <Link to={crumb.path} className="font-medium text-muted-foreground hover:text-primary transition-colors">
                                {crumb.label}
                              </Link>
                            )}
                          </div>
                        )
                      })}
                    </nav>
                  )}

                  {showOnboardingHint && onboardingTip && (
                    <div className="mb-3 sm:mb-4 surface-muted px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-primary">
                            <Sparkles className="h-3.5 w-3.5" />
                            First Time Here?
                          </p>
                          <p className="text-sm font-medium text-foreground/90">{onboardingTip}</p>
                        </div>
                        <button
                          type="button"
                          onClick={dismissOnboardingHint}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                          aria-label="Dismiss onboarding tip"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Content Container */}
                  <div className="saas-page-shell pb-32 sm:pb-36 md:pb-12 lg:pb-12">
                    <ErrorBoundary>
                      <Suspense fallback={<PageSkeleton variant="dashboard" />}>
                        <Outlet />
                      </Suspense>
                    </ErrorBoundary>
                  </div>
                </div>
              </div>
            </div>
          </main>
          

          {/* Mobile Bottom Navigation */}
          <BottomNav 
            onOpenSidebar={() => setSidebarOpen(true)} 
            isSidebarOpen={sidebarOpen}
          />
        </div>
      </div>
      
      {/* PWA Install Prompt */}
      <ErrorBoundary>
        <Suspense fallback={<div className="h-4 w-12 bg-muted animate-pulse rounded"></div>}>
          <InstallPrompt />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary>
        <Suspense fallback={<div className="h-4 w-12 bg-muted animate-pulse rounded"></div>}>
          <MealNotificationManager />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary>
        <Suspense fallback={<div className="h-4 w-12 bg-muted animate-pulse rounded"></div>}>
          {/* Global Digital ID Modal */}
          <DigitalIDDialog 
            open={isDigitalIDOpen} 
            onOpenChange={setDigitalIDOpen} 
          />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
