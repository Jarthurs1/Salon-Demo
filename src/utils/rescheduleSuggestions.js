/**
 * Valid appointment START-TIME ranges for Reschedule Requested SMS.
 * Derived from free windows on the next two working days and the original duration.
 */

import {
  addDays,
  formatSelectedDate,
  minutesToTime,
  parseDateKey,
  parseTimeToMinutes,
  toDateKey,
} from './dateUtils.js'
import {
  getAppointmentEndMinutes,
  intervalsOverlap,
} from './conflictUtils.js'
import {
  getHoursForDate,
  getScheduleSettings,
  isClosedDay,
} from '../data/schedule.js'
import { getSalonDate } from '../reminders/salonTime.js'
import { doesAppointmentBlockAvailability } from './canceledAppointment.js'

const SLOT_INCREMENT = 15

function salonNowParts(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0)
  return { hour: hour === 24 ? 0 : hour, minute }
}

export function ceilToIncrement(minutes, increment = SLOT_INCREMENT) {
  if (!Number.isFinite(minutes)) return minutes
  return Math.ceil(minutes / increment) * increment
}

export function floorToIncrement(minutes, increment = SLOT_INCREMENT) {
  if (!Number.isFinite(minutes)) return minutes
  return Math.floor(minutes / increment) * increment
}

function mergeIntervals(intervals) {
  if (!intervals.length) return []
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end)
  const merged = [{ ...sorted[0] }]
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i]
    const last = merged[merged.length - 1]
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end)
    } else {
      merged.push({ ...current })
    }
  }
  return merged
}

function subtractBusyFromOpen(openStart, openEnd, busyIntervals) {
  const free = []
  let cursor = openStart
  for (const busy of mergeIntervals(busyIntervals)) {
    const start = Math.max(busy.start, openStart)
    const end = Math.min(busy.end, openEnd)
    if (end <= openStart || start >= openEnd) continue
    if (start > cursor) {
      free.push({ start: cursor, end: start })
    }
    cursor = Math.max(cursor, end)
  }
  if (cursor < openEnd) {
    free.push({ start: cursor, end: openEnd })
  }
  return free
}

function busyIntervalsForDate(dateKey, appointments) {
  const busy = []
  for (const appt of appointments || []) {
    if (appt?.date !== dateKey) continue
    // Keep the original reschedule-requested slot occupied (no excludeId).
    if (!doesAppointmentBlockAvailability(appt)) continue
    const start = parseTimeToMinutes(appt.startTime)
    const end = getAppointmentEndMinutes(appt)
    if (start == null || end == null || end <= start) continue
    busy.push({ start, end })
  }
  return busy
}

function formatClock(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return {
    label: `${hour12}:${String(m).padStart(2, '0')}`,
    period: h >= 12 ? 'PM' : 'AM',
  }
}

/**
 * Compact start-time label/range for SMS.
 * Single valid start → "11:00 AM"
 * Range → "8:00–8:45 AM" or "8:00 AM–4:00 PM"
 */
export function formatWindowRange(startMinutes, endMinutes) {
  if (!Number.isFinite(startMinutes)) return ''
  if (!Number.isFinite(endMinutes) || endMinutes === startMinutes) {
    const single = formatClock(startMinutes)
    return `${single.label} ${single.period}`
  }

  const startTime = minutesToTime(startMinutes)
  const endTime = minutesToTime(endMinutes)
  if (!startTime || !endTime) return ''

  const start = formatClock(startMinutes)
  const end = formatClock(endMinutes)
  if (start.period === end.period) {
    return `${start.label}–${end.label} ${end.period}`
  }
  return `${start.label} ${start.period}–${end.label} ${end.period}`
}

/**
 * Natural duration wording for SMS: "45-minute", "1-hour", "1-hour 30-minute".
 */
export function formatDurationForSms(durationMinutes) {
  const value = Number(durationMinutes)
  if (!Number.isFinite(value) || value <= 0) return 'appointment'

  if (value < 60) return `${value}-minute`

  const hours = Math.floor(value / 60)
  const rem = value % 60
  const hourPart = hours === 1 ? '1-hour' : `${hours}-hour`
  if (rem === 0) return hourPart
  return `${hourPart} ${rem}-minute`
}

