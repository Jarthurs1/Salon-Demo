/**
 * Salon calendar-day + appointment-instant helpers in America/New_York.
 * Instant math is DST-aware via Intl time-zone conversion.
 */

export const SALON_TIMEZONE = 'America/New_York'

/** @returns {string} YYYY-MM-DD in salon timezone */
export function getSalonDate(now = new Date(), timeZone = SALON_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  return `${year}-${month}-${day}`
}

/** Parse YYYY-MM-DD → UTC midnight used only for day-count arithmetic. */
export function dateKeyToUtcMidnight(dateKey) {
  const [y, m, d] = String(dateKey).split('-').map(Number)
  if (!y || !m || !d) return null
  return Date.UTC(y, m - 1, d)
}

/**
 * Whole calendar days from salonToday → appointmentDate.
 * Positive = appointment is in the future.
 * Kept for legacy tests / display; Phase 7 reminders use exact 24h instants.
 */
export function getCalendarDaysUntilAppointment(
  appointmentDateKey,
  salonTodayKey,
) {
  const appt = dateKeyToUtcMidnight(appointmentDateKey)
  const today = dateKeyToUtcMidnight(salonTodayKey)
  if (appt == null || today == null) return null
  return Math.round((appt - today) / 86_400_000)
}

export function isPastAppointmentDate(appointmentDateKey, salonTodayKey) {
  const days = getCalendarDaysUntilAppointment(appointmentDateKey, salonTodayKey)
  return days == null ? true : days < 0
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const get = (type) => parts.find((p) => p.type === type)?.value
  let hour = Number(get('hour'))
  if (hour === 24) hour = 0
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour,
    minute: Number(get('minute')),
    second: Number(get('second')),
  }
}

/**
 * Convert a salon-local date + HH:MM into a UTC Date (DST-safe).
 * @param {string} dateKey YYYY-MM-DD
 * @param {string} startTime HH:MM
 */
export function getAppointmentStartUtc(
  dateKey,
  startTime,
  timeZone = SALON_TIMEZONE,
) {
  const [year, month, day] = String(dateKey).split('-').map(Number)
  const [hour, minute] = String(startTime || '00:00').split(':').map(Number)
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    return null
  }

  let utcMillis = Date.UTC(year, month - 1, day, hour, minute, 0)
  for (let i = 0; i < 4; i += 1) {
    const shown = zonedParts(new Date(utcMillis), timeZone)
    const asUtc = Date.UTC(
      shown.year,
      shown.month - 1,
      shown.day,
      shown.hour,
      shown.minute,
      shown.second,
    )
    const wanted = Date.UTC(year, month - 1, day, hour, minute, 0)
    const delta = wanted - asUtc
    if (delta === 0) break
    utcMillis += delta
  }
  return new Date(utcMillis)
}

/** Hours from `now` until appointment start (negative if past). */
export function getHoursUntilAppointmentStart(appointment, now = new Date(), timeZone = SALON_TIMEZONE) {
  const start = getAppointmentStartUtc(appointment?.date, appointment?.startTime, timeZone)
  if (!start) return null
  return (start.getTime() - new Date(now).getTime()) / 3_600_000
}

/** Local hour (0–23) in the salon timezone. */
export function getSalonLocalHour(now = new Date(), timeZone = SALON_TIMEZONE) {
  return zonedParts(now, timeZone).hour
}

/**
 * Automated reminders may send only 9:00 AM–8:00 PM salon-local
 * (hour >= 9 and hour < 20).
 */
export function isWithinReminderSendWindow(now = new Date(), timeZone = SALON_TIMEZONE) {
  const hour = getSalonLocalHour(now, timeZone)
  return hour >= 9 && hour < 20
}

/**
 * True when a reminder can be delivered now:
 * inside quiet-hour window and appointment has not started.
 */
export function canDeliverReminderNow(appointment, now = new Date(), timeZone = SALON_TIMEZONE) {
  if (!isWithinReminderSendWindow(now, timeZone)) return false
  const hoursUntil = getHoursUntilAppointmentStart(appointment, now, timeZone)
  if (hoursUntil == null || hoursUntil <= 0) return false
  return true
}

/**
 * Exact 24h reminder window for hourly scheduler.
 * Default: [23.5, 24.5) hours before start.
 */
export function isWithinTwentyFourHourReminderWindow(
  appointment,
  options = {},
) {
  const now = options.now ? new Date(options.now) : new Date()
  const timeZone = options.timeZone || SALON_TIMEZONE
  const minHours = options.minHours ?? 23.5
  const maxHours = options.maxHours ?? 24.5
  const hours = getHoursUntilAppointmentStart(appointment, now, timeZone)
  if (hours == null) return false
  return hours >= minHours && hours < maxHours
}
