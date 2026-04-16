import type { RBACPermissions } from '@/types'
import { canAccessPath } from '@/lib/rbac'
import { CAPABILITIES, type Capability } from '@/core/permissions/capabilities'
import { getRoleCapabilities } from '@/core/permissions/roleCapabilities'

type LegacyContext = {
  role?: string | null
  permissions?: RBACPermissions | null
  studentType?: 'hosteller' | 'day_scholar'
  isStudentHr?: boolean
}

const pathCapabilities: Array<{ path: string; capabilities: readonly Capability[] }> = [
  {
    path: '/gate-passes',
    capabilities: [
      CAPABILITIES.gatePass.view,
      CAPABILITIES.gatePass.create,
      CAPABILITIES.gatePass.review,
      CAPABILITIES.gatePass.approve,
      CAPABILITIES.gatePass.reject,
      CAPABILITIES.gatePass.scan,
      CAPABILITIES.gatePass.verify,
    ],
  },
  {
    path: '/rooms',
    capabilities: [
      CAPABILITIES.room.view,
      CAPABILITIES.room.allocate,
      CAPABILITIES.room.deallocate,
      CAPABILITIES.room.assign,
    ],
  },
  {
    path: '/room-mapping',
    capabilities: [CAPABILITIES.room.map],
  },
  {
    path: '/room-requests',
    capabilities: [CAPABILITIES.room.requestChange, CAPABILITIES.room.manageRequests],
  },
  {
    path: '/attendance',
    capabilities: [
      CAPABILITIES.attendance.view,
      CAPABILITIES.attendance.mark,
      CAPABILITIES.attendance.markBulk,
      CAPABILITIES.attendance.export,
      CAPABILITIES.attendance.reviewDefaulters,
    ],
  },
  {
    path: '/complaints',
    capabilities: [
      CAPABILITIES.complaint.create,
      CAPABILITIES.complaint.view,
      CAPABILITIES.complaint.review,
      CAPABILITIES.complaint.resolve,
      CAPABILITIES.complaint.escalate,
      CAPABILITIES.complaint.analytics,
    ],
  },
  {
    path: '/leaves',
    capabilities: [
      CAPABILITIES.leave.create,
      CAPABILITIES.leave.view,
      CAPABILITIES.leave.review,
      CAPABILITIES.leave.approve,
      CAPABILITIES.leave.reject,
      CAPABILITIES.leave.cancel,
    ],
  },
  {
    path: '/visitors',
    capabilities: [
      CAPABILITIES.visitor.create,
      CAPABILITIES.visitor.preregister,
      CAPABILITIES.visitor.view,
      CAPABILITIES.visitor.checkIn,
      CAPABILITIES.visitor.checkOut,
      CAPABILITIES.visitor.review,
    ],
  },
  {
    path: '/notices',
    capabilities: [CAPABILITIES.communication.noticeView, CAPABILITIES.communication.noticeManage],
  },
  {
    path: '/messages',
    capabilities: [
      CAPABILITIES.communication.messageView,
      CAPABILITIES.communication.messageSend,
      CAPABILITIES.communication.messageModerate,
    ],
  },
  {
    path: '/reports',
    capabilities: [CAPABILITIES.report.view, CAPABILITIES.report.export],
  },
  {
    path: '/metrics',
    capabilities: [CAPABILITIES.report.metricsView],
  },
  {
    path: '/analytics',
    capabilities: [CAPABILITIES.report.analyticsView],
  },
  {
    path: '/audit-logs',
    capabilities: [CAPABILITIES.report.auditView],
  },
]

const moduleCapabilityMap: Record<string, readonly Capability[]> = {
  gate_pass: Object.values(CAPABILITIES.gatePass),
  gatepass: Object.values(CAPABILITIES.gatePass),
  rooms: Object.values(CAPABILITIES.room),
  room: Object.values(CAPABILITIES.room),
  attendance: Object.values(CAPABILITIES.attendance),
  complaints: Object.values(CAPABILITIES.complaint),
  complaint: Object.values(CAPABILITIES.complaint),
  leaves: Object.values(CAPABILITIES.leave),
  leave: Object.values(CAPABILITIES.leave),
  visitors: Object.values(CAPABILITIES.visitor),
  visitor: Object.values(CAPABILITIES.visitor),
  notices: [CAPABILITIES.communication.noticeView, CAPABILITIES.communication.noticeManage],
  messages: [
    CAPABILITIES.communication.messageView,
    CAPABILITIES.communication.messageSend,
    CAPABILITIES.communication.messageModerate,
  ],
  reports: [CAPABILITIES.report.view, CAPABILITIES.report.export],
  metrics: [CAPABILITIES.report.metricsView],
  analytics: [CAPABILITIES.report.analyticsView],
  audit_logs: [CAPABILITIES.report.auditView],
}

export const deriveLegacyCapabilities = ({
  role,
  permissions,
  studentType,
  isStudentHr,
}: LegacyContext): Capability[] => {
  const capabilities = new Set<Capability>(getRoleCapabilities(role))

  if (permissions?.modules) {
    Object.entries(permissions.modules).forEach(([moduleName, moduleEntry]) => {
      const mapped = moduleCapabilityMap[moduleName]
      if (!mapped) return

      mapped.forEach((capability) => capabilities.add(capability))
      moduleEntry.capabilities.forEach((capability) => {
        capabilities.add(capability as Capability)
      })
    })
  }

  if (permissions?.allowed_paths?.length) {
    pathCapabilities.forEach(({ path, capabilities: mappedCapabilities }) => {
      const isAllowed = permissions.allowed_paths.some(
        (allowedPath) => path === allowedPath || path.startsWith(`${allowedPath}/`)
      )
      if (isAllowed) {
        mappedCapabilities.forEach((capability) => capabilities.add(capability))
      }
    })
  } else {
    pathCapabilities.forEach(({ path, capabilities: mappedCapabilities }) => {
      if (canAccessPath(role, path, studentType, isStudentHr)) {
        mappedCapabilities.forEach((capability) => capabilities.add(capability))
      }
    })
  }

  return Array.from(capabilities)
}

export const hasLegacyCapability = (capability: Capability, context: LegacyContext): boolean => {
  return deriveLegacyCapabilities(context).includes(capability)
}

export const hasAnyLegacyCapability = (checks: readonly Capability[], context: LegacyContext): boolean => {
  const available = new Set(deriveLegacyCapabilities(context))
  return checks.some((capability) => available.has(capability))
}

export const hasAllLegacyCapabilities = (checks: readonly Capability[], context: LegacyContext): boolean => {
  const available = new Set(deriveLegacyCapabilities(context))
  return checks.every((capability) => available.has(capability))
}
