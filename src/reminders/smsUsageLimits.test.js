import { describe, it, expect } from 'vitest'
import {
  estimateSmsSegments,
  canSendAutomatedSmsSegments,
  formatSmsUsageLabel,
  SMS_MONTHLY_SEGMENT_LIMIT,
  SMS_DAILY_SEGMENT_LIMIT,
  SMS_PER_APPOINTMENT_SEND_LIMIT,
} from './smsUsageLimits.js'

describe('sms usage limits', () => {
  it('estimates single-segment GSM bodies', () => {
    expect(estimateSmsSegments('Hi Jamie! Reminder for tomorrow at 2 PM.')).toBe(1)
  })

  it('enforces monthly, daily, and per-appointment caps', () => {
    expect(
      canSendAutomatedSmsSegments(
        { monthSegments: SMS_MONTHLY_SEGMENT_LIMIT - 1, daySegments: 0 },
        2,
      ).reason,
    ).toBe('monthly_limit')

    expect(
      canSendAutomatedSmsSegments(
        { monthSegments: 0, daySegments: SMS_DAILY_SEGMENT_LIMIT },
        1,
      ).reason,
    ).toBe('daily_limit')

    expect(
      canSendAutomatedSmsSegments(
        { monthSegments: 0, daySegments: 0 },
        1,
        { appointmentAutomatedSmsSends: SMS_PER_APPOINTMENT_SEND_LIMIT },
      ).reason,
    ).toBe('per_appointment_limit')

    expect(
      canSendAutomatedSmsSegments({ monthSegments: 10, daySegments: 2 }, 1).ok,
    ).toBe(true)
  })

  it('formats usage for Settings', () => {
    expect(formatSmsUsageLabel({ monthSegments: 12 })).toBe(
      `12 / ${SMS_MONTHLY_SEGMENT_LIMIT} segments`,
    )
  })
})
