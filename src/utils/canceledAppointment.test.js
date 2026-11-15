import { describe, expect, it } from 'vitest'
import {
  applyReleaseCanceledSlot,
  doesAppointmentBlockAvailability,
  isCanceledSlotHeld,
  isCanceledVisibleOnCalendar,
  normalizeSlotReleasedAt,
} from './canceledAppointment.js'
import { applyCancelAppointment } from '../reminders/appointmentConfirmationMeta.js'
import { findConflicts } from './conflictUtils.js'
import { getActiveScheduleAppointments } from './timelineUtils.js'

describe('canceledAppointment slot hold', () => {
  it('new cancellations hold the slot until released', () => {
    const canceled = applyCancelAppointment({
      id: 'a1',
      status: 'pending',
      date: '2026-11-10',
      startTime: '10:00',
      durationMinutes: 60,
    }, '2026-11-08T12:00:00.000Z')

    expect(canceled.status).toBe('canceled')
    expect(canceled.slotReleasedAt).toBeNull()
    expect(isCanceledSlotHeld(canceled)).toBe(true)
    expect(isCanceledVisibleOnCalendar(canceled)).toBe(true)
    expect(doesAppointmentBlockAvailability(canceled)).toBe(true)
  })

  it('freeing the slot is idempotent and preserves history fields', () => {
    const canceled = applyCancelAppointment({
      id: 'a1',
      status: 'confirmed',
      date: '2026-11-10',
      startTime: '10:00',
      durationMinutes: 60,
      service: 'Cut',
      clientName: 'Jamie',
    }, '2026-11-08T12:00:00.000Z')

    const released = applyReleaseCanceledSlot(canceled, '2026-11-08T13:00:00.000Z')
    expect(released.status).toBe('canceled')
    expect(released.slotReleasedAt).toBe('2026-11-08T13:00:00.000Z')
    expect(released.service).toBe('Cut')
    expect(isCanceledSlotHeld(released)).toBe(false)
    expect(doesAppointmentBlockAvailability(released)).toBe(false)

    const again = applyReleaseCanceledSlot(released, '2026-11-08T14:00:00.000Z')
    expect(again.slotReleasedAt).toBe('2026-11-08T13:00:00.000Z')
  })

  it('legacy canceled appointments without slotReleasedAt stay released', () => {
    const legacy = {
      id: 'legacy',
      status: 'canceled',
      canceledAt: '2026-10-01T12:00:00.000Z',
      date: '2026-10-02',
      startTime: '11:00',
      durationMinutes: 60,
    }
    expect(normalizeSlotReleasedAt(legacy)).toBe('2026-10-01T12:00:00.000Z')
    const normalized = {
      ...legacy,
      slotReleasedAt: normalizeSlotReleasedAt(legacy),
    }
    expect(isCanceledSlotHeld(normalized)).toBe(false)
    expect(doesAppointmentBlockAvailability(normalized)).toBe(false)
  })

  it('held canceled appointments block booking and remain on the active calendar', () => {
    const held = {
      id: 'held',
      status: 'canceled',
      canceledAt: '2026-11-08T12:00:00.000Z',
      slotReleasedAt: null,
      date: '2026-11-10',
      startTime: '10:00',
      durationMinutes: 60,
      clientName: 'Jamie',
      type: 'appointment',
    }
    expect(
      findConflicts(
        { date: '2026-11-10', startTime: '10:00', durationMinutes: 60 },
        [held],
      ),
    ).toHaveLength(1)
    expect(getActiveScheduleAppointments([held])).toHaveLength(1)
  })

  it('released canceled appointments free the slot and leave the active calendar', () => {
    const released = {
      id: 'released',
      status: 'canceled',
      canceledAt: '2026-11-08T12:00:00.000Z',
      slotReleasedAt: '2026-11-08T13:00:00.000Z',
      date: '2026-11-10',
      startTime: '10:00',
      durationMinutes: 60,
      type: 'appointment',
    }
    expect(
      findConflicts(
        { date: '2026-11-10', startTime: '10:00', durationMinutes: 60 },
        [released],
      ),
    ).toHaveLength(0)
    expect(getActiveScheduleAppointments([released])).toHaveLength(0)
  })
})
