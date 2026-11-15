import { describe, it, expect, beforeEach } from 'vitest'
import { createMemoryStorageProvider } from '../storage/memoryStorageProvider.js'
import {
  __setStorageProviderForTests,
  __resetStorageProviderForTests,
} from '../storage/createStorageProvider.js'
import {
  hydrateAppointments,
  resetAppointmentsCache,
  updateAppointment,
  getAppointments,
} from './appointmentRepository.js'
import {
  getAppointmentStatusLabel,
  APPOINTMENT_STATUS,
} from '../utils/appointmentStatus.js'

const base = {
  id: 'appt-resched-1',
  type: 'appointment',
  clientId: 'c1',
  clientName: 'Test Client',
  date: '2026-10-20',
  startTime: '14:00',
  durationMinutes: 60,
  service: 'Haircut',
  status: 'confirmed',
  notes: 'keep me',
  confirmation: {
    tokenHash: 'abc123',
    tokenNonce: 'nonce1',
    confirmedAt: '2026-10-01T12:00:00.000Z',
    rescheduleRequestedAt: null,
  },
  reminders: {
    sevenDaySentAt: '2026-10-13T12:00:00.000Z',
    threeDaySentAt: null,
    oneDaySentAt: null,
  },
}

const rescheduleBase = {
  ...base,
  id: 'appt-resched-2',
  status: 'reschedule_requested',
  confirmation: {
    tokenHash: 'def456',
    tokenNonce: 'nonce2',
    confirmedAt: null,
    rescheduleRequestedAt: '2026-10-18T10:00:00.000Z',
  },
  reminders: {
    sevenDaySentAt: null,
    threeDaySentAt: null,
    oneDaySentAt: '2026-10-19T12:00:00.000Z',
  },
}

describe('appointment reschedule confirmation rules', () => {
  beforeEach(() => {
    resetAppointmentsCache()
    __resetStorageProviderForTests()
    __setStorageProviderForTests(createMemoryStorageProvider())
    hydrateAppointments({ appointments: [structuredClone(base)] })
  })

  it('changing date after confirm → pending + clears confirmation/reminders', async () => {
    const updated = await updateAppointment(base.id, { date: '2026-10-21' })
    expect(updated.status).toBe('pending')
    expect(updated.confirmation.confirmedAt).toBeNull()
    expect(updated.confirmation.tokenHash).toBeNull()
    expect(updated.reminders.sevenDaySentAt).toBeNull()
  })

  it('changing start time after confirm → pending', async () => {
    const updated = await updateAppointment(base.id, { startTime: '15:00' })
    expect(updated.status).toBe('pending')
    expect(updated.confirmation.tokenHash).toBeNull()
  })

  it('changing duration after confirm → pending (reserved time change)', async () => {
    const updated = await updateAppointment(base.id, { durationMinutes: 90 })
    expect(updated.status).toBe('pending')
    expect(updated.confirmation.confirmedAt).toBeNull()
  })

  it('changing only notes keeps confirmed', async () => {
    const updated = await updateAppointment(base.id, { notes: 'new notes only' })
    expect(updated.status).toBe('confirmed')
    expect(updated.confirmation.tokenHash).toBe('abc123')
    expect(updated.confirmation.confirmedAt).toBe('2026-10-01T12:00:00.000Z')
    expect(updated.reminders.sevenDaySentAt).toBe('2026-10-13T12:00:00.000Z')
    expect(getAppointments()[0].notes).toBe('new notes only')
  })
})

describe('manual resolution of reschedule_requested', () => {
  beforeEach(() => {
    resetAppointmentsCache()
    __resetStorageProviderForTests()
    __setStorageProviderForTests(createMemoryStorageProvider())
    hydrateAppointments({ appointments: [structuredClone(rescheduleBase)] })
  })

  it('keeps original slot when status is reschedule_requested', () => {
    const appt = getAppointments()[0]
    expect(appt.status).toBe(APPOINTMENT_STATUS.RESCHEDULE_REQUESTED)
    expect(appt.date).toBe('2026-10-20')
    expect(appt.startTime).toBe('14:00')
    expect(getAppointmentStatusLabel(appt.status)).toBe('Reschedule requested')
  })

  it('clearing to pending keeps reminder sent flag (no duplicate reminder)', async () => {
    const updated = await updateAppointment(rescheduleBase.id, { status: 'pending' })
    expect(updated.status).toBe('pending')
    expect(updated.confirmation.rescheduleRequestedAt).toBeNull()
    expect(updated.reminders.oneDaySentAt).toBe('2026-10-19T12:00:00.000Z')
    expect(updated.date).toBe('2026-10-20')
    expect(updated.startTime).toBe('14:00')
  })

  it('marking confirmed clears reschedule timestamp', async () => {
    const updated = await updateAppointment(rescheduleBase.id, { status: 'confirmed' })
    expect(updated.status).toBe('confirmed')
    expect(updated.confirmation.rescheduleRequestedAt).toBeNull()
    expect(updated.confirmation.confirmedAt).toBeTruthy()
  })

  it('changing time after reschedule request resets confirmation and reminders', async () => {
    const updated = await updateAppointment(rescheduleBase.id, {
      date: '2026-10-22',
      startTime: '11:00',
    })
    expect(updated.status).toBe('pending')
    expect(updated.confirmation.tokenHash).toBeNull()
    expect(updated.confirmation.rescheduleRequestedAt).toBeNull()
    expect(updated.reminders.oneDaySentAt).toBeNull()
    expect(updated.date).toBe('2026-10-22')
    expect(updated.startTime).toBe('11:00')
  })
})
