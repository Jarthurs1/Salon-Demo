/**
 * Nearby available slot suggestions for conflict recovery.
 * Reuses Phase 2 conflict/hours validation.
 */

import {
  findConflicts,
  getValidStartTimes,
  validateAppointmentSlot,
} from './conflictUtils.js'
import { parseTimeToMinutes, parseDateKey } from './dateUtils.js'
import { getScheduleSettings } from '../data/schedule.js'

/**
 * Find up to `limit` free start times on the same day, nearest to requested time.
 */
export function findNearbyAvailableSlots({
  date,
  startTime,
  durationMinutes,
  existing,
  limit = 3,
  settings = getScheduleSettings(),
} = {}) {
  const dateObj = typeof date === 'string' ? parseDateKey(date) : date
  const dateKey = typeof date === 'string' ? date : null
  const candidateDate =
    dateKey ??
    `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`

  const requested = parseTimeToMinutes(startTime)
  const times = getValidStartTimes(dateObj, durationMinutes, settings)

  const free = times.filter((time) => {
    if (time === startTime) return false
    const conflicts = findConflicts(
      { date: candidateDate, startTime: time, durationMinutes },
      existing,
    )
    if (conflicts.length > 0) return false

    const validation = validateAppointmentSlot(
      { date: candidateDate, startTime: time, durationMinutes },
      existing,
      { dateObj, settings },
    )
    return validation.ok
  })

  free.sort((a, b) => {
    const aMinutes = parseTimeToMinutes(a)
    const bMinutes = parseTimeToMinutes(b)
    if (aMinutes == null && bMinutes == null) return 0
    if (aMinutes == null) return 1
    if (bMinutes == null) return -1
    if (requested == null) return aMinutes - bMinutes
    return Math.abs(aMinutes - requested) - Math.abs(bMinutes - requested)
  })

  return free.slice(0, limit)
}
