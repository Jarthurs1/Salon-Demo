import { describe, expect, it } from 'vitest'
import {
  approveCustomerReschedule,
  cancelByCustomer,
  cancelBySalon,
  claimNotification,
  completeNotification,
  confirmationMutates,
  confirmByCustomer,
  declineCustomerReschedule,
  evaluateCustomerCutoff,
  normalizeCustomerCutoff,
  requestCustomerReschedule,
  shouldSendNewCustomerNotice,
  toPublicAppointment,
} from './customerManage.js'
import { buildBookingConfirmationEmail, buildNoticeEmail } from './appointmentEmails.js'

const base = {
  id: 'appt-1',
  date: '2026-11-24',
  startTime: '14:00',
  durationMinutes: 60,
  service: 'Cut & Style',
  serviceId: 'haircut-style',
  status: 'pending',
  clientId: 'client-1',
  confirmation: { tokenHash: 'hash', confirmedAt: null },
}

const tuesdayMorning = new Date('2026-11-17T15:00:00.000Z')

describe('customer confirmation', () => {
  it('confirms once and ignores a repeated confirm', () => {
    const first = confirmByCustomer(base, '2026-11-17T15:00:00.000Z')
    expect(first.code).toBe('confirmed')
    expect(first.mutates).toBe(true)
    const second = confirmByCustomer(first.appointment, '2026-11-17T16:00:00.000Z')
    expect(second.code).toBe('already_confirmed')
    expect(second.mutates).toBe(false)
    expect(second.appointment.confirmation.confirmedAt).toBe('2026-11-17T15:00:00.000Z')
  })

  it('does not confirm from a GET preview', () => {
    expect(confirmationMutates('GET', 'confirm')).toBe(false)
    expect(confirmationMutates('POST', 'confirm')).toBe(true)
    expect(confirmationMutates('GET', 'cancel_confirm')).toBe(false)
  })

  it('rejects an invalid or canceled appointment', () => {
    expect(confirmByCustomer(null, '2026-11-17T15:00:00.000Z').code).toBe('invalid')
    expect(confirmByCustomer({ ...base, status: 'canceled' }, 't').code).toBe('canceled')
  })
})

describe('customer cutoff', () => {
  it('defaults to not on the appointment date', () => {
    expect(normalizeCustomerCutoff(undefined)).toBe('not_same_day')
    expect(normalizeCustomerCutoff('nope')).toBe('not_same_day')
  })

  it('blocks same-day changes and allows the day before', () => {
    const sameDay = evaluateCustomerCutoff(base, {
      cutoff: 'not_same_day',
      now: new Date('2026-11-24T15:00:00.000Z'),
      timeZone: 'America/New_York',
    })
    expect(sameDay.allowed).toBe(false)
    expect(sameDay.code).toBe('cutoff')
    const dayBefore = evaluateCustomerCutoff(base, {
      cutoff: 'not_same_day',
      now: tuesdayMorning,
      timeZone: 'America/New_York',
    })
    expect(dayBefore.allowed).toBe(true)
  })

  it('enforces rolling 24-hour and 48-hour cutoffs', () => {
    const within24 = evaluateCustomerCutoff(
      { ...base, date: '2026-11-18', startTime: '10:00' },
      {
        cutoff: '24h',
        now: new Date('2026-11-17T16:00:00.000Z'),
        timeZone: 'America/New_York',
      },
    )
    expect(within24.allowed).toBe(false)
    const beyond48 = evaluateCustomerCutoff(base, {
      cutoff: '48h',
      now: tuesdayMorning,
      timeZone: 'America/New_York',
    })
    expect(beyond48.allowed).toBe(true)
  })

  it('blocks past appointments', () => {
    const past = evaluateCustomerCutoff(base, {
      cutoff: 'anytime',
      now: new Date('2026-11-25T15:00:00.000Z'),
      timeZone: 'America/New_York',
    })
    expect(past.code).toBe('past')
  })
})

describe('reschedule requests', () => {
  it('keeps the original slot and stores the requested time', () => {
    const requested = requestCustomerReschedule(
      base,
      { date: '2026-11-25', startTime: '11:00' },
      '2026-11-17T15:00:00.000Z',
    )
    expect(requested.appointment.date).toBe('2026-11-24')
    expect(requested.appointment.startTime).toBe('14:00')
    expect(requested.appointment.status).toBe('reschedule_requested')
    expect(requested.appointment.rescheduleRequest).toMatchObject({
      date: '2026-11-25',
      startTime: '11:00',
      source: 'customer_website',
      priorStatus: 'pending',
    })
  })

  it('does not duplicate the same request', () => {
    const first = requestCustomerReschedule(
      base,
      { date: '2026-11-25', startTime: '11:00' },
      '2026-11-17T15:00:00.000Z',
    )
    const second = requestCustomerReschedule(
      first.appointment,
      { date: '2026-11-25', startTime: '11:00' },
      '2026-11-18T15:00:00.000Z',
    )
    expect(second.code).toBe('already_requested')
    expect(second.mutates).toBe(false)
  })

  it('approves onto the requested time and preserves a confirmed status', () => {
    const confirmed = { ...base, status: 'confirmed', confirmation: { confirmedAt: 'earlier' } }
    const requested = requestCustomerReschedule(
      confirmed,
      { date: '2026-11-25', startTime: '11:00' },
      '2026-11-17T15:00:00.000Z',
    )
    const approved = approveCustomerReschedule(requested.appointment, {
      atIso: '2026-11-18T15:00:00.000Z',
      available: true,
    })
    expect(approved.appointment.date).toBe('2026-11-25')
    expect(approved.appointment.startTime).toBe('11:00')
    expect(approved.appointment.status).toBe('confirmed')
    const again = approveCustomerReschedule(approved.appointment, {
      atIso: 'later',
      available: true,
    })
    expect(again.code).toBe('already_approved')
    expect(again.mutates).toBe(false)
  })

  it('does not move the appointment when the new slot is taken', () => {
    const requested = requestCustomerReschedule(
      base,
      { date: '2026-11-25', startTime: '11:00' },
      '2026-11-17T15:00:00.000Z',
    )
    const blocked = approveCustomerReschedule(requested.appointment, {
      atIso: '2026-11-18T15:00:00.000Z',
      available: false,
    })
    expect(blocked.code).toBe('conflict')
    expect(blocked.appointment.date).toBe('2026-11-24')
    expect(blocked.mutates).toBe(false)
  })

  it('declines without changing the original time', () => {
    const requested = requestCustomerReschedule(
      { ...base, status: 'confirmed', confirmation: { confirmedAt: 'earlier' } },
      { date: '2026-11-25', startTime: '11:00' },
      '2026-11-17T15:00:00.000Z',
    )
    const declined = declineCustomerReschedule(
      requested.appointment,
      '2026-11-18T15:00:00.000Z',
    )
    expect(declined.appointment.date).toBe('2026-11-24')
    expect(declined.appointment.status).toBe('confirmed')
    expect(declined.appointment.rescheduleRequest.status).toBe('declined')
    const again = declineCustomerReschedule(declined.appointment, 'later')
    expect(again.code).toBe('already_declined')
    expect(again.mutates).toBe(false)
  })
})

