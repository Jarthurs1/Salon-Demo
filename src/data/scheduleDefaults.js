/**
 * Default salon schedule — single source for seed + settings envelope.
 * Live settings are owned by settingsRepository (local or AWS).
 */

export const DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

/** Intended production defaults: weekdays 8–6, weekends closed. */
export const DEFAULT_WEEKLY_HOURS = {
  monday: { closed: false, start: '08:00', end: '18:00' },
  tuesday: { closed: false, start: '08:00', end: '18:00' },
  wednesday: { closed: false, start: '08:00', end: '18:00' },
  thursday: { closed: false, start: '08:00', end: '18:00' },
  friday: { closed: false, start: '08:00', end: '18:00' },
  saturday: { closed: true },
  sunday: { closed: true },
}

/**
 * Prior incorrect seed (Mon/Wed closed, weekends open).
 * Used only to safely migrate installs that still match this pattern.
 */
export const LEGACY_INCORRECT_WEEKLY_HOURS = {
  monday: { closed: true },
  tuesday: { closed: false, start: '09:00', end: '18:00' },
  wednesday: { closed: true },
  thursday: { closed: false, start: '09:00', end: '18:00' },
  friday: { closed: false, start: '09:00', end: '18:00' },
  saturday: { closed: false, start: '09:00', end: '17:00' },
  sunday: { closed: false, start: '10:00', end: '16:00' },
}

export const DEFAULT_SCHEDULE = {
  /** Customer salon business name (not the Simple Salon product name). */
  salonName: '',
  /** Stylist first name shown in customer communications. */
  stylistName: '',
  /** Salon notification recipient (cancellations / reschedule alerts). */
  contactEmail: '',
  contactPhone: '',
  timezone: 'America/New_York',
  weekStartsOn: 1,
  defaultAppointmentDurationMinutes: 60,
  maxFutureWeeks: 70,
  /** Normal Calendar available-slot window (does not block out-of-hours booking). */
  calendarDisplayStart: '08:00',
  calendarDisplayEnd: '18:00',
  weeklyHours: structuredClone(DEFAULT_WEEKLY_HOURS),
  closedDays: [],
  blackoutDates: [],
  allowClosedDayOverride: true,
  /** Customer cancel / reschedule policy. Default is not on the appointment date. */
  customerChangeCutoff: 'not_same_day',
}

function dayHoursEqual(a, b) {
  if (!a || !b) return false
  if (Boolean(a.closed) !== Boolean(b.closed)) return false
  if (a.closed) return true
  return a.start === b.start && a.end === b.end
}

/** True when weeklyHours still matches the known incorrect seed. */
export function matchesLegacyIncorrectWeeklyHours(weeklyHours) {
  if (!weeklyHours || typeof weeklyHours !== 'object') return false
  return DAY_KEYS.every((key) =>
    dayHoursEqual(weeklyHours[key], LEGACY_INCORRECT_WEEKLY_HOURS[key]),
  )
}
