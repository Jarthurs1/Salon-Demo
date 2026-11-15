/**
 * Reminder email HTML + text templates with Confirm and Manage Appointment links.
 * Uses per-salon branding from settings — never hardcodes a salon owner.
 */

import { resolveSalonBranding } from './salonBranding.js'

function buildIntros(stylistName) {
  const withWhom = stylistName || 'your stylist'
  return {
    7: `Your appointment with ${withWhom} is coming up next week.`,
    3: `Just a reminder that your appointment with ${withWhom} is coming up soon.`,
    2: `Just a reminder that your appointment with ${withWhom} is in two days.`,
    1: `Your appointment with ${withWhom} is tomorrow.`,
    '24h': `Your appointment with ${withWhom} is tomorrow.`,
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function formatAppointmentWhen(dateKey, startTime) {
  try {
    const [y, m, d] = dateKey.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const dateLabel = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
    const [hh, mm] = String(startTime).split(':').map(Number)
    const minutes = hh * 60 + mm
    const period = minutes >= 12 * 60 ? 'PM' : 'AM'
    const hour12 = ((hh + 11) % 12) + 1
    const timeLabel = `${hour12}:${String(mm).padStart(2, '0')} ${period}`
    return { dateLabel, timeLabel }
  } catch {
    return { dateLabel: dateKey, timeLabel: startTime }
  }
}

export function buildReminderEmail({
  reminderType,
  client,
  appointment,
  confirmationUrl,
  manageUrl,
  fromName,
  salonName,
  stylistName,
} = {}) {
  const branding = resolveSalonBranding({
    salonName: salonName || fromName,
    stylistName,
  })
  const displaySalon = branding.salonName
  const displayStylist = branding.stylistName
  const firstName = client?.firstName || client?.displayName?.split(/\s+/)[0] || 'there'
  const intros = buildIntros(displayStylist)
  const intro = intros[reminderType] || intros[3]
  const { dateLabel, timeLabel } = formatAppointmentWhen(
    appointment.date,
    appointment.startTime,
  )
  const service = appointment.service || 'Appointment'
  const pending = appointment?.status !== 'confirmed'
  const confirmLink = pending ? confirmationUrl || '' : ''
  const manageLink = manageUrl || ''

  const subject = `Appointment Reminder — ${displaySalon}`

  const text = [
    `${displaySalon}`,
    '',
    `Hi ${firstName},`,
    '',
    intro,
    '',
    dateLabel,
    timeLabel,
    service,
    '',
    confirmLink ? `Confirm Appointment: ${confirmLink}` : null,
    manageLink ? `Manage Appointment: ${manageLink}` : null,
    '',
    'Need to reschedule or cancel? Use Manage Appointment. Opening the confirm link does not confirm until you press the button.',
    '',
    'Thank you,',
    displayStylist,
    displaySalon,
  ]
    .filter((line) => line != null)
    .join('\n')

  const confirmButton = confirmLink
    ? `<a href="${escapeHtml(confirmLink)}"
       style="display:inline-block;background:#2a7a6e;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600;margin:0 8px 10px 0;">
      Confirm Appointment
    </a>`
    : ''

  const manageButton = manageLink
    ? `<a href="${escapeHtml(manageLink)}"
       style="display:inline-block;background:#ffffff;color:#302724;border:1px solid #302724;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600;margin:0 8px 10px 0;">
      Manage Appointment
    </a>`
    : ''

  const html = `<!DOCTYPE html>
<html><body style="font-family:Georgia,serif;color:#2c2422;line-height:1.5;padding:24px;">
  <h1 style="font-size:22px;margin:0 0 16px;">${escapeHtml(displaySalon)}</h1>
  <p>Hi ${escapeHtml(firstName)},</p>
  <p>${escapeHtml(intro)}</p>
  <p style="font-size:18px;margin:20px 0;">
    <strong>${escapeHtml(dateLabel)}</strong><br/>
    ${escapeHtml(timeLabel)}<br/>
    ${escapeHtml(service)}
  </p>
  <p style="margin:16px 0 8px;">
    ${confirmButton}
    ${manageButton}
  </p>
  <p style="font-size:13px;color:#6b5f5c;">
    Need to reschedule or cancel? Use Manage Appointment. Opening the confirm link does not confirm until you press the button.
  </p>
  <p>Thank you,<br/>${escapeHtml(displayStylist)}<br/>${escapeHtml(displaySalon)}</p>
</body></html>`

  return { subject, text, html }
}
