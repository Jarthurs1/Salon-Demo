/**
 * Reminder eligibility — configurable calendar-day intervals (1 / 2 / 7)
 * and notification method (none / email / sms / both).
 * Confirmed, reschedule_requested, canceled, and blocked appointments never remind.
 */

import {
  getSalonDate,
  isPastAppointmentDate,
  getCalendarDaysUntilAppointment,
  canDeliverReminderNow,
  SALON_TIMEZONE,
} from './salonTime.js'
import {
  normalizeConfirmationMeta,
  reminderSentField,
  reminderIntervalKey,
  isIntervalChannelSent,
  emptyReminderChannelMap,
} from './appointmentConfirmationMeta.js'
import { clientAllowsSmsReminders, normalizeUsE164 } from './smsConsent.js'
import {
  normalizeReminderSettings,
  DEFAULT_REMINDER_SETTINGS,
  methodWantsEmail,
  methodWantsSms,
  isSmsRemindersOperational,
} from './reminderSettings.js'

/** @deprecated Prefer numeric 1; kept for older tests / email intros. */
export const REMINDER_TYPE_24H = '24h'

export function isBlockedAppointment(appointment) {
  return (
    appointment?.type === 'blocked' ||
    appointment?.status === 'blocked'
  )
}

export function isCanceledAppointment(appointment) {
  const status = String(appointment?.status || '').toLowerCase()
  return status === 'canceled' || status === 'cancelled'
}

export function isConfirmedAppointment(appointment) {
  if (isBlockedAppointment(appointment)) return false
  if (isCanceledAppointment(appointment)) return false
  if (appointment?.status === 'confirmed') return true
  return Boolean(appointment?.confirmation?.confirmedAt)
}

export function isRescheduleRequestedAppointment(appointment) {
  return appointment?.status === 'reschedule_requested'
}

/** True when no further automatic reminders should be sent. */
export function shouldStopReminders(appointment) {
  if (!appointment) return true
  if (isBlockedAppointment(appointment)) return true
  if (isCanceledAppointment(appointment)) return true
  if (isConfirmedAppointment(appointment)) return true
  if (isRescheduleRequestedAppointment(appointment)) return true
  return false
}

function clientHasEmail(client) {
  const email = String(client?.email || '').trim()
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
}

function resolveSettings(options = {}) {
  if (options.reminderSettings) {
    return normalizeReminderSettings(options.reminderSettings)
  }
  if (options.settings) {
    return normalizeReminderSettings(options.settings.reminders || options.settings)
  }
  return { ...DEFAULT_REMINDER_SETTINGS }
}

/**
 * Which configured interval is due today (exact calendar-day match).
 * Never returns an interval that already passed or was fully marked sent.
 * @returns {1|2|7|null}
 */
export function getReminderType(appointment, options = {}) {
  const now = options.now ? new Date(options.now) : new Date()
  const timeZone = options.timeZone || SALON_TIMEZONE
  const salonToday = options.salonToday || getSalonDate(now, timeZone)
  const settings = resolveSettings(options)

  if (!appointment) return null
  if (!settings.enabled || settings.method === 'none') return null
  if (shouldStopReminders(appointment)) return null
  if (isPastAppointmentDate(appointment.date, salonToday)) return null

  const daysUntil = getCalendarDaysUntilAppointment(appointment.date, salonToday)
  if (daysUntil == null || daysUntil <= 0) return null

  if (!settings.intervalsDays.includes(daysUntil)) {
    return null
  }

  const { reminders } = normalizeConfirmationMeta(appointment)
  const field = reminderSentField(daysUntil)
  if (field && reminders[field]) return null

  return daysUntil
}

/**
 * Resolve which channels should send for this appointment/interval.
 */
