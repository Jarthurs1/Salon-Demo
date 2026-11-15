/**
 * Build a clean day timeline: appointments + meaningful AVAILABLE gaps.
 * Available gaps stay within working/display hours; out-of-hours appointments
 * still appear chronologically without expanding all-day availability.
 */

import {
  parseTimeToMinutes,
  minutesToTime,
  formatTimeDisplay,
} from './dateUtils.js'
import { getAppointmentEndMinutes } from './conflictUtils.js'
import { getCalendarDisplayHours } from '../data/schedule.js'
import {
  isCanceledAppointment,
  isCanceledVisibleOnCalendar,
} from './canceledAppointment.js'

const MIN_GAP_MINUTES = 15

/**
 * Active calendar schedule: keep canceled appointments that still hold their
 * slot; hide ones the stylist has released.
 */
export function getActiveScheduleAppointments(appointments) {
  return (appointments || []).filter((appointment) => {
    if (isCanceledAppointment(appointment)) {
      return isCanceledVisibleOnCalendar(appointment)
    }
    return true
  })
}

/**
 * @returns {Array<
 *   | { type: 'appointment', appointment: object, startMinutes: number, endMinutes: number }
 *   | { type: 'available', startTime: string, endTime: string, startMinutes: number, endMinutes: number, durationMinutes: number }
 * >}
 */

export function buildDayTimeline(appointments, date, settings) {
  const hours = getCalendarDisplayHours(date, settings)
  const sorted = [...getActiveScheduleAppointments(appointments)].sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  )

  // Closed days: show appointments only (no available-slot expansion).
  if (hours.closed) {
    return sorted
      .map((appointment) => {
        const startMinutes = parseTimeToMinutes(appointment.startTime)
        const endMinutes = getAppointmentEndMinutes(appointment)
        if (startMinutes == null || endMinutes == null) return null
        return {
          type: 'appointment',
          appointment,
          startMinutes,
          endMinutes,
        }
      })
      .filter(Boolean)
  }

  const openStart = parseTimeToMinutes(hours.start)
  const openEnd = parseTimeToMinutes(hours.end)
  if (openStart == null || openEnd == null) return []

  const timeline = []
  let cursor = openStart

  for (const appointment of sorted) {
    const start = parseTimeToMinutes(appointment.startTime)
    const end = getAppointmentEndMinutes(appointment)
    if (start == null || end == null) continue

    if (start > cursor && cursor < openEnd) {
      const gapEnd = Math.min(start, openEnd)
      if (gapEnd - cursor >= MIN_GAP_MINUTES) {
        timeline.push(makeAvailable(cursor, gapEnd))
      }
    }

    timeline.push({
      type: 'appointment',
      appointment,
      startMinutes: start,
      endMinutes: end,
    })

    cursor = Math.max(cursor, end)
  }

  if (openEnd - cursor >= MIN_GAP_MINUTES) {
    timeline.push(makeAvailable(Math.max(cursor, openStart), openEnd))
  }

  return timeline.sort((a, b) => a.startMinutes - b.startMinutes)
}

function makeAvailable(startMinutes, endMinutes) {
  return {
    type: 'available',
    startTime: minutesToTime(startMinutes),
    endTime: minutesToTime(endMinutes),
    startMinutes,
    endMinutes,
    durationMinutes: endMinutes - startMinutes,
  }
}

export function formatAvailableRange(slot) {
  return `${formatTimeDisplay(slot.startTime)}–${formatTimeDisplay(slot.endTime)}`
}

/**
 * Subtle day-chip indicator for the week selector.
 * reschedule_requested > pending > confirmed > blocked (action needed wins)
 * @returns {'reschedule_requested' | 'pending' | 'confirmed' | 'blocked' | null}
 */
export function getDayStatusIndicator(appointments) {
  if (!appointments || appointments.length === 0) return null

  const clientAppts = getActiveScheduleAppointments(appointments).filter(
    (a) => a.type !== 'blocked' && a.status !== 'blocked',
  )
  if (clientAppts.some((a) => a.status === 'reschedule_requested')) {
    return 'reschedule_requested'
  }
  if (clientAppts.some((a) => a.status === 'pending')) return 'pending'
  if (clientAppts.length > 0 && clientAppts.every((a) => a.status === 'confirmed')) {
    return 'confirmed'
  }
  if (appointments.some((a) => a.type === 'blocked' || a.status === 'blocked')) {
    return 'blocked'
  }
  return null
}

export function summarizeDay(appointments) {
  const active = getActiveScheduleAppointments(appointments)
  const clientAppts = active.filter(
    (a) => a.type !== 'blocked' && a.status !== 'blocked',
  )
  const pending = clientAppts.filter((a) => a.status === 'pending').length
  return {
    total: clientAppts.length,
    pending,
    blocked: active.length - clientAppts.length,
  }
}
