/**
 * Reminder preference helpers (shared by Settings UI + eligibility + Lambda).
 */

export const REMINDER_INTERVAL_OPTIONS = [1, 2, 7]

/** Mutually exclusive notification delivery methods. */
export const NOTIFICATION_METHODS = [
  {
    id: 'none',
    label: 'None',
    description: 'No automatic reminders',
  },
  {
    id: 'email',
    label: 'Email only',
    description: 'Send reminders by email',
  },
  {
    id: 'sms',
    label: 'Text only',
    description: 'Send reminders by text message',
  },
  {
    id: 'both',
    label: 'Both Email and Text',
    description: 'Send reminders by email and text',
  },
]

export const NOTIFICATION_METHOD_IDS = NOTIFICATION_METHODS.map((m) => m.id)

/**
 * Live SMS stays off until toll-free registration + messaging are approved.
 * Lambda may also require SMS_REMINDERS_ENABLED=true.
 */
export const SMS_REMINDERS_APPROVED = false

export const DEFAULT_REMINDER_SETTINGS = {
  enabled: true,
  /** @type {'none'|'email'|'sms'|'both'} */
  method: 'email',
  /** Calendar days before appointment. Default: 1 day only. */
  intervalsDays: [1],
}

export function methodWantsEmail(method) {
  return method === 'email' || method === 'both'
}

export function methodWantsSms(method) {
  return method === 'sms' || method === 'both'
}

/**
 * Whether SMS reminder delivery is operational (approved + optionally env-enabled).
 * Defaults to false so Text/Both never silently send email as a substitute for SMS-only.
 *
 * Pass `smsOperational: true|false` when the caller already applied the gate
 * (e.g. reminder-processor). Tests may use `forceSmsOperational: true`.
 */
export function isSmsRemindersOperational(options = {}) {
  if (typeof options.smsOperational === 'boolean') {
    return options.smsOperational
  }

  let envRequested = options.smsRemindersEnabled
  if (envRequested == null && typeof process !== 'undefined' && process.env) {
    const raw = process.env.SMS_REMINDERS_ENABLED
    if (raw != null && raw !== '') {
      envRequested = ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase())
    }
  }

  if (envRequested === true) {
    return SMS_REMINDERS_APPROVED || options.forceSmsOperational === true
  }

  return false
}

function coerceMethod(source) {
  if (NOTIFICATION_METHOD_IDS.includes(source?.method)) {
    return source.method
  }
  // Legacy: enabled false → none; enabled true / missing → email (current working system)
  if (source?.enabled === false) return 'none'
  return 'email'
}

/**
 * Normalize reminder settings from settings.json / schedule envelope.
 * Accepts nested `reminders` or legacy absence (defaults to Email only + 1 day).
 */
export function normalizeReminderSettings(raw) {
  const source =
    raw && typeof raw === 'object'
      ? raw.reminders && typeof raw.reminders === 'object'
        ? raw.reminders
        : raw
      : {}

  const method = coerceMethod(source)
  const enabled = method !== 'none'

  let intervals = Array.isArray(source.intervalsDays)
    ? source.intervalsDays
        .map((n) => Number(n))
        .filter((n) => REMINDER_INTERVAL_OPTIONS.includes(n))
    : []

  // Migrate older boolean flags if present
  if (intervals.length === 0 && source.intervals && typeof source.intervals === 'object') {
    if (source.intervals.oneDay) intervals.push(1)
    if (source.intervals.twoDays) intervals.push(2)
    if (source.intervals.sevenDays) intervals.push(7)
  }

  // When reminders are on, empty intervals fall back to default 1-day.
  // When None, preserve whatever was saved (including empty) so selections are not erased.
  if (enabled && intervals.length === 0) {
    intervals = [...DEFAULT_REMINDER_SETTINGS.intervalsDays]
  }

  intervals = [...new Set(intervals)].sort((a, b) => b - a)

  return {
    enabled,
    method,
    intervalsDays: intervals,
  }
}

export function reminderSettingsAreValid(settings) {
  const normalized = normalizeReminderSettings(settings)
  if (normalized.method === 'none' || !normalized.enabled) return true
  if (Array.isArray(settings?.intervalsDays) && settings.intervalsDays.length === 0) {
    return false
  }
  return normalized.intervalsDays.length > 0
}

export function toggleReminderInterval(settings, day, checked) {
  const current = normalizeReminderSettings(settings)
  const set = new Set(current.intervalsDays)
  if (checked) set.add(Number(day))
  else set.delete(Number(day))
  const intervalsDays = [...set].sort((a, b) => b - a)
  return {
    enabled: current.enabled,
    method: current.method,
    intervalsDays,
  }
}
