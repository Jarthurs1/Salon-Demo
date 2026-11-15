import { describe, it, expect } from 'vitest'
import {
  getAvailableStartTimes,
  getWorkingDayDurationMinutes,
  isFullDayBlock,
  validateAppointmentSlot,
} from './conflictUtils.js'
import { isDateBookable, getDateUnbookableReason } from './bookingAvailability.js'
import { parseDateKey, toDateKey, startOfDay, getMonthGridDays } from './dateUtils.js'
import { DEFAULT_SCHEDULE } from '../data/scheduleDefaults.js'
import { getDefaultDurationForService, SERVICE_OPTIONS } from '../data/services.js'
import { BLOCK_DURATION_OPTIONS } from '../data/schedule.js'
import {
  buildDemoAppointments,
  DEMO_CLIENTS,
  isObviousTestClient,
} from '../data/demoSeed.js'

const tuesday = parseDateKey('2026-09-22') // Tuesday open 08-18
const saturday = parseDateKey('2026-09-26') // Saturday closed
const todayRef = startOfDay(parseDateKey('2026-09-20')) // Sunday before that week

describe('service defaults', () => {
  it('provides default durations for catalog services', () => {
    expect(SERVICE_OPTIONS.length).toBeGreaterThanOrEqual(5)
    expect(getDefaultDurationForService('Haircut')).toBe(45)
    expect(getDefaultDurationForService('Color')).toBe(120)
    expect(getDefaultDurationForService('Bridal / Wedding')).toBe(240)
    expect(getDefaultDurationForService('Other')).toBe(60)
  })
})

describe('available start times', () => {
  it('excludes times that conflict with existing appointments', () => {
    const existing = [
      {
        id: 'a1',
        date: '2026-09-22',
        startTime: '10:00',
        durationMinutes: 60,
        type: 'appointment',
        status: 'confirmed',
      },
    ]
    const times = getAvailableStartTimes(tuesday, 60, existing, {
      settings: DEFAULT_SCHEDULE,
    })
    expect(times).toContain('08:00')
    expect(times).toContain('09:00')
    expect(times).not.toContain('10:00')
    expect(times).not.toContain('10:15')
  })

  it('returns empty on closed days', () => {
    expect(
      getAvailableStartTimes(saturday, 60, [], { settings: DEFAULT_SCHEDULE }),
    ).toEqual([])
  })
})

describe('bookable dates', () => {
  it('marks closed days unbookable for Calendar availability', () => {
    expect(
      isDateBookable(saturday, [], {
        settings: DEFAULT_SCHEDULE,
        today: todayRef,
      }),
    ).toBe(false)
    expect(
      getDateUnbookableReason(saturday, [], {
        settings: DEFAULT_SCHEDULE,
        today: todayRef,
      }),
    ).toBe('closed')
  })

  it('marks past days unbookable', () => {
    const past = parseDateKey('2026-09-15')
    expect(
      isDateBookable(past, [], {
        settings: DEFAULT_SCHEDULE,
        today: todayRef,
      }),
    ).toBe(false)
    expect(
      getDateUnbookableReason(past, [], {
        settings: DEFAULT_SCHEDULE,
        today: todayRef,
      }),
    ).toBe('past')
  })

  it('marks full-day blocked dates unbookable', () => {
    const fullDay = {
      id: 'block-full',
      type: 'blocked',
      status: 'blocked',
      date: '2026-09-22',
      startTime: '08:00',
      durationMinutes: 600,
    }
    expect(isFullDayBlock(fullDay, DEFAULT_SCHEDULE)).toBe(true)
    expect(
      isDateBookable(tuesday, [fullDay], {
        settings: DEFAULT_SCHEDULE,
        today: todayRef,
      }),
    ).toBe(false)
    expect(
      getDateUnbookableReason(tuesday, [fullDay], {
        settings: DEFAULT_SCHEDULE,
        today: todayRef,
      }),
    ).toBe('full_day_block')
  })

  it('keeps partially blocked open days bookable', () => {
    const morningBlock = {
      id: 'block-am',
      type: 'blocked',
      status: 'blocked',
      date: '2026-09-22',
      startTime: '09:00',
      durationMinutes: 180,
      service: 'Unavailable',
    }
    expect(
      isDateBookable(tuesday, [morningBlock], {
        settings: DEFAULT_SCHEDULE,
        today: todayRef,
      }),
    ).toBe(true)
    expect(
      getAvailableStartTimes(tuesday, 60, [morningBlock], {
        settings: DEFAULT_SCHEDULE,
      }).length,
    ).toBeGreaterThan(0)
  })

  it('marks open days with remaining slots bookable', () => {
    expect(
      isDateBookable(tuesday, [], {
        settings: DEFAULT_SCHEDULE,
        today: todayRef,
      }),
    ).toBe(true)
  })
})

describe('calendar available slot → book prefill shape', () => {
  it('uses the gap start time as the book start time', () => {
    const slot = { startTime: '14:00', endTime: '16:00', durationMinutes: 120 }
    const prefill = {
      date: toDateKey(tuesday),
      startTime: slot.startTime,
    }
    expect(prefill).toEqual({ date: '2026-09-22', startTime: '14:00' })
  })
})

