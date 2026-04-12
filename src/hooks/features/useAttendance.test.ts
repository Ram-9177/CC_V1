import { describe, expect, it } from 'vitest'

import { getAttendanceInfoMessage, getAttendancePolicyMessage } from '@/hooks/features/useAttendance'

describe('attendance feature policy helpers', () => {
  it('maps deallocated policy errors to user-facing messages', () => {
    const error = {
      response: {
        data: {
          code: 'STUDENT_DEALLOCATED',
        },
      },
    }

    expect(getAttendancePolicyMessage(error)).toBe(
      'Student is deallocated. Attendance is controlled by gate-pass outside status.'
    )
  })

  it('maps out-on-gate-pass deallocated success payload', () => {
    const payload = {
      code: 'STUDENT_OUT_DEALLOCATED',
      detail: 'Student is deallocated and currently outside on gate pass.',
    }

    expect(getAttendanceInfoMessage(payload)).toBe(
      'Student is deallocated and currently outside on gate pass.'
    )
  })

  it('returns null for unknown policy codes', () => {
    const error = {
      response: {
        data: {
          code: 'UNKNOWN_POLICY',
        },
      },
    }

    expect(getAttendancePolicyMessage(error)).toBeNull()
    expect(getAttendanceInfoMessage({ code: 'UNKNOWN_POLICY' })).toBeNull()
  })
})
