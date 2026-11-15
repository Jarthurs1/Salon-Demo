/**
 * Date helpers for week-based calendar navigation.
 * Weeks start on Monday. Past completed weeks are not accessible.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** @returns {Date} local midnight for the given date */
export function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Format as YYYY-MM-DD in local time */
export function toDateKey(date) {
  const d = startOfDay(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse YYYY-MM-DD as local midnight */
export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Monday of the week containing `date` (local) */
export function getWeekStart(date) {
  const d = startOfDay(date)
  const day = d.getDay() // 0 Sun ... 6 Sat
  const offset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + offset)
  return d
}

/** Seven days Mon–Sun for the week containing `date` */
export function getWeekDays(date) {
  const start = getWeekStart(date)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    return day
  })
}

export function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Inclusive range of local midnights from start through end (by calendar day). */
export function getDateRange(startDate, endDate) {
  const start = startOfDay(startDate)
  const end = startOfDay(endDate)
  const days = []
  for (let d = new Date(start); d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    days.push(startOfDay(d))
  }
  return days
}

export function addWeeks(date, weeks) {
  return addDays(date, weeks * 7)
}

export function isSameDay(a, b) {
  return toDateKey(a) === toDateKey(b)
}

export function isBeforeDay(a, b) {
  return startOfDay(a).getTime() < startOfDay(b).getTime()
}

/** Earliest allowed week start = Monday of the week containing today */
export function getEarliestWeekStart(today = new Date()) {
  return getWeekStart(today)
}

export function canGoToPreviousWeek(weekStart, today = new Date()) {
  const earliest = getEarliestWeekStart(today)
  return startOfDay(weekStart).getTime() > earliest.getTime()
}

/** Latest allowed week start. Default covers through the end of 2027 from late 2026. */
export function getLatestWeekStart(today = new Date(), maxFutureWeeks = 70) {
  return addWeeks(getEarliestWeekStart(today), maxFutureWeeks)
}

export function canGoToNextWeek(weekStart, today = new Date(), maxFutureWeeks = 70) {
  const latest = getLatestWeekStart(today, maxFutureWeeks)
  return startOfDay(weekStart).getTime() < latest.getTime()
}

/** True when `date` is strictly before today's calendar day. */
export function isPastDay(date, today = new Date()) {
  return isBeforeDay(date, today)
}

/** First day in `weekDays` that is today or in the future. */
export function getFirstValidDay(weekDays, today = new Date()) {
  const match = weekDays.find((day) => !isPastDay(day, today))
  return match ? startOfDay(match) : startOfDay(weekDays[weekDays.length - 1])
}

export function isTodayOrTomorrow(date, today = new Date()) {
  const key = toDateKey(date)
  return key === toDateKey(today) || key === toDateKey(addDays(today, 1))
}

export function formatWeekRange(weekStart) {
  const start = startOfDay(weekStart)
  const end = addDays(start, 6)
  const year = end.getFullYear()
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
  const startDay = start.getDate()
  const endDay = end.getDate()

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${startMonth} ${startDay} – ${endDay}, ${year}`
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`
  }

  return `${startMonth} ${startDay}, ${start.getFullYear()} – ${endMonth} ${endDay}, ${year}`
}

export function formatLongDate(date) {
  return formatSelectedDate(date)
}

export function formatSelectedDate(date) {
  return startOfDay(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function formatMonthYear(date) {
  return startOfDay(date).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

/** Local midnight for the first day of the month containing `date`. */
export function getMonthStart(date) {
  const d = startOfDay(date)
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function addMonths(date, months) {
  const d = startOfDay(date)
  return new Date(d.getFullYear(), d.getMonth() + months, 1)
}

/**
 * Monday-start month grid cells for a calendar month.
 * Includes leading/trailing days from adjacent months (inMonth: false).
 */
export function getMonthGridDays(monthDate) {
  const monthStart = getMonthStart(monthDate)
  const gridStart = getWeekStart(monthStart)
  const nextMonth = addMonths(monthStart, 1)
  const cells = []
  let cursor = gridStart
  while (cursor.getTime() < nextMonth.getTime() || cells.length % 7 !== 0) {
    cells.push({
      date: startOfDay(cursor),
      inMonth: cursor.getMonth() === monthStart.getMonth(),
    })
    cursor = addDays(cursor, 1)
    if (cells.length >= 42) break
  }
  return cells
}

export function formatDayLabel(date) {
  return startOfDay(date).toLocaleDateString('en-US', { weekday: 'short' })
}

export function formatDayNumber(date) {
  return String(startOfDay(date).getDate())
}

/** Minutes since midnight from "HH:MM" or "H:MM". Returns null if invalid. */
export function parseTimeToMinutes(time) {
  if (time == null || time === '') return null
  const normalized = String(time).trim().replace(/[：.]/g, ':')
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

/** True when value is a valid 24h "HH:MM" time. */
export function isValidTimeString(time) {
  return parseTimeToMinutes(time) != null
}

/**
 * Normalize many time inputs to "HH:MM" 24h.
 * Accepts: 13:00, 1:00 PM, 1pm, 1 PM, etc.
 */
export function normalizeTimeTo24h(time) {
  if (time == null || time === '') return null
  const raw = String(time).trim()
  if (isValidTimeString(raw)) {
    const minutes = parseTimeToMinutes(raw)
    return minutesToTime(minutes)
  }

  const cleaned = raw
    .replace(/[：.]/g, ':')
    .replace(/\s+/g, ' ')
    .trim()

  const match = cleaned.match(
    /^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/i,
  )
  if (!match) return null

  let hour = Number(match[1])
  const minute = match[2] != null ? Number(match[2]) : 0
  const meridiem = match[3] ? match[3].replace(/\./g, '').toLowerCase() : null

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) {
    return null
  }

  if (hour > 24 || hour < 0) return null

  if (hour > 12 && hour <= 23 && !meridiem) {
    return minutesToTime(hour * 60 + minute)
  }

  if (hour < 1 || hour > 12) return null

  let hour24 = hour
  if (meridiem === 'pm') {
    hour24 = hour === 12 ? 12 : hour + 12
  } else if (meridiem === 'am') {
    hour24 = hour === 12 ? 0 : hour
  } else if (hour >= 1 && hour <= 7) {
    hour24 = hour + 12
  } else if (hour === 12) {
    hour24 = 12
  }

  return minutesToTime(hour24 * 60 + minute)
}

/** Minutes since midnight → "HH:MM" 24h */
export function minutesToTime(totalMinutes) {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
    return null
  }
  const hours = Math.floor(totalMinutes / 60) % 24
  const minutes = Math.round(totalMinutes % 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function formatTimeDisplay(time) {
  const normalized = normalizeTimeTo24h(time)
  if (!normalized) return '—'
  const minutes = parseTimeToMinutes(normalized)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`
  const hours = minutes / 60
  if (Number.isInteger(hours)) {
    return hours === 1 ? '1 hr' : `${hours} hr`
  }
  const whole = Math.floor(hours)
  const rem = minutes % 60
  if (whole === 0) return `${rem} min`
  return rem === 0 ? `${whole} hr` : `${whole} hr ${rem} min`
}

export function formatDurationLong(minutes) {
  if (minutes < 60) return `${minutes} minutes`
  const hours = minutes / 60
  if (Number.isInteger(hours)) {
    return hours === 1 ? '1 hour' : `${hours} hours`
  }
  return `${hours} hours`
}

export function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS)
}
