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
  useMealAttendance,
  useMarkMealAttendance,
  useMealPreferences,
  useUpdateMealPreferences,
  useAddMealFeedback,
  useMealForecast,
} from './useMeals'

// Events
export {
  useEventsList,
  useUpcomingEvents,
  usePastEvents,
  useRegisterEvent,
  useMarkEventAttendance,
} from './useEvents'

// Notices
export {
  useNoticesList,
  useUrgentNotices,
  usePinnedNotices,
} from './useNotices'

// Complaints
export {
  useComplaintsList,
  useStudentComplaints,
  useCreateComplaint,
  useUpdateComplaint,
  useResolveComplaint,
} from './useComplaints'

// Messages
export {
  useMessagesList,
  useSendMessage,
  useMarkMessageAsRead,
  useMessageThreads,
} from './useMessages'

// Notifications
export {
  useNotificationsList,
  useUnreadNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
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
  useUsersList,
  useStudentsList,
  useStaffList,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
} from './useUsers'

// Admin Features
export {
  useMetrics,
  useHealthStatus,
  useSystemSettings,
  useUpdateSystemSettings,
} from './useAdmin'
