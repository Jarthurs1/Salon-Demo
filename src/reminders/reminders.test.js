import { describe, it, expect } from 'vitest'
import { getSalonDate, getCalendarDaysUntilAppointment } from './salonTime.js'
import {
  getReminderType,
  isReminderEligible,
  applyReminderSentTimestamp,
  shouldStopReminders,
  REMINDER_TYPE_24H,
} from './reminderEligibility.js'
import {
  generateConfirmationToken,
  hashConfirmationToken,
  tokensMatch,
  buildConfirmationUrl,
} from './confirmationTokens.js'
import {
  confirmAppointmentByToken,
  processAppointmentActionByToken,
} from './confirmationLogic.js'
import {
  shouldInvalidateConfirmation,
  resetConfirmationForReschedule,
  applyRescheduleRequest,
  reminderSentField,
} from './appointmentConfirmationMeta.js'
import { ensureConfirmationToken } from './ensureConfirmationToken.js'
import { buildReminderEmail } from './reminderEmail.js'
import { getAppointmentStatusLabel } from '../utils/appointmentStatus.js'
import {
  normalizeReminderSettings,
  toggleReminderInterval,
  reminderSettingsAreValid,
  isSmsRemindersOperational,
} from './reminderSettings.js'
import { renderConfirmationPage } from './confirmationPage.js'
import { isIntervalChannelSent } from './appointmentConfirmationMeta.js'

const baseAppt = {
  id: 'appt-1',
  type: 'appointment',
  clientId: 'client-1',
  clientName: 'Jamie Lee',
  date: '2026-10-10',
  startTime: '14:00',
  durationMinutes: 60,
  service: 'Haircut',
  status: 'pending',
  notes: '',
}

const optedInClient = {
  id: 'client-1',
  firstName: 'Jamie',
  email: 'jamie@example.com',
  phone: '4045550199',
  smsConsent: { optedIn: true, optedInAt: '2026-10-01T00:00:00.000Z', optedOutAt: null, source: 'manual' },
}

const defaultSettings = { enabled: true, method: 'email', intervalsDays: [1] }
const allIntervals = { enabled: true, method: 'email', intervalsDays: [7, 2, 1] }
const smsLiveOpts = { smsOperational: true }
/** Midday America/New_York on the 1-day reminder date (before 14:00 appointment). */
const reminderNow = new Date('2026-10-09T16:00:00.000Z')
const dayOpts = { salonToday: '2026-10-09', now: reminderNow }