describe('cancellation', () => {
  it('releases the slot for a customer cancellation and ignores a repeat', () => {
    const canceled = cancelByCustomer(base, '2026-11-17T15:00:00.000Z')
    expect(canceled.appointment.status).toBe('canceled')
    expect(canceled.appointment.slotReleasedAt).toBe('2026-11-17T15:00:00.000Z')
    expect(canceled.appointment.cancellationSource).toBe('customer_website')
    const again = cancelByCustomer(canceled.appointment, 'later')
    expect(again.code).toBe('already_canceled')
    expect(again.mutates).toBe(false)
  })

  it('lets the salon cancel without releasing the slot', () => {
    const canceled = cancelBySalon(base, '2026-11-17T15:00:00.000Z')
    expect(canceled.appointment.slotReleasedAt).toBeNull()
    expect(canceled.appointment.cancellationSource).toBe('management_app')
  })

  it('hides actions on a public canceled appointment', () => {
    const view = toPublicAppointment(
      { ...base, status: 'canceled' },
      { cutoff: 'not_same_day', now: tuesdayMorning, salonName: 'Salon' },
    )
    expect(view.actions).toEqual({ confirm: false, reschedule: false, cancel: false })
    expect(view.clientId).toBeUndefined()
  })
})

describe('notifications', () => {
  it('sends a new-customer notice only for a first booking', () => {
    expect(shouldSendNewCustomerNotice('new')).toBe(true)
    expect(shouldSendNewCustomerNotice('existing')).toBe(false)
  })

  it('claims a notice once and records a failed delivery', () => {
    const first = claimNotification(base, 'owner', 'canceled', 'appt-1', 't1')
    expect(first.claimed).toBe(true)
    const second = claimNotification(first.appointment, 'owner', 'canceled', 'appt-1', 't2')
    expect(second.claimed).toBe(false)
    const failed = completeNotification(first.appointment, 'owner', 'canceled', {
      status: 'failed',
      error: 'ses_down',
      at: 't3',
    })
    expect(failed.ownerNotifications.canceled.status).toBe('failed')
    expect(failed.status).toBe('pending')
  })

  it('uses the event-specific subjects and the settings email', () => {
    const schedule = { salonName: 'North Salon', contactEmail: 'owner@example.com' }
    const client = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '555-0100' }
    const booking = buildNoticeEmail({
      audience: 'owner',
      event: 'newCustomerBooking',
      appointment: base,
      client,
      schedule,
    })
    expect(booking.subject).toBe('New Customer Booking — Ada Lovelace')
    expect(booking.to).toBe('owner@example.com')
    const reschedule = buildNoticeEmail({
      audience: 'owner',
      event: 'rescheduleRequested',
      appointment: {
        ...base,
        rescheduleRequest: { date: '2026-11-25', startTime: '11:00', requestedAt: 't' },
      },
      client,
      schedule,
    })
    expect(reschedule.subject).toBe('Reschedule Requested — Ada Lovelace')
    const canceled = buildNoticeEmail({
      audience: 'owner',
      event: 'canceled',
      appointment: { ...base, canceledAt: 't', cancellationSource: 'customer_website' },
      client,
      schedule,
    })
    expect(canceled.subject).toBe('Appointment Canceled — Ada Lovelace')
    const approved = buildNoticeEmail({
      audience: 'customer',
      event: 'rescheduleApproved',
      appointment: { ...base, date: '2026-11-25', startTime: '11:00' },
      client,
      schedule,
    })
    expect(approved.subject).toBe('Reschedule Approved — North Salon')
    expect(approved.to).toBe('ada@example.com')
  })

  it('builds a confirm email with manage and confirm actions', () => {
    const email = buildBookingConfirmationEmail({
      salonName: 'North Salon',
      client: { firstName: 'Ada' },
      appointment: base,
      confirmUrl: 'https://book.example/appointment/tok?intent=confirm',
      manageUrl: 'https://book.example/appointment/tok',
    })
    expect(email.text).toContain('Confirm Appointment:')
    expect(email.html).toContain('Manage Appointment')
    expect(email.text).toContain('Use Manage Appointment')
  })
})
