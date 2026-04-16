type QueryParam = string | number | boolean | null | undefined

type QueryParamsRecord = Record<string, QueryParam>

export const queryKeys = {
  profile: {
    all: () => ['profile'] as const,
  },

  myPermissions: {
    all: () => ['my-permissions'] as const,
    byUser: (userId?: number | null) => ['my-permissions', userId] as const,
  },

  gatePasses: {
    all: () => ['gate-passes'] as const,
    lists: () => ['gate-passes'] as const,
    list: (params?: { status?: string; hall_ticket?: string; page?: number }) =>
      ['gate-passes', params?.status || 'all', params?.hall_ticket || '', params?.page ?? 1] as const,
    detail: (id?: string | number | null) => ['gate-passes', 'detail', id] as const,
    student: (studentId?: number | null) => ['gate-passes', 'student', studentId] as const,
    active: () => ['gate-passes', 'active'] as const,
    lastScan: () => ['gate-passes', 'last-scan'] as const,
  },

  rooms: {
    all: () => ['rooms'] as const,
    list: (filters?: { floor?: string; type?: string; status?: string }) =>
      ['rooms', filters?.floor || 'all', filters?.type || 'all', filters?.status || 'all'] as const,
    myActiveAllocation: () => ['rooms', 'my-active-allocation'] as const,
    buildings: (collegeId?: string | number) =>
      collegeId === undefined ? (['buildings'] as const) : (['buildings', collegeId] as const),
  },

  attendance: {
    all: () => ['attendance'] as const,
    records: (date?: string) => ['attendance', 'records', date] as const,
    stats: () => ['attendance', 'stats'] as const,
    monthly: (year?: number, month?: number) => ['attendance', 'monthly', year, month] as const,
    defaultersRoot: () => ['attendance', 'defaulters'] as const,
    defaulters: (daysAbsent = 5) => ['attendance', 'defaulters', daysAbsent] as const,
    today: () => ['attendance', 'today'] as const,
    student: (studentId?: number | null) => ['attendance', 'student', studentId] as const,
    paginated: (page = 1, pageSize = 20) => ['attendance', 'paginated', page, pageSize] as const,
  },

  complaints: {
    all: () => ['complaints'] as const,
    list: (params?: QueryParamsRecord) => ['complaints', 'list', params] as const,
    detail: (id?: string | number | null) => ['complaints', 'detail', id] as const,
    analytics: () => ['complaints', 'analytics'] as const,
  },

  visitors: {
    all: () => ['visitors'] as const,
    list: (scope: 'student' | 'management') => ['visitors', scope] as const,
    preRegistrations: () => ['visitors', 'pre-registrations'] as const,
  },

  leaves: {
    all: () => ['leaves'] as const,
    list: (tab: string) => ['leaves', tab] as const,
    stats: () => ['leave-stats'] as const,
  },

  notifications: {
    all: () => ['notifications'] as const,
    list: () => ['notifications'] as const,
    unread: () => ['notifications', 'unread'] as const,
    unreadCount: () => ['notifications-unread-count'] as const,
    preferences: () => ['notification-preferences'] as const,
  },

  dashboard: {
    all: () => ['dashboard'] as const,
    statsRoot: () => ['dashboard-stats'] as const,
    stats: (selectedCollege?: string | null) => ['dashboard-stats', selectedCollege] as const,
    recentActivitiesRoot: () => ['recent-activities'] as const,
    recentActivities: (selectedCollege?: string | null) => ['recent-activities', selectedCollege] as const,
  },
} as const

export type QueryKeys = typeof queryKeys
