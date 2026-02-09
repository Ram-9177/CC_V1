import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomNav from './BottomNav'
import { useNotification, useRealtimeQuery } from '@/hooks/useWebSocket'

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const queryClient = useQueryClient()

  // Keep in-app notifications fresh across the whole app.
  useNotification('notification', () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
    queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
  })
  // Used for bulk-created notifications (e.g. meals) which don't fire per-row signals.
  useRealtimeQuery('notifications_updated', ['notifications', 'notifications-unread-count'])

  return (
    <div className="min-h-screen bg-white">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="lg:pl-64">
        <Header setSidebarOpen={setSidebarOpen} />
        <main className="py-6 px-4 sm:px-6 lg:px-8 pb-24 lg:pb-8 bg-white">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
