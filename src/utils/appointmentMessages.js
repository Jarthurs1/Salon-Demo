/**
 * Prepopulated SMS bodies for appointment detail Message actions.
 */

import {
  formatSelectedDate,
  formatTimeDisplay,
  parseDateKey,
} from './dateUtils.js'
import { getScheduleSettings } from '../data/schedule.js'
import { getSalonDate } from '../reminders/salonTime.js'
import { splitFullName } from './clientUtils.js'
import {
  findRescheduleSuggestions,
  formatDurationForSms,
  formatSuggestionLabel,
} from './rescheduleSuggestions.js'
import { isCanceledAppointment } from './canceledAppointment.js'

export function resolveCustomerFirstName(appointment, client) {
  const fromClient = String(client?.firstName || '').trim()
  if (fromClient) return fromClient
  const fromAppt = splitFullName(appointment?.clientName || '').firstName
  return fromAppt || 'there'
}

export function resolveStylistFirstName(settings = getScheduleSettings()) {
  return String(settings?.stylistName || '').trim() || 'your stylist'
}

export function formatAppointmentWhenPhrase(appointment, options = {}) {
  const settings = options.settings ?? getScheduleSettings()
  const now = options.now ?? new Date()
  const timeZone = settings.timezone || 'America/New_York'
  const salonToday = getSalonDate(now, timeZone)
  const dateKey = appointment?.date
  const timeLabel = formatTimeDisplay(appointment?.startTime)
  const dateLabel =
    dateKey === salonToday
      ? 'today'
      : formatSelectedDate(parseDateKey(dateKey))
  return { dateLabel, timeLabel }
}

export function buildCanceledFollowUpMessage({
  customerFirstName,
  stylistFirstName,
}) {
  return `Hi ${customerFirstName}, it's ${stylistFirstName}! I saw that you canceled your appointment. Just checking if you'd like to find another time.`
}

export function buildPendingFollowUpMessage({
  customerFirstName,
  stylistFirstName,
  appointment,
  settings,
  now,
}) {
  const { dateLabel, timeLabel } = formatAppointmentWhenPhrase(appointment, {
    settings,
    now,
  })
  return `Hi ${customerFirstName}, it's ${stylistFirstName}! Just checking in since I haven't heard back from you. Are you still able to make your appointment on ${dateLabel} at ${timeLabel}?`
}

export function buildConfirmedFollowUpMessage({
  customerFirstName,
  stylistFirstName,
  appointment,
  settings,
  now,
}) {
  const { dateLabel, timeLabel } = formatAppointmentWhenPhrase(appointment, {
    settings,
    now,
  })
  return `Hi ${customerFirstName}, it's ${stylistFirstName}! Just wanted to reach out about your appointment on ${dateLabel} at ${timeLabel}.`
}

export function buildRescheduleFallbackMessage({
  customerFirstName,
  stylistFirstName,
}) {
  return `Hi ${customerFirstName}, it's ${stylistFirstName}! I saw your request to reschedule. Please let me know what days and times work best for you.`
}

export function buildRescheduleSuggestionsMessage({
  customerFirstName,
  stylistFirstName,
  suggestions = [],
  durationMinutes,
}) {
  const daysWithWindows = (suggestions || []).filter(
    (day) => Array.isArray(day?.windows) && day.windows.length > 0,
  )
  if (!daysWithWindows.length) {
    return buildRescheduleFallbackMessage({
      customerFirstName,
      stylistFirstName,
    })
  }

  const sections = []
  for (const day of daysWithWindows) {
    sections.push(day.dateLabel || day.date)
    for (const window of day.windows) {
      sections.push(`• ${window.label || formatSuggestionLabel(window)}`)
    }
    sections.push('')
  }

  const durationLabel = formatDurationForSms(durationMinutes)

  return [
    `Hi ${customerFirstName}, it's ${stylistFirstName}! I saw your request to reschedule.`,
    '',
    `Would any start time within the following ranges work for your ${durationLabel} appointment?`,
    '',
    ...sections,
    'Let me know what works best!',
  ].join('\n')
}

/**
 * Build the Message SMS body for an appointment detail screen.
 * Canceled wording is preserved exactly as the existing working copy.
 */
export function buildAppointmentMessageBody({
  appointment,
  client = null,
  appointments = [],
  settings = getScheduleSettings(),
  now = new Date(),
} = {}) {
  const customerFirstName = resolveCustomerFirstName(appointment, client)
  const stylistFirstName = resolveStylistFirstName(settings)
  const status = String(appointment?.status || '').toLowerCase()

  if (isCanceledAppointment(appointment)) {
    return buildCanceledFollowUpMessage({
      customerFirstName,
      stylistFirstName,
    })
  }

  if (status === 'pending') {
    return buildPendingFollowUpMessage({
      customerFirstName,
      stylistFirstName,
      appointment,
      settings,
      now,
    })
  }

  if (status === 'confirmed') {
    return buildConfirmedFollowUpMessage({
      customerFirstName,
      stylistFirstName,
      appointment,
      settings,
      now,
    })
  }

  if (status === 'reschedule_requested') {
    const suggestions = findRescheduleSuggestions({
      durationMinutes: appointment.durationMinutes,
      appointments,
      now,
      settings,
      workingDayLimit: 2,
      searchDays: 30,
    })
    return buildRescheduleSuggestionsMessage({
      customerFirstName,
      stylistFirstName,
      suggestions,
      durationMinutes: appointment.durationMinutes,
    })
  }

  return ''
}