describe('book month calendar grid', () => {
  it('builds a monday-start month grid with in-month flags', () => {
    const cells = getMonthGridDays(parseDateKey('2026-09-15'))
    expect(cells.length % 7).toBe(0)
    expect(cells[0].date.getDay()).toBe(1) // Monday
    expect(cells.some((c) => c.inMonth && toDateKey(c.date) === '2026-09-01')).toBe(
      true,
    )
    expect(cells.some((c) => c.inMonth && toDateKey(c.date) === '2026-09-30')).toBe(
      true,
    )
    expect(
      cells.filter((c) => toDateKey(c.date) === '2026-08-31').every((c) => !c.inMonth),
    ).toBe(true)
  })
})

describe('block time / full day', () => {
  it('exposes 30/60/120/180/240/full presets', () => {
    const minutes = BLOCK_DURATION_OPTIONS.map((o) => o.minutes)
    expect(minutes).toEqual([30, 60, 120, 180, 240, 'full'])
  })

  it('computes full-day duration from working hours', () => {
    expect(getWorkingDayDurationMinutes(tuesday, DEFAULT_SCHEDULE)).toBe(10 * 60)
    expect(getWorkingDayDurationMinutes(saturday, DEFAULT_SCHEDULE)).toBeNull()
  })

  it('detects full-day blocks', () => {
    const block = {
      type: 'blocked',
      status: 'blocked',
      date: '2026-09-22',
      startTime: '08:00',
      durationMinutes: 600,
    }
    expect(isFullDayBlock(block, DEFAULT_SCHEDULE)).toBe(true)
  })

  it('rejects booking on closed day via validation unless outside-hours override', () => {
    const result = validateAppointmentSlot(
      { date: '2026-09-26', startTime: '10:00', durationMinutes: 60 },
      [],
      { dateObj: saturday, settings: DEFAULT_SCHEDULE },
    )
    expect(result.ok).toBe(false)
    expect(result.code).toBe('closed_day')

    const allowed = validateAppointmentSlot(
      { date: '2026-09-26', startTime: '10:00', durationMinutes: 60 },
      [],
      {
        dateObj: saturday,
        settings: DEFAULT_SCHEDULE,
        ignoreWorkingHours: true,
      },
    )
    expect(allowed.ok).toBe(true)
  })

  it('rejects partial block beyond closing', () => {
    const result = validateAppointmentSlot(
      { date: '2026-09-22', startTime: '17:00', durationMinutes: 120 },
      [],
      { dateObj: tuesday, settings: DEFAULT_SCHEDULE },
    )
    expect(result.ok).toBe(false)
    expect(result.code).toBe('after_close')
  })

  it('rejects appointments that cross midnight', () => {
    const result = validateAppointmentSlot(
      { date: '2026-09-22', startTime: '22:00', durationMinutes: 180 },
      [],
      {
        dateObj: tuesday,
        settings: DEFAULT_SCHEDULE,
        ignoreWorkingHours: true,
      },
    )
    expect(result.ok).toBe(false)
    expect(result.code).toBe('crosses_midnight')
  })

  it('rejects partial block that conflicts with appointment', () => {
    const existing = [
      {
        id: 'busy',
        date: '2026-09-22',
        startTime: '10:00',
        durationMinutes: 60,
        type: 'appointment',
        status: 'pending',
        clientName: 'Emily',
      },
    ]
    const result = validateAppointmentSlot(
      { date: '2026-09-22', startTime: '10:00', durationMinutes: 60 },
      existing,
      { dateObj: tuesday, settings: DEFAULT_SCHEDULE },
    )
    expect(result.ok).toBe(false)
    expect(result.code).toBe('conflict')
  })
})

describe('demo seed', () => {
  it('builds realistic clients and appointments with example.com emails', () => {
    expect(DEMO_CLIENTS.length).toBeGreaterThanOrEqual(8)
    for (const client of DEMO_CLIENTS) {
      expect(client.email).toMatch(/@example\.com$/)
    }
    const appointments = buildDemoAppointments(new Date('2026-09-23T12:00:00'))
    expect(appointments.length).toBeGreaterThanOrEqual(10)
    expect(appointments.some((a) => a.status === 'pending')).toBe(true)
    expect(appointments.some((a) => a.status === 'confirmed')).toBe(true)
    expect(appointments.some((a) => a.type === 'blocked')).toBe(true)
    const dates = appointments.map((a) => a.date).sort()
    expect(dates[dates.length - 1] <= '2027-12-31').toBe(true)
    expect(dates.some((date) => date.startsWith('2027-12'))).toBe(true)
    expect(new Set(appointments.map((a) => a.id)).size).toBe(appointments.length)
  })

  it('identifies obvious test clients', () => {
    expect(
      isObviousTestClient({
        firstName: 'AWS',
        lastName: 'Test Client',
        email: 'aws-test-client@example.com',
      }),
    ).toBe(true)
    expect(
      isObviousTestClient({
        firstName: 'Emily',
        lastName: 'Carter',
        email: 'emily.carter@example.com',
      }),
    ).toBe(false)
  })
})
