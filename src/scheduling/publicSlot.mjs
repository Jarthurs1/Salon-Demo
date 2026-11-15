/**
 * Shared scheduling rules for the Public Booking API.
 * Mirrors stylist conflictUtils / schedule logic (contiguous fit + blocks).
 * Public dates follow the stylist's configured working days.
 * Same-day and past dates are never bookable.
 */

const DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

const SLOT_STEP_MINUTES = 15

export function parseTimeToMinutes(time) {
  if (time == null || time === '') return null
  const match = String(time).trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

export function minutesToTime(totalMinutes) {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return null
  const hours = Math.floor(totalMinutes / 60) % 24
  const minutes = Math.round(totalMinutes % 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function parseDateKey(key) {
  const [y, m, d] = String(key).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function toDateKey(date) {
  const d = date instanceof Date ? date : parseDateKey(date)
  if (!d || Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

export function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function isPastDay(date, today = new Date()) {
  return startOfDay(date).getTime() < startOfDay(today).getTime()
}

export function getDayKey(date) {
  return DAY_KEYS[date.getDay()]
}

/** @deprecated Weekends follow weeklyHours.closed. Kept for older callers. */
export function isPublicWeekend(date) {
  const day = date.getDay()
  return day === 0 || day === 6
}

export function resolveSalonToday(options = {}) {
  if (options.salonToday) return String(options.salonToday)
  if (options.today) return toDateKey(options.today)
  return toDateKey(startOfDay(new Date()))
}

export function getSalonDate(now = new Date(), timeZone = 'America/New_York') {
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

function isListedClosedDate(dateKey, schedule) {
  const lists = [schedule?.blackoutDates, schedule?.closedDays]
  return lists.some(
    (list) => Array.isArray(list) && list.map(String).includes(dateKey),
  )
}

export function getHoursForDate(date, schedule) {
  const key = getDayKey(date)
  return schedule?.weeklyHours?.[key] ?? { closed: true }
}

export function isClosedWeekday(date, schedule) {
  return Boolean(getHoursForDate(date, schedule)?.closed)
}

export function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA
}

export function getAppointmentEndMinutes(appointment) {
  const start = parseTimeToMinutes(appointment.startTime)
  if (start == null) return null
  return start + Number(appointment.durationMinutes)
}

export function findConflicts(candidate, existing, options = {}) {
  const { excludeId } = options
  const start = parseTimeToMinutes(candidate.startTime)
  if (start == null) return []
  const end = start + Number(candidate.durationMinutes)

  return (existing || []).filter((appt) => {
    if (excludeId && appt.id === excludeId) return false
    if (appt.date !== candidate.date) return false
    const status = String(appt.status || '').toLowerCase()
    // Canceled appointments only free the slot after stylist release.
    if (status === 'canceled' || status === 'cancelled') {
      const released = appt.slotReleasedAt
      // Legacy canceled rows without slotReleasedAt are treated as released.
      if (released == null && !Object.prototype.hasOwnProperty.call(appt, 'slotReleasedAt')) {
        return false
      }
      if (released) return false
    }
    const otherStart = parseTimeToMinutes(appt.startTime)
    if (otherStart == null) return false
    const otherEnd = getAppointmentEndMinutes(appt)
    if (otherEnd == null) return false
    return intervalsOverlap(start, end, otherStart, otherEnd)
  })
}

export function getWorkingDayDurationMinutes(date, schedule) {
  const hours = getHoursForDate(date, schedule)
  if (hours.closed) return null
  const openStart = parseTimeToMinutes(hours.start)
  const openEnd = parseTimeToMinutes(hours.end)
  if (openStart == null || openEnd == null || openEnd <= openStart) return null
  return openEnd - openStart
}

export function isFullDayBlock(appointment, schedule) {
  if (
    !appointment ||
    (appointment.type !== 'blocked' && appointment.status !== 'blocked')
  ) {
    return false
  }
  const date = parseDateKey(appointment.date)
  if (!date) return false
  const hours = getHoursForDate(date, schedule)
  if (hours.closed) return false
  const duration = getWorkingDayDurationMinutes(date, schedule)
  return (
    appointment.startTime === hours.start &&
    Number(appointment.durationMinutes) === duration
  )
}

/**
 * Validate a public booking slot (includes Mon–Fri rule).
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function validatePublicSlot(candidate, existing, schedule, options = {}) {
  const today = options.today ?? startOfDay(new Date())
  const date = options.dateObj ?? parseDateKey(candidate.date)
  if (!date || Number.isNaN(date.getTime())) {
    return { ok: false, code: 'invalid_date', message: 'Invalid date.' }
  }

  const salonToday = resolveSalonToday({ ...options, today })
  const dateKey = candidate.date || toDateKey(date)
  if (dateKey < salonToday || isPastDay(date, parseDateKey(salonToday))) {
    return { ok: false, code: 'past_date', message: 'That date is in the past.' }
  }
  if (dateKey === salonToday) {
    return {
      ok: false,
      code: 'same_day',
      message: 'Same-day appointments are not available online.',
    }
  }

  if (isListedClosedDate(dateKey, schedule) || isClosedWeekday(date, schedule)) {
    return {
      ok: false,
      code: 'closed_day',
      message: 'The stylist is not available on this day.',
    }
  }

  const dayAppointments = (existing || []).filter((a) => a.date === candidate.date)
  if (dayAppointments.some((a) => isFullDayBlock(a, schedule))) {
    return {
      ok: false,
      code: 'full_day_block',
      message: 'That day is unavailable.',
    }
  }

  const hours = getHoursForDate(date, schedule)
  const openStart = parseTimeToMinutes(hours.start)
  const openEnd = parseTimeToMinutes(hours.end)
  const start = parseTimeToMinutes(candidate.startTime)
  const duration = Number(candidate.durationMinutes)

  if (start == null || !Number.isFinite(duration) || duration <= 0) {
    return { ok: false, code: 'invalid_time', message: 'Invalid time or duration.' }
  }

  const end = start + duration
  if (start < openStart) {
    return { ok: false, code: 'before_open', message: 'That time is before opening.' }
  }
  if (end > openEnd) {
    return { ok: false, code: 'after_close', message: 'That appointment would end after closing.' }
  }

  const conflicts = findConflicts(candidate, existing, {
    excludeId: options.excludeId,
  })
  if (conflicts.length > 0) {
    return {
      ok: false,
      code: 'conflict',
      message: 'That time is no longer available.',
    }
  }

  return { ok: true }
}

export function getAvailableStartTimes(date, durationMinutes, existing, schedule, options = {}) {
  const today = options.today ?? startOfDay(new Date())
  const dateObj = date instanceof Date ? startOfDay(date) : parseDateKey(date)
  if (!dateObj) return []

  const dateKey = toDateKey(dateObj)
  const probe = validatePublicSlot(
    {
      date: dateKey,
      startTime: '00:00',
      durationMinutes: Number(durationMinutes),
    },
    existing,
    schedule,
    { today, salonToday: options.salonToday, dateObj, excludeId: options.excludeId },
  )

  // Weekend / past / closed / full-day — no times. For invalid_time on 00:00 we still compute.
  if (
    probe.code === 'weekend_not_public' ||
    probe.code === 'past_date' ||
    probe.code === 'same_day' ||
    probe.code === 'closed_day' ||
    probe.code === 'full_day_block' ||
    probe.code === 'invalid_date'
  ) {
    return []
  }

  const hours = getHoursForDate(dateObj, schedule)
  if (hours.closed) return []
  const openStart = parseTimeToMinutes(hours.start)
  const openEnd = parseTimeToMinutes(hours.end)
  const duration = Number(durationMinutes)
  if (openStart == null || openEnd == null || !Number.isFinite(duration)) return []

  const times = []
  for (let minutes = openStart; minutes + duration <= openEnd; minutes += SLOT_STEP_MINUTES) {
    const startTime = minutesToTime(minutes)
    const result = validatePublicSlot(
      { date: dateKey, startTime, durationMinutes: duration },
      existing,
      schedule,
      { today, salonToday: options.salonToday, dateObj, excludeId: options.excludeId },
    )
    if (result.ok) times.push(startTime)
  }
  return times
}

export function isDatePubliclyBookable(
  date,
  durationMinutes,
  existing,
  schedule,
  options = {},
) {
  return (
    getAvailableStartTimes(date, durationMinutes, existing, schedule, options)
      .length > 0
  )
}

export function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))
}

export function addDays(date, days) {
  const d = startOfDay(date)
  d.setDate(d.getDate() + days)
  return d
}
