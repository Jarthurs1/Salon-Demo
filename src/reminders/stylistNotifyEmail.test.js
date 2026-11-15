import { describe, expect, it } from 'vitest'
import { ensureConfirmationToken } from './ensureConfirmationToken.js'
import { processAppointmentActionByToken } from './confirmationLogic.js'
import { getAppointmentStatusLabel } from '../utils/appointmentStatus.js'
import {
  buildStylistCancelNotifyEmail,
  buildStylistRescheduleNotifyEmail,
  resolveClientDisplayName,
  shouldNotifyStylistOfReschedule,
} from './stylistNotifyEmail.js'

const baseAppt = {
  id: 'appt-1',
  type: 'appointment',
  status: 'pending',
  date: '2026-11-12',
  startTime: '14:00',
  durationMinutes: 90,
  service: 'Color',
  clientId: 'client-1',
  clientName: 'Jamie Lee',
}

describe('stylistNotifyEmail', () => {
  it('builds a reschedule notification with customer details', () => {
    const { subject, text } = buildStylistRescheduleNotifyEmail({
      clientName: 'Jamie Lee',
      clientPhone: '4045551234',
      appointment: baseAppt,
      salonName: "Rozie's Salon",
    })

    expect(subject).toBe('Reschedule Requested — Jamie Lee')
    expect(text).toContain('Jamie Lee has requested to reschedule their appointment.')
    expect(text).toContain('Customer: Jamie Lee')
    expect(text).toContain('Phone: (404) 555-1234')
    expect(text).toContain('Date: Thursday, November 12')
    expect(text).toContain('Time: 2:00 PM')
    expect(text).toContain('Service: Color')
    expect(text).toContain('Duration: 1 hr 30 min')
    expect(text).toContain('still held on your calendar')
  })

  it('builds cancel notification with stylist greeting and held-slot guidance', () => {
    const { subject, text } = buildStylistCancelNotifyEmail({
      clientName: 'Jamie',
      appointment: baseAppt,
      salonName: "Rozie's Salon",
      stylistName: 'Rozie',
    })
    expect(subject).toBe('Appointment Canceled — Jamie')
    expect(text).toContain('Hi Rozie,')
    expect(text).toContain('Jamie canceled their appointment.')
    expect(text).toContain('marked CANCELED')
    expect(text).toContain('release the time slot when ready')
  })

  it('notifies only on a fresh reschedule_requested status', () => {
    expect(shouldNotifyStylistOfReschedule('reschedule_requested')).toBe(true)
    expect(shouldNotifyStylistOfReschedule('already_reschedule_requested')).toBe(
      false,
    )
    expect(shouldNotifyStylistOfReschedule('confirmed')).toBe(false)
    expect(shouldNotifyStylistOfReschedule('canceled')).toBe(false)
  })

  it('resolves customer display names from client records', () => {
    expect(
      resolveClientDisplayName(
        { firstName: 'Jamie', lastName: 'Lee' },
        baseAppt,
      ),
    ).toBe('Jamie Lee')
    expect(resolveClientDisplayName(null, baseAppt)).toBe('Jamie Lee')
  })
})

describe('reschedule notify workflow guards', () => {
  it('sets reschedule_requested once and keeps the original slot', () => {
    const ensured = ensureConfirmationToken(baseAppt)
    const first = processAppointmentActionByToken(
      [ensured.appointment],
      ensured.rawToken,
      'reschedule',
      { salonToday: '2026-11-08', atIso: '2026-11-08T18:00:00.000Z' },
    )

    expect(first.status).toBe('reschedule_requested')
    expect(shouldNotifyStylistOfReschedule(first.status)).toBe(true)
    expect(first.appointment.status).toBe('reschedule_requested')
    expect(getAppointmentStatusLabel(first.appointment.status)).toBe(
      'Reschedule requested',
    )
    expect(first.appointment.date).toBe(baseAppt.date)
    expect(first.appointment.startTime).toBe(baseAppt.startTime)
    expect(first.appointment.durationMinutes).toBe(baseAppt.durationMinutes)
    expect(first.appointment.confirmation.rescheduleRequestedAt).toBe(
      '2026-11-08T18:00:00.000Z',
    )

    const second = processAppointmentActionByToken(
      first.appointments,
      ensured.rawToken,
      'reschedule',
      { salonToday: '2026-11-08' },
    )
    expect(second.status).toBe('already_reschedule_requested')
    expect(second.mutates).toBe(false)
    expect(shouldNotifyStylistOfReschedule(second.status)).toBe(false)
    expect(second.appointment.date).toBe(baseAppt.date)
    expect(second.appointment.startTime).toBe(baseAppt.startTime)
  })
})
