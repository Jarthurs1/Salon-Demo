import { describe, it, expect } from 'vitest'
import {
  getWeekStart,
  getWeekDays,
  canGoToPreviousWeek,
  canGoToNextWeek,
  getEarliestWeekStart,
  getLatestWeekStart,
  addWeeks,
  toDateKey,
  isSameDay,
  isPastDay,
  getFirstValidDay,
  formatDuration,
  formatTimeDisplay,
  startOfDay,
  minutesToTime,
  parseTimeToMinutes,
  normalizeTimeTo24h,
  isValidTimeString,
} from './dateUtils.js'

describe('getWeekStart', () => {
  it('returns Monday for a mid-week date', () => {
    const wed = new Date(2026, 8, 23)
    const monday = getWeekStart(wed)
    expect(monday.getDay()).toBe(1)
    expect(toDateKey(monday)).toBe('2026-09-21')
  })

  it('returns Monday when given a Sunday', () => {
    const sun = new Date(2026, 8, 27)
    expect(toDateKey(getWeekStart(sun))).toBe('2026-09-21')
  })

  it('returns the same Monday when given Monday', () => {
    const mon = new Date(2026, 8, 21)
    expect(toDateKey(getWeekStart(mon))).toBe('2026-09-21')
  })
})

describe('getWeekDays', () => {
  it('returns seven days Mon–Sun', () => {
    const days = getWeekDays(new Date(2026, 8, 23))
    expect(days).toHaveLength(7)
    expect(days[0].getDay()).toBe(1)
    expect(days[6].getDay()).toBe(0)
    expect(toDateKey(days[0])).toBe('2026-09-21')
    expect(toDateKey(days[6])).toBe('2026-09-27')
  })
})

describe('week navigation', () => {
  it('does not allow navigating before the current week', () => {
    const today = new Date(2026, 8, 23)
    const currentWeek = getEarliestWeekStart(today)
    expect(canGoToPreviousWeek(currentWeek, today)).toBe(false)
  })

  it('allows navigating back from a future week to the current week', () => {
    const today = new Date(2026, 8, 23)
    const nextWeek = addWeeks(getWeekStart(today), 1)
    expect(canGoToPreviousWeek(nextWeek, today)).toBe(true)
  })

  it('blocks going earlier than earliest week start', () => {
    const today = new Date(2026, 8, 23)
    const pastWeek = addWeeks(getWeekStart(today), -1)
    expect(canGoToPreviousWeek(pastWeek, today)).toBe(false)
  })

  it('limits forward navigation to about 12 months', () => {
    const today = new Date(2026, 8, 23)
    const latest = getLatestWeekStart(today, 52)
    expect(canGoToNextWeek(latest, today, 52)).toBe(false)
    expect(canGoToNextWeek(addWeeks(latest, -1), today, 52)).toBe(true)
  })
})

describe('past days', () => {
  it('marks days before today as past', () => {
    const today = new Date(2026, 8, 24)
    expect(isPastDay(new Date(2026, 8, 23), today)).toBe(true)
    expect(isPastDay(today, today)).toBe(false)
  })

  it('picks first valid day in a week', () => {
    const today = new Date(2026, 8, 24) // Thursday
    const days = getWeekDays(today)
    const first = getFirstValidDay(days, today)
    expect(toDateKey(first)).toBe('2026-09-24')
  })
})

describe('formatting helpers', () => {
  it('formats durations compactly', () => {
    expect(formatDuration(30)).toBe('30 min')
    expect(formatDuration(60)).toBe('1 hr')
    expect(formatDuration(90)).toBe('1 hr 30 min')
    expect(formatDuration(120)).toBe('2 hr')
  })

  it('formats times in 12-hour clock', () => {
    expect(formatTimeDisplay('09:00')).toBe('9:00 AM')
    expect(formatTimeDisplay('12:00')).toBe('12:00 PM')
    expect(formatTimeDisplay('13:00')).toBe('1:00 PM')
    expect(formatTimeDisplay('15:30')).toBe('3:30 PM')
  })

  it('never renders NaN for invalid times', () => {
    expect(formatTimeDisplay('NaN:NaN')).toBe('—')
    expect(formatTimeDisplay(null)).toBe('—')
    expect(formatTimeDisplay('')).toBe('—')
    expect(minutesToTime(Number.NaN)).toBe(null)
    expect(parseTimeToMinutes('NaN:NaN')).toBe(null)
    expect(isValidTimeString('NaN:NaN')).toBe(false)
  })

  it('normalizes spoken AM/PM times to 24h', () => {
    expect(normalizeTimeTo24h('1pm')).toBe('13:00')
    expect(normalizeTimeTo24h('1 PM')).toBe('13:00')
    expect(normalizeTimeTo24h('1:00 PM')).toBe('13:00')
    expect(normalizeTimeTo24h('13:00')).toBe('13:00')
  })

  it('converts minutes to HH:MM', () => {
    expect(minutesToTime(0)).toBe('00:00')
    expect(minutesToTime(570)).toBe('09:30')
    expect(parseTimeToMinutes('09:30')).toBe(570)
  })
})

describe('day comparison', () => {
  it('treats same calendar day as equal ignoring time', () => {
    const a = new Date(2026, 8, 23, 8, 0)
    const b = new Date(2026, 8, 23, 20, 0)
    expect(isSameDay(a, b)).toBe(true)
    expect(startOfDay(a).getHours()).toBe(0)
  })
})
