/**
 * Centralized salon schedule / working-hour helpers.
 * Live settings come from settingsRepository (local or AWS).
 */

import { DAY_KEYS, DEFAULT_SCHEDULE } from './scheduleDefaults.js'
import { getScheduleSettings as getLiveScheduleSettings } from '../services/settingsRepository.js'

export { DAY_KEYS }
export const scheduleSettings = DEFAULT_SCHEDULE

export function getScheduleSettings() {
  return getLiveScheduleSettings()
}

/** Full-day Book window (00:00–24:00). Does not expand Calendar availability. */
export const EXTENDED_BOOKING_START = '00:00'
export const EXTENDED_BOOKING_END = '24:00'
export const DAY_END_MINUTES = 24 * 60

export function getDayKey(date) {
  return DAY_KEYS[startOfWeekIndex(date)]
}

function startOfWeekIndex(date) {
  const d = date instanceof Date ? date : new Date(date)
  return d.getDay()
}

/**
 * @returns {{ closed: true } | { closed: false, start: string, end: string }}
 */
export function getHoursForDate(date, settings = getScheduleSettings()) {
  const key = getDayKey(date)
  return settings.weeklyHours[key]
}

/**
 * Calendar available-slot window for an open day.
 * Uses configured display hours (default 8 AM–6 PM); does not affect booking.
 */
export function getCalendarDisplayHours(date, settings = getScheduleSettings()) {
  const hours = getHoursForDate(date, settings)
  if (!hours || hours.closed) return { closed: true }
  return {
    closed: false,
    start: settings.calendarDisplayStart || hours.start || '08:00',
    end: settings.calendarDisplayEnd || hours.end || '18:00',
  }
}

export function isClosedDay(date, settings = getScheduleSettings()) {
  return Boolean(getHoursForDate(date, settings)?.closed)
}

/**
 * True when start/duration falls outside the day's normal Calendar display hours,
 * or the day is closed. Informational only — booking remains allowed.
 */
export function isOutsideNormalHours(
  date,
  startTime,
  durationMinutes,
  settings = getScheduleSettings(),
) {
  const hours = getCalendarDisplayHours(date, settings)
  if (!hours || hours.closed) return true
  const start = parseTimeToMinutesSafe(startTime)
  if (start == null) return true
  const end = start + Number(durationMinutes || 0)
  const openStart = parseTimeToMinutesSafe(hours.start)
  const openEnd = parseTimeToMinutesSafe(hours.end)
  if (openStart == null || openEnd == null) return true
  return start < openStart || end > openEnd
}

function parseTimeToMinutesSafe(time) {
  if (time == null || time === '') return null
  const normalized = String(time).trim()
  if (normalized === '24:00') return DAY_END_MINUTES
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

export function getClosedDayMessage(date, settings = getScheduleSettings()) {
  const day = date instanceof Date ? date : new Date(date)
  const weekday = day.toLocaleDateString('en-US', { weekday: 'long' })
  const today = new Date()
  const isToday =
    day.getFullYear() === today.getFullYear() &&
    day.getMonth() === today.getMonth() &&
    day.getDate() === today.getDate()
  if (isToday) return 'Closed today'
  const plural = weekday === 'Wednesday' ? 'Wednesdays' : `${weekday}s`
  return `Closed on ${plural}`
}

export const SERVICE_SUGGESTIONS = [
  'Haircut',
  'Haircut & Style',
  'Color',
  'Color & Cut',
  'Highlights',
  'Blowout',
  'Wedding',
  'Consultation',
  'Other',
]

// Re-export catalog used by Book + forms (preferred over free-text suggestions)
export { SERVICE_OPTIONS, SERVICE_LABELS, getDefaultDurationForService } from './services.js'

function durationLabel(minutes) {
  if (minutes < 60) return `${minutes} minutes`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  const hourPart =
    hours === 1 ? '1 hour' : `${hours} hours`
  if (rem === 0) return hourPart
  return `${hourPart} ${rem} minutes`
}

/** Standard + long appointments (Bridal / Wedding up to 12 hours). */
export const DURATION_OPTIONS = [
  30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 270, 300, 330, 360, 420, 480,
  540, 600, 660, 720,
].map((minutes) => ({ minutes, label: durationLabel(minutes) }))

/** Block Time duration presets (Full Day is computed from working hours). */
export const BLOCK_DURATION_OPTIONS = [
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
  { minutes: 180, label: '3 hours' },
  { minutes: 240, label: '4 hours' },
  { minutes: 'full', label: 'Full Day' },
]

export const BLOCK_REASONS = [
  'Lunch',
  'Personal',
  'Unavailable',
  'Wedding preparation',
  'Travel',
  'Other',
]
