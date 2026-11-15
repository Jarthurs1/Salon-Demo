import { describe, it, expect } from 'vitest'
import {
  intervalsOverlap,
  findConflicts,
  validateAppointmentSlot,
  getValidStartTimes,
  describeConflict,
} from './conflictUtils.js'
import { scheduleSettings } from '../data/schedule.js'

describe('intervalsOverlap', () => {
  it('detects overlapping intervals', () => {
    expect(intervalsOverlap(600, 690, 630, 720)).toBe(true)
  })

  it('allows back-to-back appointments (end equals start)', () => {
    expect(intervalsOverlap(540, 600, 600, 660)).toBe(false)
    expect(intervalsOverlap(600, 660, 540, 600)).toBe(false)
  })

  it('detects containment', () => {
    expect(intervalsOverlap(540, 720, 600, 630)).toBe(true)
  })
})

describe('findConflicts', () => {
  const existing = [
    {
      id: 'a1',
      date: '2026-09-24',
      startTime: '10:00',
      durationMinutes: 90,
      clientName: 'Emily Chen',
      type: 'appointment',
      status: 'pending',
      service: 'Color & Cut',
    },
  ]

  it('rejects overlapping start', () => {
    const conflicts = findConflicts(
      { date: '2026-09-24', startTime: '11:00', durationMinutes: 60 },
      existing,
    )
    expect(conflicts).toHaveLength(1)
  })

  it('allows start exactly at previous end', () => {
    const conflicts = findConflicts(
      { date: '2026-09-24', startTime: '11:30', durationMinutes: 60 },
      existing,
    )
    expect(conflicts).toHaveLength(0)
  })

  it('ignores self when excludeId is set', () => {
    const conflicts = findConflicts(
      { date: '2026-09-24', startTime: '10:00', durationMinutes: 90 },
      existing,
      { excludeId: 'a1' },
    )
    expect(conflicts).toHaveLength(0)
  })

  it('ignores released canceled appointments so the slot is bookable again', () => {
    const conflicts = findConflicts(
      { date: '2026-09-24', startTime: '10:00', durationMinutes: 90 },
      [
        {
          ...existing[0],
          status: 'canceled',
          canceledAt: '2026-09-20T12:00:00.000Z',
          slotReleasedAt: '2026-09-20T12:05:00.000Z',
        },
      ],
    )
    expect(conflicts).toHaveLength(0)
  })

  it('keeps held canceled appointments blocking the slot', () => {
    const conflicts = findConflicts(
      { date: '2026-09-24', startTime: '10:00', durationMinutes: 90 },
      [
        {
          ...existing[0],
          status: 'canceled',
          canceledAt: '2026-09-20T12:00:00.000Z',
          slotReleasedAt: null,
        },
      ],
    )
    expect(conflicts).toHaveLength(1)
  })
})

describe('validateAppointmentSlot', () => {
  const thursday = new Date(2026, 8, 24) // Thursday
  const saturday = new Date(2026, 8, 26)

  it('rejects appointments past closing time', () => {
    const result = validateAppointmentSlot(
      { date: '2026-09-24', startTime: '17:30', durationMinutes: 60 },
      [],
      { dateObj: thursday, settings: scheduleSettings },
    )
    expect(result.ok).toBe(false)
    expect(result.code).toBe('after_close')
  })

  it('rejects closed days', () => {
    const result = validateAppointmentSlot(
      { date: '2026-09-26', startTime: '10:00', durationMinutes: 60 },
      [],
      { dateObj: saturday, settings: scheduleSettings },
    )
    expect(result.ok).toBe(false)
    expect(result.code).toBe('closed_day')
  })

  it('returns friendly conflict detail', () => {
    const existing = [
      {
        id: 'a1',
        date: '2026-09-24',
        startTime: '10:00',
        durationMinutes: 90,
        clientName: 'Emily Chen',
        type: 'appointment',
        status: 'pending',
        service: 'Color',
      },
    ]
    const result = validateAppointmentSlot(
      { date: '2026-09-24', startTime: '11:00', durationMinutes: 60 },
      existing,
      { dateObj: thursday, settings: scheduleSettings },
    )
    expect(result.ok).toBe(false)
    expect(result.message).toBe('That time overlaps an existing appointment.')
    expect(result.detail).toContain('Emily Chen')
  })

  it('allows valid slots', () => {
    const result = validateAppointmentSlot(
      { date: '2026-09-24', startTime: '09:00', durationMinutes: 60 },
      [],
      { dateObj: thursday, settings: scheduleSettings },
    )
    expect(result.ok).toBe(true)
  })

  it('rejects corrupt NaN start times', () => {
    const result = validateAppointmentSlot(
      { date: '2026-09-24', startTime: 'NaN:NaN', durationMinutes: 60 },
      [],
      { dateObj: thursday, settings: scheduleSettings },
    )
    expect(result.ok).toBe(false)
    expect(result.code).toBe('invalid_time')
  })
})

describe('getValidStartTimes', () => {
  it('returns 15-minute increments within calendar display hours', () => {
    const thursday = new Date(2026, 8, 24)
    const times = getValidStartTimes(thursday, 60, scheduleSettings)
    expect(times[0]).toBe('08:00')
    expect(times).toContain('09:15')
    expect(times).toContain('17:00')
    expect(times).not.toContain('17:15')
  })

  it('returns empty on closed days', () => {
    const saturday = new Date(2026, 8, 26)
    expect(getValidStartTimes(saturday, 60, scheduleSettings)).toEqual([])
  })
})

describe('describeConflict', () => {
  it('describes blocked time', () => {
    const text = describeConflict({
      type: 'blocked',
      status: 'blocked',
      service: 'Lunch',
      startTime: '12:00',
      durationMinutes: 60,
    })
    expect(text).toContain('Lunch')
    expect(text).toContain('12:00 PM')
  })
})