export function resolveReminderChannels(appointment, client, options = {}) {
  const settings = resolveSettings(options)
  const reminderType = options.reminderType ?? getReminderType(appointment, options)
  const empty = {
    email: false,
    sms: false,
    smsUnavailable: false,
    reason: null,
  }

  if (reminderType == null) {
    return { ...empty, reason: 'not_due_or_skipped' }
  }
  if (!client) {
    return { ...empty, reason: 'missing_client' }
  }

  const wantsEmail = methodWantsEmail(settings.method)
  const wantsSms = methodWantsSms(settings.method)
  const smsLive = isSmsRemindersOperational(options)
  const smsUnavailable = wantsSms && !smsLive
  const { reminders } = normalizeConfirmationMeta(appointment)

  const emailContact = clientHasEmail(client)
  const smsContact = clientAllowsSmsReminders(client)

  const email =
    wantsEmail &&
    emailContact &&
    !isIntervalChannelSent(reminders, reminderType, 'email')

  const sms =
    wantsSms &&
    smsLive &&
    smsContact &&
    !isIntervalChannelSent(reminders, reminderType, 'sms')

  if (email || sms) {
    return {
      email,
      sms,
      smsUnavailable,
      reason: null,
    }
  }

  // Nothing to send — explain why (never silently substitute email for SMS-only).
  if (wantsSms && !wantsEmail && !smsLive) {
    return { ...empty, smsUnavailable: true, reason: 'sms_unavailable' }
  }
  if (wantsEmail && !emailContact && !(wantsSms && smsLive && smsContact)) {
    const phone = normalizeUsE164(client.phone)
    if (!phone && !String(client.email || '').trim()) {
      return { ...empty, smsUnavailable, reason: 'missing_email_and_phone' }
    }
    if (!emailContact && wantsEmail && !wantsSms) {
      return { ...empty, smsUnavailable, reason: 'missing_email' }
    }
  }
  if (wantsSms && smsLive && !smsContact && !email) {
    const phone = normalizeUsE164(client.phone)
    return {
      ...empty,
      smsUnavailable,
      reason: phone ? 'sms_not_opted_in' : 'missing_phone',
    }
  }
  if (wantsEmail && emailContact && isIntervalChannelSent(reminders, reminderType, 'email') && !sms) {
    return { ...empty, smsUnavailable, reason: 'already_sent' }
  }

  return { ...empty, smsUnavailable, reason: 'not_due_or_skipped' }
}

export function isReminderEligible(appointment, clientsById, options = {}) {
  const now = options.now ? new Date(options.now) : new Date()
  const timeZone = options.timeZone || SALON_TIMEZONE
  const reminderType = getReminderType(appointment, options)
  if (reminderType == null) {
    return {
      eligible: false,
      reason: 'not_due_or_skipped',
      reminderType: null,
      client: null,
      channels: { email: false, sms: false },
      smsUnavailable: false,
    }
  }

  if (!canDeliverReminderNow(appointment, now, timeZone)) {
    return {
      eligible: false,
      reason: 'quiet_hours_or_started',
      reminderType,
      client: null,
      channels: { email: false, sms: false },
      smsUnavailable: false,
    }
  }

  const clientId = appointment.clientId
  const client = clientId ? clientsById.get(clientId) ?? clientsById[clientId] : null
  if (!client) {
    return {
      eligible: false,
      reason: 'missing_client',
      reminderType,
      client: null,
      channels: { email: false, sms: false },
      smsUnavailable: false,
    }
  }

  const resolved = resolveReminderChannels(appointment, client, {
    ...options,
    reminderType,
  })

  if (!resolved.email && !resolved.sms) {
    return {
      eligible: false,
      reason: resolved.reason || 'not_due_or_skipped',
      reminderType,
      client,
      channels: { email: false, sms: false },
      smsUnavailable: resolved.smsUnavailable,
    }
  }

  return {
    eligible: true,
    reason: null,
    reminderType,
    client,
    channels: { email: resolved.email, sms: resolved.sms },
    smsUnavailable: resolved.smsUnavailable,
  }
}

/**
 * Record channel delivery. Sets the legacy interval stamp only when
 * markIntervalComplete is true (all required channels for this job succeeded,
 * or email-only / sms-only completed).
 */
export function applyReminderSentTimestamp(
  appointment,
  reminderType,
  atIso = new Date().toISOString(),
  options = {},
) {
  const { confirmation, reminders, sms } = normalizeConfirmationMeta(appointment)
  const field = reminderSentField(reminderType)
  const key = reminderIntervalKey(reminderType)
  if (!field || !key) return appointment

  const channels = options.channels || { email: true, sms: false }
  const prior = reminders.byChannel?.[key] || { email: null, sms: null }
  const nextChannel = {
    email: channels.email ? atIso : prior.email,
    sms: channels.sms ? atIso : prior.sms,
  }

  const markComplete =
    options.markIntervalComplete == null
      ? Boolean(channels.email || channels.sms)
      : Boolean(options.markIntervalComplete)

  return {
    ...appointment,
    confirmation,
    reminders: {
      ...reminders,
      byChannel: {
        ...emptyReminderChannelMap(),
        ...reminders.byChannel,
        [key]: nextChannel,
      },
      [field]: markComplete ? atIso : reminders[field],
    },
    sms: {
      ...sms,
      outboundSentAt: channels.sms
        ? sms.outboundSentAt || atIso
        : sms.outboundSentAt,
    },
  }
}
