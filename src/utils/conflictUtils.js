/**
 * Scheduling conflict + working-hours validation.
 */

import {
  parseTimeToMinutes,
  formatTimeDisplay,
  minutesToTime,
  normalizeTimeTo24h,
  isValidTimeString,
} from './dateUtils.js'
import {
  getHoursForDate,
  getCalendarDisplayHours,
  isClosedDay,
  getScheduleSettings,
  DAY_END_MINUTES,
  EXTENDED_BOOKING_START,
  EXTENDED_BOOKING_END,
} from '../data/schedule.js'
import { doesAppointmentBlockAvailability } from './canceledAppointment.js'

/** Half-open interval overlap: [startA, endA) overlaps [startB, endB) */
export function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA
}

export function getAppointmentEndMinutes(appointment) {
  const start = parseTimeToMinutes(appointment.startTime)
  if (start == null) return null
  return start + Number(appointment.durationMinutes)
}

export function formatAppointmentWindow(appointment) {
  const startMinutes = parseTimeToMinutes(appointment.startTime)
  const endMinutes = getAppointmentEndMinutes(appointment)
  if (startMinutes == null || endMinutes == null) return 'Unknown time'
  const start = formatTimeDisplay(appointment.startTime)
  const end = formatTimeDisplay(minutesToTime(endMinutes))
  return `${start}–${end}`
}

/**
 * Find overlapping appointments/blocks on the same date.
 * @param {object} candidate - { date, startTime, durationMinutes }
 * @param {object[]} existing
 * @param {{ excludeId?: string }} [options]
 */
export function findConflicts(candidate, existing, options = {}) {
  const { excludeId } = options
  const start = parseTimeToMinutes(candidate.startTime)
  if (start == null) return []
  const end = start + Number(candidate.durationMinutes)

  return existing.filter((appt) => {
    if (excludeId && appt.id === excludeId) return false
    if (appt.date !== candidate.date) return false
    // Canceled appointments only block while their slot is still held.
    if (!doesAppointmentBlockAvailability(appt)) return false
    const otherStart = parseTimeToMinutes(appt.startTime)
    if (otherStart == null) return false
    const otherEnd = getAppointmentEndMinutes(appt)
    if (otherEnd == null) return false
    return intervalsOverlap(start, end, otherStart, otherEnd)
  })
}

export function describeConflict(conflict) {
  const window = formatAppointmentWindow(conflict)
  if (conflict.type === 'blocked' || conflict.status === 'blocked') {
    return `${conflict.service || 'Blocked time'} is scheduled from ${window}.`
  }
  const name = conflict.clientName || 'A client'
  return `${name} is scheduled from ${window}.`
}

/**
 * Validate working hours + conflicts before save.
 * @returns {{ ok: true } | { ok: false, code: string, message: string, conflicts?: object[] }}
 */
export function validateAppointmentSlot(candidate, existing, options = {}) {
  const settings = options.settings ?? getScheduleSettings()
  const excludeId = options.excludeId
  const date = options.dateObj ?? parseLocalDate(candidate.date)

  const hours = getHoursForDate(date, settings)
  const allowOutsideHours = Boolean(options.ignoreWorkingHours)

  if (
    !allowOutsideHours &&
    ((isClosedDay(date, settings) && !settings.allowClosedDayOverride) ||
      hours.closed)
  ) {
    return {
      ok: false,
      code: 'closed_day',
      message: 'This day is closed on the salon schedule.',
    }
  }

  const openStart = parseTimeToMinutes(hours.start)
  const openEnd = parseTimeToMinutes(hours.end)
  const start = parseTimeToMinutes(candidate.startTime)

  if (start == null || !Number.isFinite(Number(candidate.durationMinutes))) {
    return {
      ok: false,
      code: 'invalid_time',
      message: 'Please select an appointment time.',
    }
  }

  const end = start + Number(candidate.durationMinutes)

  if (end > DAY_END_MINUTES) {
    return {
      ok: false,
      code: 'crosses_midnight',
      message:
        'Appointments must end by midnight. Choose an earlier start time or a shorter duration.',
    }
  }

  if (!allowOutsideHours) {
    if (openStart != null && start < openStart) {
      return {
        ok: false,
        code: 'before_open',
        message: `Appointments cannot start before ${formatTimeDisplay(hours.start)}.`,
      }
    }

    if (openEnd != null && end > openEnd) {
      return {
        ok: false,
        code: 'after_close',
        message: `That appointment would end after closing at ${formatTimeDisplay(hours.end)}.`,
      }
    }
  }

  const conflicts = findConflicts(candidate, existing, { excludeId })
  if (conflicts.length > 0) {
    const primary = conflicts[0]
    return {
      ok: false,
      code: 'conflict',
      message: 'That time overlaps an existing appointment.',
      detail: describeConflict(primary),
      conflicts,
    }
  }

  return { ok: true }
}

function parseLocalDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Start-time options in 15-minute increments that fit duration within hours.
 */
export function getValidStartTimes(date, durationMinutes, settings = getScheduleSettings()) {
  const hours = getCalendarDisplayHours(date, settings)
  if (hours.closed) return []

  const openStart = parseTimeToMinutes(hours.start)
  const openEnd = parseTimeToMinutes(hours.end)
  const duration = Number(durationMinutes)
  if (openStart == null || openEnd == null || !Number.isFinite(duration)) {
    return []
  }
  const times = []

  for (let minutes = openStart; minutes + duration <= openEnd; minutes += 15) {
    const label = minutesToTime(minutes)
    if (label) times.push(label)
  }
  return times
}

/**
 * Working-hour span in minutes for a date, or null if closed.
 */
export function getWorkingDayDurationMinutes(date, settings = getScheduleSettings()) {
  const hours = getHoursForDate(date, settings)
  if (hours.closed) return null
  const openStart = parseTimeToMinutes(hours.start)
  const openEnd = parseTimeToMinutes(hours.end)
  if (openStart == null || openEnd == null || openEnd <= openStart) return null
  return openEnd - openStart
}

/**
 * True when a block covers the full scheduled working day.
 */
export function isFullDayBlock(appointment, settings = getScheduleSettings()) {
  if (!appointment || (appointment.type !== 'blocked' && appointment.status !== 'blocked')) {
    return false
  }
  const date = parseLocalDate(appointment.date)
  const hours = getHoursForDate(date, settings)
  if (hours.closed) return false
  const duration = getWorkingDayDurationMinutes(date, settings)
  return (
    appointment.startTime === hours.start &&
    Number(appointment.durationMinutes) === duration
  )
}

/**
 * Start-time options in 15-minute increments within an explicit time range
 * (used for out-of-hours booking without expanding Calendar availability).
 */
function parseRangeBoundary(time, { endOfDay = false } = {}) {
  if (endOfDay && (time === '24:00' || time === '24:00:00')) {
    return DAY_END_MINUTES
  }
  return parseTimeToMinutes(time)
}

export function getValidStartTimesInRange(
  durationMinutes,
  rangeStart = EXTENDED_BOOKING_START,
  rangeEnd = EXTENDED_BOOKING_END,
) {
  const openStart = parseRangeBoundary(rangeStart)
  const openEnd = parseRangeBoundary(rangeEnd, { endOfDay: true })
  const duration = Number(durationMinutes)
  if (openStart == null || openEnd == null || !Number.isFinite(duration)) {
    return []
  }
  const times = []
  for (let minutes = openStart; minutes + duration <= openEnd; minutes += 15) {
    const label = minutesToTime(minutes)
    if (label) times.push(label)
  }
  return times
}

/**
 * Start times that fit hours AND do not conflict with existing appointments/blocks.
 */
export function getAvailableStartTimes(
  date,
  durationMinutes,
  existing,
  options = {},
) {
  const settings = options.settings ?? getScheduleSettings()
  const dateKey =
    typeof date === 'string' ? date : toDateKeyFromDate(date)
  const dateObj = typeof date === 'string' ? parseLocalDate(date) : date
  const candidates = options.allowOutsideHours
    ? getValidStartTimesInRange(
        durationMinutes,
        options.outsideStart || EXTENDED_BOOKING_START,
        options.outsideEnd || EXTENDED_BOOKING_END,
      )
    : getValidStartTimes(dateObj, durationMinutes, settings)

  return candidates.filter((startTime) => {
    const result = validateAppointmentSlot(
      { date: dateKey, startTime, durationMinutes: Number(durationMinutes) },
      existing,
      {
        ...options,
        dateObj,
        settings,
        // Out-of-hours bookings skip the working-hours enclosure check.
        ignoreWorkingHours: Boolean(options.allowOutsideHours),
      },
    )
    return result.ok
  })
}

function toDateKeyFromDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export { normalizeTimeTo24h, isValidTimeString }
