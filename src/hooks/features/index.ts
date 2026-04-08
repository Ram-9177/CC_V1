/**
 * Feature Hooks Index
 * Centralized exports for all feature-specific hooks
 */

// Attendance
export * from './useAttendance'

// Gate Passes & Security
export * from './useGatePasses'

// Rooms & Allocation
export * from './useRooms'

// Meals
export {
  useMealsList,
  useMealsByDate,
  useMealForecast,
  useMealAttendance,
  useMealPreferences,
  useMealSpecialRequests,
  useMealFeedback,
  useMealFeedbackStats,
  useMarkMealAttendance,
  useUpdateMealPreferences,
  useAddMealFeedback,
  useDeleteSpecialRequest,
  useApproveSpecialRequest,
  useRejectSpecialRequest,
  useDeliverSpecialRequest,
  useResolveMealFeedback,
} from './useMeals'

// Events
export {
  useEventsByFilter,
  useEventsList,
  useUpcomingEvents,
  usePastEvents,
  useEventRegistrations,
  useSportsCourts,
  useRegisterEvent,
  useCreateEvent,
  useMarkEventAttendance,
} from './useEvents'

// Notices
export {
  useNoticesList,
  useUrgentNotices,
  usePinnedNotices,
  useCreateNotice,
  useDeleteNotice,
} from './useNotices'

// Complaints
export {
  useComplaintsList,
  useComplaintDetail,
  useCreateComplaint,
  useUpdateComplaintStatus,
  useEscalateComplaint,
  useComplaintFeedback,
  useComplaintAnalytics,
} from './useComplaints'

// Messages
export {
  useMessagesList,
  useBroadcasts,
  useSendMessage,
  useMarkMessageAsRead,
  useMessageThreads,
} from './useMessages'

// Notifications
export {
  useNotificationsList,
  useUnreadNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useClearAllNotifications,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from './useNotifications'

// Reports
export {
  useAttendanceReport,
  useOccupancyReport,
  useGatePassReport,
  useExportReport,
} from './useReports'

// User Management
export {
  useColleges,
  useTenantsList,
  useStaffUsersList,
  useBulkUploadTenants,
  useApproveUser,
  useDeleteUser,
} from './useUsers'

// Admin Features
export {
  useMetrics,
  useHealthStatus,
  useSystemSettings,
  useUpdateSystemSettings,
} from './useAdmin'
