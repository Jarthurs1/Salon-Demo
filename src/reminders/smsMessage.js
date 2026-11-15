/**
 * Outbound SMS copy for appointment reminders and keyword acknowledgments.
 */

import {
  buildHelpAcknowledgmentSms,
  buildStartAcknowledgmentSms,
  buildStopAcknowledgmentSms,
} from './smsDisclosure.js'

function firstName(client) {
  const fromField = String(client?.firstName || '').trim()
  if (fromField) return fromField
  const name = String(client?.name || client?.fullName || '').trim()
  if (!name) return 'there'
  return name.split(/\s+/)[0]
}

function formatTime(startTime) {
  const [hRaw, mRaw] = String(startTime || '00:00').split(':').map(Number)
  const h = Number.isFinite(hRaw) ? hRaw : 0
  const m = Number.isFinite(mRaw) ? mRaw : 0
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return m === 0
    ? `${hour12}:00 ${suffix}`
    : `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
}

/**
 * Concise 24h reminder — prefer a single SMS segment when possible.
 * Includes required opt-out / help cues.
 */
export function buildReminderSms({
  client,
  appointment,
  salonName = 'Your Salon',
} = {}) {
  const name = firstName(client)
  const salon = String(salonName || '').trim() || 'Your Salon'
  const time = formatTime(appointment?.startTime)
  return (
    `${salon}: Hi ${name}, your appointment is tomorrow at ${time}. ` +
    `Reply YES to confirm, STOP to opt out, or HELP for help.`
  )
}

export function buildSmsAcknowledgment({ salonName = 'Your Salon' } = {}) {
  return `Thanks! Your appointment with ${salonName} is confirmed. Reply STOP to opt out.`
}

export function buildHelpSms(scheduleOrSalonName = {}) {
  if (typeof scheduleOrSalonName === 'string') {
    return buildHelpAcknowledgmentSms({ salonName: scheduleOrSalonName })
  }
  return buildHelpAcknowledgmentSms(scheduleOrSalonName)
}

export function buildStopSms(schedule = {}) {
  return buildStopAcknowledgmentSms(schedule)
}

export function buildStartSms(schedule = {}) {
  return buildStartAcknowledgmentSms(schedule)
}
