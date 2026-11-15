/**
 * Customer and salon-owner notice emails. Recipients come from settings or the client record.
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function formatAppointmentWhen(dateKey, startTime) {
  try {
    const [year, month, day] = String(dateKey).split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const dateLabel = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
    const [hour, minute] = String(startTime || '00:00').split(':').map(Number)
    const period = hour >= 12 ? 'PM' : 'AM'
    const hour12 = ((hour + 11) % 12) + 1
    const timeLabel = `${hour12}:${String(minute).padStart(2, '0')} ${period}`
    return { dateLabel, timeLabel }
  } catch {
    return { dateLabel: dateKey || '', timeLabel: startTime || '' }
  }
}

function clientName(client, appointment) {
  const composed = [client?.firstName, client?.lastName]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ')
  return composed || String(appointment?.clientName || '').trim() || 'A client'
}

function whenLine(date, time) {
  const formatted = formatAppointmentWhen(date, time)
  return `${formatted.dateLabel} — ${formatted.timeLabel}`
}

function button(href, label, tone) {
  const background = tone === 'confirm' ? '#2a7a6e' : '#ffffff'
  const color = tone === 'confirm' ? '#ffffff' : '#302724'
  const border = tone === 'confirm' ? '0' : '1px solid #302724'
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${background};color:${color};border:${border};text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600;margin:0 8px 10px 0;">${escapeHtml(label)}</a>`
}

export function buildBookingConfirmationEmail({
  salonName = 'Salon',
  client,
  appointment,
  confirmUrl,
  manageUrl,
}) {
  const name = String(salonName || '').trim() || 'Salon'
  const first = String(client?.firstName || 'there').trim() || 'there'
  const when = formatAppointmentWhen(appointment?.date, appointment?.startTime)
  const service = appointment?.service || 'Appointment'
  const pending = appointment?.status !== 'confirmed'
  const subject = pending ? `Confirm your appointment — ${name}` : `Your appointment — ${name}`
  const intro = pending
    ? 'Please confirm your upcoming appointment.'
    : 'Your appointment is confirmed.'
  const text = [
    name,
    '',
    `Hi ${first},`,
    '',
    intro,
    '',
    `Service: ${service}`,
    `Date: ${when.dateLabel}`,
    `Time: ${when.timeLabel}`,
    '',
    pending && confirmUrl ? `Confirm Appointment: ${confirmUrl}` : null,
    manageUrl ? `Manage Appointment: ${manageUrl}` : null,
    '',
    'Need to reschedule or cancel? Use Manage Appointment. Opening the confirm link does not confirm until you press the button.',
  ]
    .filter((line) => line != null)
    .join('\n')
  const html = `<!DOCTYPE html><body style="font-family:Georgia,serif;color:#2c2420;line-height:1.5;padding:24px;">
    <h1 style="font-size:22px;margin:0 0 12px;">${escapeHtml(name)}</h1>
    <p>Hi ${escapeHtml(first)},</p>
    <p>${escapeHtml(intro)}</p>
    <p><strong>Service:</strong> ${escapeHtml(service)}<br/><strong>Date:</strong> ${escapeHtml(when.dateLabel)}<br/><strong>Time:</strong> ${escapeHtml(when.timeLabel)}</p>
    <p>${pending && confirmUrl ? button(confirmUrl, 'Confirm Appointment', 'confirm') : ''}${manageUrl ? button(manageUrl, 'Manage Appointment', 'manage') : ''}</p>
    <p>Need to reschedule or cancel? Use Manage Appointment.</p>
  </body>`
  return { subject, text, html, fromName: name }
}

export function buildNoticeEmail({ audience, event, appointment, client, schedule, stylistAppUrl }) {
  const salonName = String(schedule?.salonName || '').trim() || 'Salon'
  const name = clientName(client, appointment)
  const service = appointment?.service || 'Appointment'
  const original = whenLine(appointment?.date, appointment?.startTime)
  const requested = appointment?.rescheduleRequest
  const requestedWhen = requested
    ? whenLine(requested.date, requested.startTime)
    : ''
  const openLine = stylistAppUrl ? `Open in Simple Salon: ${stylistAppUrl}` : 'Open Simple Salon to review this appointment.'

  if (audience === 'owner' && event === 'newCustomerBooking') {
    return {
      to: schedule?.contactEmail || '',
      subject: `New Customer Booking — ${name}`,
      text: [
        salonName,
        '',
        'A new customer booked online.',
        '',
        `Name: ${name}`,
        `Email: ${client?.email || ''}`,
        `Phone: ${client?.phone || ''}`,
        `Service: ${service}`,
        `Appointment: ${original}`,
        'Status: Pending confirmation',
        '',
        openLine,
      ].join('\n'),
    }
  }
  if (audience === 'owner' && event === 'rescheduleRequested') {
    return {
      to: schedule?.contactEmail || '',
      subject: `Reschedule Requested — ${name}`,
      text: [
        salonName,
        '',
        `${name} requested a new time.`,
        '',
        `Service: ${service}`,
        `Current appointment: ${original}`,
        `Requested appointment: ${requestedWhen}`,
        `Requested at: ${requested?.requestedAt || ''}`,
        '',
        openLine,
      ].join('\n'),
    }
  }
  if (audience === 'owner' && event === 'canceled') {
    return {
      to: schedule?.contactEmail || '',
      subject: `Appointment Canceled — ${name}`,
      text: [
        salonName,
        '',
        `${name} has a canceled appointment.`,
        '',
        `Service: ${service}`,
        `Appointment: ${original}`,
        `Canceled at: ${appointment?.canceledAt || ''}`,
        `Source: ${appointment?.cancellationSource || 'unknown'}`,
      ].join('\n'),
    }
  }
  if (audience === 'customer' && event === 'rescheduleApproved') {
    const approved = whenLine(appointment?.date, appointment?.startTime)
    return {
      to: client?.email || '',
      subject: `Reschedule Approved — ${salonName}`,
      text: [
        salonName,
        '',
        `Hi ${client?.firstName || 'there'},`,
        '',
        'Your new appointment time is confirmed.',
        '',
        `Service: ${service}`,
        `Appointment: ${approved}`,
      ].join('\n'),
    }
  }
  if (audience === 'customer' && event === 'rescheduleDeclined') {
    return {
      to: client?.email || '',
      subject: `Reschedule Declined — ${salonName}`,
      text: [
        salonName,
        '',
        `Hi ${client?.firstName || 'there'},`,
        '',
        'The requested time was not approved. Your original appointment remains scheduled.',
        '',
        `Service: ${service}`,
        `Appointment: ${original}`,
      ].join('\n'),
    }
  }
  if (audience === 'customer' && event === 'canceled') {
    return {
      to: client?.email || '',
      subject: `Appointment Canceled — ${salonName}`,
      text: [
        salonName,
        '',
        `Hi ${client?.firstName || 'there'},`,
        '',
        'Your appointment has been canceled.',
        '',
        `Service: ${service}`,
        `Appointment: ${original}`,
      ].join('\n'),
    }
  }
  return null
}

export async function deliverConfirmationEmail({
  dryRun = true,
  fromEmail = '',
  to,
  message,
  sendEmail,
}) {
  if (dryRun || !fromEmail || !to || !message) return { status: 'not_sent' }
  try {
    await sendEmail({
      to,
      fromEmail,
      fromName: message.fromName,
      subject: message.subject,
      text: message.text,
      html: message.html,
    })
    return { status: 'sent' }
  } catch (error) {
    return { status: 'failed', error: error?.message || 'send_failed' }
  }
}