describe('salon calendar days', () => {
  it('formats salon date in America/New_York', () => {
    const d = getSalonDate(new Date('2026-03-08T11:30:00.000Z'))
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('computes calendar-day delta without elapsed-hour drift', () => {
    expect(getCalendarDaysUntilAppointment('2026-10-10', '2026-10-03')).toBe(7)
    expect(getCalendarDaysUntilAppointment('2026-10-10', '2026-10-08')).toBe(2)
    expect(getCalendarDaysUntilAppointment('2026-10-10', '2026-10-09')).toBe(1)
  })
})

describe('reminder settings', () => {
  it('defaults to Email only with 1-day interval', () => {
    expect(normalizeReminderSettings(null)).toEqual({
      enabled: true,
      method: 'email',
      intervalsDays: [1],
    })
  })

  it('maps legacy enabled false to None and enabled true to Email', () => {
    expect(normalizeReminderSettings({ enabled: false, intervalsDays: [1, 7] })).toEqual({
      enabled: false,
      method: 'none',
      intervalsDays: [7, 1],
    })
    expect(normalizeReminderSettings({ enabled: true, intervalsDays: [2] }).method).toBe(
      'email',
    )
  })

  it('preserves intervals when method is None', () => {
    expect(
      normalizeReminderSettings({
        method: 'none',
        intervalsDays: [7, 2, 1],
      }).intervalsDays,
    ).toEqual([7, 2, 1])
  })

  it('requires at least one interval when reminders are on', () => {
    expect(reminderSettingsAreValid({ method: 'email', intervalsDays: [] })).toBe(false)
    expect(reminderSettingsAreValid({ method: 'none', intervalsDays: [] })).toBe(true)
  })

  it('toggles intervals independently without changing method', () => {
    const next = toggleReminderInterval(
      { method: 'both', intervalsDays: [1] },
      7,
      true,
    )
    expect(next.intervalsDays).toEqual([7, 1])
    expect(next.method).toBe('both')
  })

  it('keeps SMS operational flag off until approved', () => {
    expect(isSmsRemindersOperational()).toBe(false)
    expect(isSmsRemindersOperational({ smsRemindersEnabled: true })).toBe(false)
    expect(
      isSmsRemindersOperational({
        smsRemindersEnabled: true,
        forceSmsOperational: true,
      }),
    ).toBe(true)
    expect(isSmsRemindersOperational({ smsOperational: true })).toBe(true)
  })
})

describe('reminder eligibility (configurable intervals)', () => {
  it('1 day before → eligible when 1-day enabled', () => {
    expect(
      getReminderType(baseAppt, {
        salonToday: '2026-10-09',
        reminderSettings: defaultSettings,
      }),
    ).toBe(1)
  })

  it('2 days before → eligible when 2-day enabled', () => {
    expect(
      getReminderType(baseAppt, {
        salonToday: '2026-10-08',
        reminderSettings: allIntervals,
      }),
    ).toBe(2)
  })

  it('7 days before → eligible when 7-day enabled', () => {
    expect(
      getReminderType(baseAppt, {
        salonToday: '2026-10-03',
        reminderSettings: allIntervals,
      }),
    ).toBe(7)
  })

  it('does not send an interval that already passed', () => {
    expect(
      getReminderType(baseAppt, {
        salonToday: '2026-10-08',
        reminderSettings: { enabled: true, intervalsDays: [7] },
      }),
    ).toBe(null)
  })

  it('already-sent interval → no resend', () => {
    const appt = applyReminderSentTimestamp(baseAppt, 1, '2026-10-09T12:00:00.000Z')
    expect(
      getReminderType(appt, {
        salonToday: '2026-10-09',
        reminderSettings: defaultSettings,
      }),
    ).toBe(null)
  })

  it('reminders disabled / None → none', () => {
    expect(
      getReminderType(baseAppt, {
        salonToday: '2026-10-09',
        reminderSettings: { method: 'none', intervalsDays: [1, 2, 7] },
      }),
    ).toBe(null)
  })

  it('notification methods select channels without silent email fallback for Text only', () => {
    const clients = new Map([['client-1', optedInClient]])

    const emailOnly = isReminderEligible(baseAppt, clients, {
      ...dayOpts,
      reminderSettings: { method: 'email', intervalsDays: [1] },
    })
    expect(emailOnly.eligible).toBe(true)
    expect(emailOnly.channels).toEqual({ email: true, sms: false })

    const smsOnlyBlocked = isReminderEligible(baseAppt, clients, {
      ...dayOpts,
      reminderSettings: { method: 'sms', intervalsDays: [1] },
    })
    expect(smsOnlyBlocked.eligible).toBe(false)
    expect(smsOnlyBlocked.reason).toBe('sms_unavailable')
    expect(smsOnlyBlocked.smsUnavailable).toBe(true)

    const bothEmailWhileSmsPending = isReminderEligible(baseAppt, clients, {
      ...dayOpts,
      reminderSettings: { method: 'both', intervalsDays: [1] },
    })
    expect(bothEmailWhileSmsPending.eligible).toBe(true)
    expect(bothEmailWhileSmsPending.channels).toEqual({ email: true, sms: false })
    expect(bothEmailWhileSmsPending.smsUnavailable).toBe(true)

    const bothLive = isReminderEligible(baseAppt, clients, {
      ...dayOpts,
      ...smsLiveOpts,
      reminderSettings: { method: 'both', intervalsDays: [1] },
    })
    expect(bothLive.eligible).toBe(true)
    expect(bothLive.channels).toEqual({ email: true, sms: true })
  })

  it('skips sends during quiet hours or after appointment start', () => {
    const clients = new Map([['client-1', optedInClient]])
    const quiet = isReminderEligible(baseAppt, clients, {
      salonToday: '2026-10-09',
      now: new Date('2026-10-09T08:00:00.000Z'), // 4 AM EDT
      reminderSettings: defaultSettings,
    })
    expect(quiet.eligible).toBe(false)
    expect(quiet.reason).toBe('quiet_hours_or_started')

    const started = isReminderEligible(baseAppt, clients, {
      salonToday: '2026-10-10',
      now: new Date('2026-10-10T19:00:00.000Z'), // after 14:00 EDT
      reminderSettings: defaultSettings,
    })
    expect(started.eligible).toBe(false)
  })

  it('tracks channels independently and does not re-fire a closed interval', () => {
    const partial = applyReminderSentTimestamp(baseAppt, 1, '2026-10-09T12:00:00.000Z', {
      channels: { email: true, sms: false },
      markIntervalComplete: false,
    })
    expect(isIntervalChannelSent(partial.reminders, 1, 'email')).toBe(true)
    expect(isIntervalChannelSent(partial.reminders, 1, 'sms')).toBe(false)
    expect(partial.reminders.oneDaySentAt).toBe(null)

    const clients = new Map([['client-1', optedInClient]])
    const retrySms = isReminderEligible(partial, clients, {
      ...dayOpts,
      ...smsLiveOpts,
      reminderSettings: { method: 'both', intervalsDays: [1] },
    })
    expect(retrySms.eligible).toBe(true)
    expect(retrySms.channels).toEqual({ email: false, sms: true })

    const closed = applyReminderSentTimestamp(partial, 1, '2026-10-09T12:05:00.000Z', {
      channels: { email: false, sms: true },
      markIntervalComplete: true,
    })
    expect(closed.reminders.oneDaySentAt).toBe('2026-10-09T12:05:00.000Z')
    expect(
      getReminderType(closed, {
        salonToday: '2026-10-09',
        reminderSettings: { method: 'both', intervalsDays: [1] },
      }),
    ).toBe(null)
  })

  it('confirmed → stop reminders', () => {
    expect(shouldStopReminders({ ...baseAppt, status: 'confirmed' })).toBe(true)
    expect(
      getReminderType(
        { ...baseAppt, status: 'confirmed' },
        { salonToday: '2026-10-09', reminderSettings: allIntervals },
      ),
    ).toBe(null)
  })

  it('reschedule_requested → stop reminders', () => {
    expect(shouldStopReminders({ ...baseAppt, status: 'reschedule_requested' })).toBe(true)
    expect(
      getReminderType(
        { ...baseAppt, status: 'reschedule_requested' },
        { salonToday: '2026-10-09', reminderSettings: allIntervals },
      ),
    ).toBe(null)
  })

  it('canceled → stop reminders', () => {
    expect(shouldStopReminders({ ...baseAppt, status: 'canceled' })).toBe(true)
  })

  it('after YES at 7-day mark, later intervals do not fire', () => {
    const confirmed = {
      ...baseAppt,
      status: 'confirmed',
      confirmation: { confirmedAt: '2026-10-03T12:00:00.000Z' },
      reminders: { sevenDaySentAt: '2026-10-03T12:00:00.000Z', twoDaySentAt: null, oneDaySentAt: null },
    }
    expect(
      getReminderType(confirmed, {
        salonToday: '2026-10-08',
        reminderSettings: allIntervals,
      }),
    ).toBe(null)
    expect(
      getReminderType(confirmed, {
        salonToday: '2026-10-09',
        reminderSettings: allIntervals,
      }),
    ).toBe(null)
  })

  it('maps reminder sent fields including twoDaySentAt', () => {
    expect(reminderSentField(2)).toBe('twoDaySentAt')
    expect(reminderSentField(REMINDER_TYPE_24H)).toBe('oneDaySentAt')
  })

  it('email-only client is eligible', () => {
    const clients = new Map([
      ['client-1', { id: 'client-1', firstName: 'Jamie', email: 'j@x.com', phone: '4045550199' }],
    ])
    const result = isReminderEligible(baseAppt, clients, {
      ...dayOpts,
      reminderSettings: defaultSettings,
    })
    expect(result.eligible).toBe(true)
    expect(result.channels.email).toBe(true)
  })
})

describe('confirmation tokens', () => {
  it('hashes tokens and does not expose raw equality', () => {
    const raw = generateConfirmationToken()
    const hash = hashConfirmationToken(raw)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(tokensMatch(raw, hash)).toBe(true)
  })

  it('valid token confirms appointment', () => {
    const ensured = ensureConfirmationToken(baseAppt)
    const result = confirmAppointmentByToken(
      [ensured.appointment],
      ensured.rawToken,
      { salonToday: '2026-10-01' },
    )
    expect(result.status).toBe('confirmed')
    expect(result.appointment.status).toBe('confirmed')
  })

  it('same valid token twice → already confirmed', () => {
    const ensured = ensureConfirmationToken(baseAppt)
    const first = confirmAppointmentByToken([ensured.appointment], ensured.rawToken, {
      salonToday: '2026-10-01',
    })
    const second = confirmAppointmentByToken(first.appointments, ensured.rawToken, {
      salonToday: '2026-10-01',
    })
    expect(second.status).toBe('already_confirmed')
  })
})

describe('confirm + reschedule secure links', () => {
  it('builds distinct confirm and reschedule URLs', () => {
    const confirm = buildConfirmationUrl('https://example.com', 'tok', 'confirm')
    const reschedule = buildConfirmationUrl('https://example.com', 'tok', 'reschedule')
    expect(confirm).toContain('action=confirm')
    expect(reschedule).toContain('action=reschedule')
  })

  it('RESCHEDULE path sets orange status and exact acknowledgment copy', () => {
    const ensured = ensureConfirmationToken(baseAppt)
    const result = processAppointmentActionByToken(
      [ensured.appointment],
      ensured.rawToken,
      'reschedule',
      { salonToday: '2026-10-01' },
    )
    expect(result.status).toBe('reschedule_requested')
    expect(getAppointmentStatusLabel(result.appointment.status)).toBe('Reschedule requested')
    const html = renderConfirmationPage('reschedule_requested', result.appointment, {
      salonName: "Rozie's Salon",
      stylistName: 'Rozie',
    })
    expect(html).toContain(
      "Rozie's Salon has been notified and will message you to reschedule your appointment.",
    )
  })

  it('stale RESCHEDULE cannot overwrite confirmed', () => {
    const ensured = ensureConfirmationToken(baseAppt)
    const confirmed = processAppointmentActionByToken(
      [ensured.appointment],
      ensured.rawToken,
      'confirm',
      { salonToday: '2026-10-01' },
    )
    const stale = processAppointmentActionByToken(
      confirmed.appointments,
      ensured.rawToken,
      'reschedule',
      { salonToday: '2026-10-01' },
    )
    expect(stale.status).toBe('conflict')
  })

  it('applyRescheduleRequest preserves slot', () => {
    const requested = applyRescheduleRequest(baseAppt)
    expect(requested.date).toBe(baseAppt.date)
    expect(requested.startTime).toBe(baseAppt.startTime)
  })
})

describe('cancel appointment secure links', () => {
  it('builds a cancel URL that opens the confirmation prompt', () => {
    const cancel = buildConfirmationUrl('https://example.com', 'tok', 'cancel')
    expect(cancel).toContain('action=cancel')
  })

  it('cancel link shows prompt without mutating the appointment', () => {
    const ensured = ensureConfirmationToken(baseAppt)
    const result = processAppointmentActionByToken(
      [ensured.appointment],
      ensured.rawToken,
      'cancel',
      { salonToday: '2026-10-01' },
    )
    expect(result.status).toBe('cancel_prompt')
    expect(result.mutates).toBe(false)
    expect(result.appointment.status).toBe('pending')
    const html = renderConfirmationPage('cancel_prompt', result.appointment, {
      cancelConfirmUrl: 'https://example.com/confirm?token=tok&action=cancel_confirm',
      keepUrl: 'https://example.com/confirm?token=tok&action=keep',
    })
    expect(html).toContain('Are you sure you want to cancel this appointment?')
    expect(html).toContain('Confirm Cancellation')
    expect(html).toContain('Keep Appointment')
  })

  it('confirm cancellation persists canceled status and holds the slot', () => {
    const ensured = ensureConfirmationToken(baseAppt)
    const result = processAppointmentActionByToken(
      [ensured.appointment],
      ensured.rawToken,
      'cancel_confirm',
      { salonToday: '2026-10-01', atIso: '2026-10-01T15:00:00.000Z' },
    )
    expect(result.status).toBe('canceled')
    expect(result.mutates).toBe(true)
    expect(result.appointment.status).toBe('canceled')
    expect(result.appointment.canceledAt).toBe('2026-10-01T15:00:00.000Z')
    expect(result.appointment.slotReleasedAt).toBeNull()
    expect(shouldStopReminders(result.appointment)).toBe(true)
    const html = renderConfirmationPage('canceled', result.appointment)
    expect(html).toContain('Appointment canceled')
  })

  it('duplicate cancel clicks stay idempotent', () => {
    const ensured = ensureConfirmationToken(baseAppt)
    const first = processAppointmentActionByToken(
      [ensured.appointment],
      ensured.rawToken,
      'cancel_confirm',
      { salonToday: '2026-10-01' },
    )
    const second = processAppointmentActionByToken(
      first.appointments,
      ensured.rawToken,
      'cancel_confirm',
      { salonToday: '2026-10-01' },
    )
    expect(second.status).toBe('already_canceled')
    expect(second.mutates).toBe(false)
  })

  it('unrelated token cannot cancel another appointment', () => {
    const ensured = ensureConfirmationToken(baseAppt)
    const other = ensureConfirmationToken({
      ...baseAppt,
      id: 'appt-other',
    })
    const result = processAppointmentActionByToken(
      [ensured.appointment],
      other.rawToken,
      'cancel_confirm',
      { salonToday: '2026-10-01' },
    )
    expect(result.status).toBe('invalid')
    expect(result.appointments[0].status).toBe('pending')
  })
})

describe('reschedule invalidation', () => {
  it('date/time change resets confirmation and reminders', () => {
    const confirmed = {
      ...baseAppt,
      status: 'confirmed',
      confirmation: { tokenHash: 'x', tokenNonce: 'y', confirmedAt: '2026-10-01T00:00:00.000Z' },
      reminders: { sevenDaySentAt: null, threeDaySentAt: null, twoDaySentAt: null, oneDaySentAt: '2026-10-09T00:00:00.000Z' },
    }
    const next = { ...confirmed, date: '2026-10-11' }
    expect(shouldInvalidateConfirmation(confirmed, next)).toBe(true)
    const reset = resetConfirmationForReschedule(next)
    expect(reset.status).toBe('pending')
    expect(reset.reminders.oneDaySentAt).toBe(null)
  })
})

describe('reminder email builder', () => {
  it('builds email for 2-day interval with all three actions', () => {
    const email = buildReminderEmail({
      reminderType: 2,
      client: optedInClient,
      appointment: baseAppt,
      confirmationUrl: 'https://example.com/appointment/abc?intent=confirm',
      manageUrl: 'https://example.com/appointment/abc',
      fromName: "Rozie's Salon",
      salonName: "Rozie's Salon",
      stylistName: 'Rozie',
    })
    expect(email.text).toContain('two days')
    expect(email.subject).toContain("Rozie's Salon")
    expect(email.html).toContain('Confirm Appointment')
    expect(email.html).toContain('Manage Appointment')
    expect(email.html).not.toContain('Request Reschedule')
    expect(email.html).not.toContain('Cancel Appointment')
    expect(email.text).toContain('Manage Appointment:')
  })
})
