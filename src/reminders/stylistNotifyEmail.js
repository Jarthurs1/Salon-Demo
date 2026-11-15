/**
 * SES email bodies for stylist notifications (cancel / reschedule request).
 * Pure helpers — confirmation-api sends via the existing SES client.
 * Uses per-salon branding; product footer is Simple Salon.
 */

import { PRODUCT_NAME } from './productName.js'
import { formatAppointmentWhen } from './reminderEmail.js'
import { resolveSalonBranding } from './salonBranding.js'

export function formatNotifyDuration(minutes) {
  const value = Number(minutes)
  if (!Number.isFinite(value) || value <= 0) return '—'
  if (value < 60) return `${value} min`
  const hours = value / 60
  if (Number.isInteger(hours)) {
    return hours === 1 ? '1 hr' : `${hours} hr`
  }
  const whole = Math.floor(hours)
  const rem = value % 60
  return rem === 0 ? `${whole} hr` : `${whole} hr ${rem} min`
}

export function formatNotifyPhone(phone) {
  const raw = String(phone ?? '').trim()
  if (!raw) return 'Not on file'
  const digits = raw.replace(/\D/g, '')
  let national = digits
  if (digits.length === 11 && digits.startsWith('1')) {
    national = digits.slice(1)
  }
  if (national.length === 10) {
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`
  }
  return raw
}

export function resolveClientDisplayName(client, appointment) {
  if (client) {
    const composed = [client.firstName, client.lastName]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' ')
    if (composed) return composed
    const display = String(client.displayName || '').trim()
    if (display) return display
  }
  return String(appointment?.clientName || '').trim() || 'A client'
}

/**
 * Fresh reschedule request only — duplicate link opens must not notify again.
 */
export function shouldNotifyStylistOfReschedule(status) {
  return status === 'reschedule_requested'
}

export function buildStylistRescheduleNotifyEmail({
  clientName,
  clientPhone,
  appointment,
  salonName,
  stylistName,
} = {}) {
  const branding = resolveSalonBranding({ salonName, stylistName })
  const name = String(clientName || '').trim() || 'A client'
  const { dateLabel, timeLabel } = formatAppointmentWhen(
    appointment?.date,
    appointment?.startTime,
  )
  const service = String(appointment?.service || '').trim() || 'Appointment'
  const duration = formatNotifyDuration(appointment?.durationMinutes)
  const phone = formatNotifyPhone(clientPhone)

  const subject = `Reschedule Requested — ${name}`
  const text = [
    `Hi ${branding.stylistName},`,
    '',
    `${name} has requested to reschedule their appointment.`,
    '',
    `Customer: ${name}`,
    `Phone: ${phone}`,
    `Date: ${dateLabel}`,
    `Time: ${timeLabel}`,
    `Service: ${service}`,
    `Duration: ${duration}`,
    '',
    'The original appointment time is still held on your calendar.',
    'Please contact the customer to choose a new time.',
    '',
    PRODUCT_NAME,
  ].join('\n')

  return { subject, text }
}

export function buildStylistCancelNotifyEmail({
  clientName,
  appointment,
  salonName,
  stylistName,
} = {}) {
  const branding = resolveSalonBranding({ salonName, stylistName })
  const name = String(clientName || '').trim() || 'A client'
  const { dateLabel, timeLabel } = formatAppointmentWhen(
    appointment?.date,
    appointment?.startTime,
  )
  const service = String(appointment?.service || '').trim() || 'Appointment'
  const subject = `Appointment Canceled — ${name}`
  const text = [
    `Hi ${branding.stylistName},`,
    '',
    `${name} canceled their appointment.`,
    '',
    `Date: ${dateLabel}`,
    `Time: ${timeLabel}`,
    `Service: ${service}`,
    '',
    `The appointment is marked CANCELED in your ${PRODUCT_NAME} calendar.`,
    '',
    'You can review it and release the time slot when ready.',
    '',
    PRODUCT_NAME,
  ].join('\n')
  return { subject, text }
}
