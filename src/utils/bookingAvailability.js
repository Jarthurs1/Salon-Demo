/**
 * Booking-day availability helpers for Book date picker + Calendar→Book.
 */

import { toDateKey, isPastDay, startOfDay } from './dateUtils.js'
import {
  isClosedDay,
  getScheduleSettings,
  EXTENDED_BOOKING_START,
  EXTENDED_BOOKING_END,
} from '../data/schedule.js'
import {
  getAvailableStartTimes,
  isFullDayBlock,
} from './conflictUtils.js'

const MIN_BOOKABLE_DURATION = 30

/**
 * True when the calendar date can accept at least one appointment start.
 * False for: past days, closed days, full-day blocks, or no remaining open slots.
 */
export function isDateBookable(
  date,
  appointments,
  options = {},
) {
  const settings = options.settings ?? getScheduleSettings()
  const today = options.today ?? startOfDay(new Date())
  const dateObj = date instanceof Date ? startOfDay(date) : startOfDay(date)
  const minDuration = options.minDurationMinutes ?? MIN_BOOKABLE_DURATION

  if (isPastDay(dateObj, today)) return false
  if (isClosedDay(dateObj, settings)) return false

  const dateKey = toDateKey(dateObj)
  const dayAppointments = (appointments || []).filter((a) => a.date === dateKey)

  if (dayAppointments.some((a) => isFullDayBlock(a, settings))) {
    return false
  }

  const inHours = getAvailableStartTimes(dateObj, minDuration, dayAppointments, {
    settings,
  })
  if (inHours.length > 0) return true

  // Allow booking days that only have outside-hours openings (house calls, etc.).
  if (options.allowOutsideHours !== false) {
    const outside = getAvailableStartTimes(
      dateObj,
      minDuration,
      dayAppointments,
      {
        settings,
        allowOutsideHours: true,
        outsideStart: EXTENDED_BOOKING_START,
        outsideEnd: EXTENDED_BOOKING_END,
      },
    )
    return outside.length > 0
  }
  return false
}

/**
 * Reason a date is not bookable (for labels / tests).
 * @returns {'past' | 'closed' | 'full_day_block' | 'no_availability' | null}
 */
export function getDateUnbookableReason(date, appointments, options = {}) {
  const settings = options.settings ?? getScheduleSettings()
  const today = options.today ?? startOfDay(new Date())
  const dateObj = date instanceof Date ? startOfDay(date) : startOfDay(date)
  const minDuration = options.minDurationMinutes ?? MIN_BOOKABLE_DURATION

  if (isPastDay(dateObj, today)) return 'past'
  if (isClosedDay(dateObj, settings)) return 'closed'

  const dateKey = toDateKey(dateObj)
  const dayAppointments = (appointments || []).filter((a) => a.date === dateKey)

  if (dayAppointments.some((a) => isFullDayBlock(a, settings))) {
    return 'full_day_block'
  }

  const times = getAvailableStartTimes(dateObj, minDuration, dayAppointments, {
    settings,
  })
  if (times.length === 0) return 'no_availability'
  return null
}