/**
 * Convert a free occupancy window into a valid start-time range for `duration`.
 * @returns {{ earliestStartMinutes: number, latestStartMinutes: number, label: string } | null}
 */
export function toValidStartRange(window, durationMinutes, increment = SLOT_INCREMENT) {
  const duration = Number(durationMinutes)
  if (!window || !Number.isFinite(duration) || duration <= 0) return null
  if (window.end - window.start < duration) return null

  const earliest = ceilToIncrement(window.start, increment)
  const latest = floorToIncrement(window.end - duration, increment)
  if (!Number.isFinite(earliest) || !Number.isFinite(latest) || earliest > latest) {
    return null
  }
  // Guard: appointment must still finish inside the free window.
  if (latest + duration > window.end) return null

  return {
    earliestStartMinutes: earliest,
    latestStartMinutes: latest,
    // Back-compat fields used by older tests/callers.
    startMinutes: earliest,
    endMinutes: latest,
    label: formatWindowRange(earliest, latest),
  }
}

/**
 * Valid start-time ranges on a single day for `durationMinutes`.
 * @returns {Array<{ earliestStartMinutes: number, latestStartMinutes: number, label: string }>}
 */
export function findDayAvailabilityWindows({
  dateKey,
  durationMinutes,
  appointments = [],
  now = new Date(),
  settings = getScheduleSettings(),
} = {}) {
  const duration = Number(durationMinutes)
  if (!dateKey || !Number.isFinite(duration) || duration <= 0) return []

  const day = parseDateKey(dateKey)
  if (isClosedDay(day, settings)) return []

  const hours = getHoursForDate(day, settings)
  if (!hours || hours.closed) return []

  const openStart = parseTimeToMinutes(hours.start)
  const openEnd = parseTimeToMinutes(hours.end)
  if (openStart == null || openEnd == null || openEnd <= openStart) return []

  const timeZone = settings.timezone || 'America/New_York'
  const salonTodayKey = getSalonDate(now, timeZone)
  let effectiveOpenStart = openStart
  if (dateKey === salonTodayKey) {
    const { hour, minute } = salonNowParts(now, timeZone)
    const nowMinutes = hour * 60 + minute
    effectiveOpenStart = Math.max(openStart, ceilToIncrement(nowMinutes + 1))
    if (effectiveOpenStart >= openEnd) return []
  }

  const busy = busyIntervalsForDate(dateKey, appointments).filter((interval) =>
    intervalsOverlap(effectiveOpenStart, openEnd, interval.start, interval.end),
  )
  const free = subtractBusyFromOpen(effectiveOpenStart, openEnd, busy)

  return free
    .map((window) => toValidStartRange(window, duration))
    .filter(Boolean)
}

/**
 * Next up-to-two working days with qualifying valid start ranges.
 *
 * @returns {Array<{ date: string, dateLabel: string, windows: Array }>}
 */
export function findRescheduleSuggestions({
  durationMinutes,
  appointments = [],
  now = new Date(),
  settings = getScheduleSettings(),
  workingDayLimit = 2,
  searchDays = 30,
} = {}) {
  const duration = Number(durationMinutes)
  if (!Number.isFinite(duration) || duration <= 0) return []

  const timeZone = settings.timezone || 'America/New_York'
  const salonTodayKey = getSalonDate(now, timeZone)
  const startDate = parseDateKey(salonTodayKey)
  const results = []

  for (let offset = 0; offset < searchDays && results.length < workingDayLimit; offset += 1) {
    const day = addDays(startDate, offset)
    if (isClosedDay(day, settings)) continue
    const dateKey = toDateKey(day)
    const windows = findDayAvailabilityWindows({
      dateKey,
      durationMinutes: duration,
      appointments,
      now,
      settings,
    })
    if (!windows.length) continue
    results.push({
      date: dateKey,
      dateLabel: formatSelectedDate(day),
      windows,
    })
  }

  return results
}

export function formatSuggestionLabel(slot) {
  if (slot?.label) return slot.label
  if (slot?.earliestStartMinutes != null) {
    return formatWindowRange(
      slot.earliestStartMinutes,
      slot.latestStartMinutes ?? slot.earliestStartMinutes,
    )
  }
  if (slot?.startMinutes != null) {
    return formatWindowRange(slot.startMinutes, slot.endMinutes ?? slot.startMinutes)
  }
  return ''
}
