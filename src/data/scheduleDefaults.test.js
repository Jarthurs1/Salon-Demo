import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SCHEDULE,
  DEFAULT_WEEKLY_HOURS,
  LEGACY_INCORRECT_WEEKLY_HOURS,
  matchesLegacyIncorrectWeeklyHours,
} from './scheduleDefaults.js'
import { normalizeSettingsEnvelope } from '../services/settingsRepository.js'

describe('default schedule', () => {
  it('uses Mon–Fri 8–6 and closed weekends', () => {
    expect(DEFAULT_SCHEDULE.timezone).toBe('America/New_York')
    for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']) {
      expect(DEFAULT_WEEKLY_HOURS[day]).toEqual({
        closed: false,
        start: '08:00',
        end: '18:00',
      })
    }
    expect(DEFAULT_WEEKLY_HOURS.saturday.closed).toBe(true)
    expect(DEFAULT_WEEKLY_HOURS.sunday.closed).toBe(true)
  })

  it('migrates legacy incorrect weekly hours only', () => {
    expect(matchesLegacyIncorrectWeeklyHours(LEGACY_INCORRECT_WEEKLY_HOURS)).toBe(
      true,
    )
    expect(matchesLegacyIncorrectWeeklyHours(DEFAULT_WEEKLY_HOURS)).toBe(false)

    const custom = {
      ...structuredClone(LEGACY_INCORRECT_WEEKLY_HOURS),
      friday: { closed: false, start: '10:00', end: '16:00' },
    }
    expect(matchesLegacyIncorrectWeeklyHours(custom)).toBe(false)

    const migrated = normalizeSettingsEnvelope({
      schedule: { weeklyHours: structuredClone(LEGACY_INCORRECT_WEEKLY_HOURS) },
    })
    expect(migrated.schedule.weeklyHours).toEqual(DEFAULT_WEEKLY_HOURS)
    expect(migrated._migratedLegacyHours).toBe(true)
  })

  it('seeds Rozie contact email once without overwriting saved values', () => {
    const seeded = normalizeSettingsEnvelope({
      schedule: {
        salonName: "Rozie's Salon",
        stylistName: 'Rozie',
        contactEmail: '',
      },
    })
    expect(seeded.schedule.contactEmail).toBe('')
    expect(seeded._migratedContactEmail).toBe(false)
    expect(JSON.stringify(seeded)).not.toContain('gmail.com')

    const preserved = normalizeSettingsEnvelope({
      schedule: {
        salonName: "Rozie's Salon",
        stylistName: 'Rozie',
        contactEmail: 'rozie-custom@example.com',
      },
    })
    expect(preserved.schedule.contactEmail).toBe('rozie-custom@example.com')
    expect(preserved._migratedContactEmail).toBe(false)

    const otherSalon = normalizeSettingsEnvelope({
      schedule: {
        salonName: "Sarah's Studio",
        stylistName: 'Sarah',
        contactEmail: '',
      },
    })
    expect(otherSalon.schedule.contactEmail).toBe('')
    expect(otherSalon._migratedContactEmail).toBe(false)
  })

  it('keeps empty contact fields for new product defaults', () => {
    expect(DEFAULT_SCHEDULE.contactEmail).toBe('')
    expect(DEFAULT_SCHEDULE.contactPhone).toBe('')
    expect(DEFAULT_SCHEDULE.salonName).toBe('')
  })
})
