import { describe, it, expect, beforeEach } from 'vitest'
import { createMemoryStorageProvider } from './memoryStorageProvider.js'
import { createHttpStorageProvider } from './httpStorageProvider.js'
import {
  __setStorageProviderForTests,
  __resetStorageProviderForTests,
  createStorageProvider,
  resolveStorageMode,
} from './createStorageProvider.js'
import {
  hydrateClients,
  createClient,
  getClients,
  resetClientsCache,
} from '../services/clientRepository.js'
import {
  hydrateAppointments,
  createAppointment,
  getAppointments,
  updateAppointment,
  resetAppointmentsCache,
} from '../services/appointmentRepository.js'
import {
  hydrateSettings,
  getScheduleSettings,
  resetSettingsCache,
  ensureSettingsInitialized,
} from '../services/settingsRepository.js'

describe('resolveStorageMode', () => {
  it('stays on browser storage even if a live mode is requested', () => {
    expect(resolveStorageMode({ configuredMode: 'aws', prod: true })).toBe('local')
    expect(resolveStorageMode({ configuredMode: '', prod: true })).toBe('local')
    expect(createStorageProvider().name).toBe('local')
  })

  it('refuses to open a live data API', () => {
    expect(() => createHttpStorageProvider()).toThrow(/does not connect/)
  })
})

describe('repositories with memory storage', () => {
  beforeEach(() => {
    resetClientsCache()
    resetAppointmentsCache()
    resetSettingsCache()
    __resetStorageProviderForTests()
    const memory = createMemoryStorageProvider()
    __setStorageProviderForTests(memory)
    hydrateClients({ clients: [] })
    hydrateAppointments({ appointments: [] })
    hydrateSettings(null)
  })

  it('persists a client and appointment through the storage provider', async () => {
    const client = await createClient({
      firstName: 'Jamie',
      lastName: 'Lee',
      email: 'jamie@example.com',
    })
    expect(getClients()).toHaveLength(1)

    const appt = await createAppointment({
      type: 'appointment',
      clientId: client.id,
      clientName: 'Jamie Lee',
      date: '2026-10-01',
      startTime: '13:00',
      durationMinutes: 60,
      service: 'Haircut',
      status: 'pending',
      notes: '',
    })
    expect(getAppointments()[0].startTime).toBe('13:00')

    await updateAppointment(appt.id, { status: 'confirmed' })
    expect(getAppointments()[0].status).toBe('confirmed')

    expect(getScheduleSettings().weeklyHours.monday.closed).toBe(false)
    expect(getScheduleSettings().weeklyHours.saturday.closed).toBe(true)
  })

  it('fills a blank settings record with the fictional salon', async () => {
    const envelope = await ensureSettingsInitialized({
      schedule: { salonName: '', weeklyHours: { monday: { closed: true, start: '09:00', end: '15:00' } } },
    })
    expect(envelope.schedule.salonName).toBe('Lumen & Co.')
    expect(envelope.schedule.stylistName).toBe('Mara')
    expect(envelope.schedule.contactEmail).toBe('studio@example.com')
    expect(getScheduleSettings().salonName).toBe('Lumen & Co.')
    expect(getScheduleSettings().weeklyHours.monday.closed).toBe(true)
  })
})
