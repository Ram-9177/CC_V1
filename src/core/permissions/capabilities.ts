export const CAPABILITIES = {
  gatePass: {
    create: 'gate_pass.create',
    review: 'gate_pass.review',
    approve: 'gate_pass.approve',
    reject: 'gate_pass.reject',
    scan: 'gate_pass.scan',
    verify: 'gate_pass.verify',
    view: 'gate_pass.view',
  },
  room: {
    view: 'room.view',
    allocate: 'room.allocate',
    deallocate: 'room.deallocate',
    assign: 'room.assign',
    map: 'room.map',
    requestChange: 'room.request_change',
    manageRequests: 'room.manage_requests',
  },
  attendance: {
    view: 'attendance.view',
    mark: 'attendance.mark',
    markBulk: 'attendance.mark_bulk',
    export: 'attendance.export',
    reviewDefaulters: 'attendance.review_defaulters',
  },
  complaint: {
    create: 'complaint.create',
    view: 'complaint.view',
    review: 'complaint.review',
    resolve: 'complaint.resolve',
    escalate: 'complaint.escalate',
    analytics: 'complaint.analytics',
  },
  leave: {
    create: 'leave.create',
    view: 'leave.view',
    review: 'leave.review',
    approve: 'leave.approve',
    reject: 'leave.reject',
    cancel: 'leave.cancel',
  },
  visitor: {
    create: 'visitor.create',
    preregister: 'visitor.preregister',
    view: 'visitor.view',
    checkIn: 'visitor.check_in',
    checkOut: 'visitor.check_out',
    review: 'visitor.review',
  },
  communication: {
    noticeView: 'communication.notice.view',
    noticeManage: 'communication.notice.manage',
    messageView: 'communication.message.view',
    messageSend: 'communication.message.send',
    messageModerate: 'communication.message.moderate',
  },
  report: {
    view: 'report.view',
    export: 'report.export',
    metricsView: 'report.metrics.view',
    analyticsView: 'report.analytics.view',
    auditView: 'report.audit.view',
  },
} as const

export type CapabilityGroup = keyof typeof CAPABILITIES

type NestedCapabilityValues<T> = T extends string
  ? T
  : T extends Record<string, unknown>
    ? { [K in keyof T]: NestedCapabilityValues<T[K]> }[keyof T]
    : never

export type Capability = NestedCapabilityValues<typeof CAPABILITIES>

export const ALL_CAPABILITIES: Capability[] = Object.values(CAPABILITIES)
  .flatMap((group) => Object.values(group)) as Capability[]

export const CAPABILITY_GROUPS = {
  gatePass: Object.values(CAPABILITIES.gatePass),
  room: Object.values(CAPABILITIES.room),
  attendance: Object.values(CAPABILITIES.attendance),
  complaint: Object.values(CAPABILITIES.complaint),
  leave: Object.values(CAPABILITIES.leave),
  visitor: Object.values(CAPABILITIES.visitor),
  communication: Object.values(CAPABILITIES.communication),
  report: Object.values(CAPABILITIES.report),
} as const satisfies Record<CapabilityGroup, readonly Capability[]>
