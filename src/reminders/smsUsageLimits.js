/**
 * Backend-enforced automated SMS segment limits (per salon).
 * Live SMS remains gated; counters must never be overridden by the frontend.
 */

export const SMS_MONTHLY_SEGMENT_LIMIT = 300
export const SMS_DAILY_SEGMENT_LIMIT = 30
/** Matches max selectable reminder intervals (1 / 2 / 7). */
export const SMS_PER_APPOINTMENT_SEND_LIMIT = 3

/** Separate safety cap for automated reminder emails per salon per month. */
export const EMAIL_MONTHLY_SEND_CAP = 2000

export const DEFAULT_SMS_USAGE = {
  monthKey: '',
  monthSegments: 0,
  dayKey: '',
  daySegments: 0,
  monthlyLimit: SMS_MONTHLY_SEGMENT_LIMIT,
  dailyLimit: SMS_DAILY_SEGMENT_LIMIT,
}

export function normalizeSmsUsage(raw = {}) {
  return {
    monthKey: String(raw.monthKey || ''),
    monthSegments: Math.max(0, Number(raw.monthSegments) || 0),
    dayKey: String(raw.dayKey || ''),
    daySegments: Math.max(0, Number(raw.daySegments) || 0),
    monthlyLimit: Number(raw.monthlyLimit) || SMS_MONTHLY_SEGMENT_LIMIT,
    dailyLimit: Number(raw.dailyLimit) || SMS_DAILY_SEGMENT_LIMIT,
  }
}

/**
 * GSM-7 SMS segment estimate (conservative). UCS-2 uses 70/67.
 * Prefer short single-segment reminder templates.
 */
export function estimateSmsSegments(body, { encoding = 'auto' } = {}) {
  const text = String(body || '')
  if (!text) return 0
  const needsUcs2 =
    encoding === 'ucs2' ||
    (encoding === 'auto' && /[^\x00-\x7F]/.test(text))
  if (needsUcs2) {
    if (text.length <= 70) return 1
    return Math.ceil(text.length / 67)
  }
  if (text.length <= 160) return 1
  return Math.ceil(text.length / 153)
}

/**
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function canSendAutomatedSmsSegments(usage, segments, options = {}) {
  const current = normalizeSmsUsage(usage)
  const count = Math.max(0, Number(segments) || 0)
  if (count <= 0) return { ok: false, reason: 'zero_segments' }

  const appointmentSends = Number(options.appointmentAutomatedSmsSends || 0)
  if (appointmentSends >= SMS_PER_APPOINTMENT_SEND_LIMIT) {
    return { ok: false, reason: 'per_appointment_limit' }
  }

  const monthlyLimit = current.monthlyLimit || SMS_MONTHLY_SEGMENT_LIMIT
  const dailyLimit = current.dailyLimit || SMS_DAILY_SEGMENT_LIMIT

  if (current.monthSegments + count > monthlyLimit) {
    return { ok: false, reason: 'monthly_limit' }
  }
  if (current.daySegments + count > dailyLimit) {
    return { ok: false, reason: 'daily_limit' }
  }
  return { ok: true }
}

export function formatSmsUsageLabel(usage) {
  const current = normalizeSmsUsage(usage)
  const limit = current.monthlyLimit || SMS_MONTHLY_SEGMENT_LIMIT
  return `${current.monthSegments} / ${limit} segments`
}

/** Salon-local calendar keys for rolling SMS counters. */
export function smsUsagePeriodKeys(now = new Date(), timeZone = 'America/New_York') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  return {
    monthKey: `${y}-${m}`,
    dayKey: `${y}-${m}-${d}`,
  }
}

/**
 * Roll counters into the current salon day/month and optionally add segments.
 */
export function applySmsUsageSegments(usage, segments, options = {}) {
  const now = options.now ? new Date(options.now) : new Date()
  const timeZone = options.timeZone || 'America/New_York'
  const { monthKey, dayKey } = smsUsagePeriodKeys(now, timeZone)
  const current = normalizeSmsUsage(usage)
  const next = {
    ...current,
    monthKey,
    dayKey,
    monthSegments: current.monthKey === monthKey ? current.monthSegments : 0,
    daySegments: current.dayKey === dayKey ? current.daySegments : 0,
  }
  const count = Math.max(0, Number(segments) || 0)
  next.monthSegments += count
  next.daySegments += count
  return next
}
