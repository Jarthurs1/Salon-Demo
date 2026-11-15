/**
 * Confirmation / reschedule / cancel result pages (mobile-friendly, no admin UI).
 */

import { formatAppointmentWhen } from './reminderEmail.js'
import { buildConfirmationUrl } from './confirmationTokens.js'
import { resolveSalonBranding } from './salonBranding.js'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function shell({ title, heading, bodyHtml, salonName }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#faf7f5" />
  <title>${escapeHtml(title)}</title>
  <style>
    body{margin:0;font-family:Georgia,"Times New Roman",serif;background:#faf7f5;color:#2c2422;}
    main{max-width:420px;margin:0 auto;padding:2.5rem 1.25rem;}
    h1{font-size:1.35rem;margin:0 0 .5rem;}
    .brand{font-size:.85rem;letter-spacing:.04em;color:#8a7e7a;margin-bottom:1.5rem;}
    .card{background:#fff;border-radius:1rem;padding:1.25rem;box-shadow:0 8px 24px rgba(40,30,28,.08);}
    .ok{color:#2a7a6e;font-weight:700;font-size:1.15rem;margin:0 0 .75rem;}
    .warn{color:#b8651a;font-weight:700;font-size:1.15rem;margin:0 0 .75rem;}
    .danger{color:#a83d4c;font-weight:700;font-size:1.15rem;margin:0 0 .75rem;}
    .meta{font-size:1.05rem;line-height:1.55;margin:0;}
    .note{margin-top:1.25rem;color:#5c4f4a;font-size:.95rem;}
    .actions{display:flex;flex-direction:column;gap:.75rem;margin-top:1.35rem;}
    .btn{display:block;text-align:center;text-decoration:none;padding:14px 18px;border-radius:999px;font-weight:700;font-size:1rem;border:0;width:100%;}
    .btn-primary{background:#2c2420;color:#fff;}
    .btn-danger{background:#a83d4c;color:#fff;}
    .btn-ghost{background:transparent;color:#5c4f4a;border:1px solid rgba(40,30,28,.18);}
  </style>
</head>
<body>
  <main>
    <p class="brand">${escapeHtml(salonName)}</p>
    <div class="card">
      <h1>${escapeHtml(heading)}</h1>
      ${bodyHtml}
    </div>
  </main>
</body>
</html>`
}

function appointmentMeta(appointment, options = {}) {
  const branding = resolveSalonBranding(options)
  const { dateLabel, timeLabel } = formatAppointmentWhen(
    appointment.date,
    appointment.startTime,
  )
  return `
    <p class="meta">
      <strong>${escapeHtml(branding.salonName)}</strong><br/>
      with ${escapeHtml(branding.stylistName)}<br/><br/>
      <strong>${escapeHtml(dateLabel)}</strong><br/>
      ${escapeHtml(timeLabel)}<br/>
      ${escapeHtml(appointment.service || 'Appointment')}
    </p>`
}

export function renderConfirmationPage(result, appointment, options = {}) {
  const branding = resolveSalonBranding(options)
  const { salonName, stylistName } = branding
  const cancelConfirmUrl = options.cancelConfirmUrl || null
  const keepUrl = options.keepUrl || null

  if (result === 'preview') {
    return shell({
      salonName,
      title: 'Manage appointment',
      heading: 'Manage your appointment',
      bodyHtml: `
        ${appointment ? appointmentMeta(appointment, branding) : ''}
        <p class="note">Opening this link does not change your appointment. Use Manage Appointment in your email to request a new time or cancel.</p>`,
    })
  }

  if (result === 'confirm_prompt') {
    return shell({
      salonName,
      title: 'Confirm appointment',
      heading: 'Confirm your appointment',
      bodyHtml: `
        ${appointment ? appointmentMeta(appointment, branding) : ''}
        <form method="post" action="${escapeHtml(options.postUrl || '')}">
          <input type="hidden" name="token" value="${escapeHtml(options.rawToken || '')}" />
          <input type="hidden" name="action" value="confirm" />
          <button class="btn btn-primary" type="submit">Confirm Appointment</button>
        </form>
        <p class="note">Opening this page does not confirm the appointment until you press the button.</p>`,
    })
  }

  if (result === 'confirmed' || result === 'already_confirmed') {
    const already = result === 'already_confirmed'
    return shell({
      salonName,
      title: already ? 'Already confirmed' : 'Appointment confirmed',
      heading: already ? 'Your appointment is already confirmed.' : 'Appointment Confirmed',
      bodyHtml: `
        <p class="ok">${already ? '✓ Already confirmed' : '✓ Appointment Confirmed'}</p>
        <p class="meta">Your appointment with ${escapeHtml(stylistName)} is confirmed.</p>
        ${appointment ? appointmentMeta(appointment, branding) : ''}
        <p class="note">We look forward to seeing you!</p>`,
    })
  }

  if (result === 'reschedule_requested' || result === 'already_reschedule_requested') {
    const already = result === 'already_reschedule_requested'
    return shell({
      salonName,
      title: already ? 'Reschedule already requested' : 'Reschedule requested',
      heading: already
        ? 'Your reschedule request is already on file.'
        : 'Reschedule Request Received',
      bodyHtml: `
        <p class="warn">${already ? '✓ Already requested' : '✓ Reschedule requested'}</p>
        <p class="meta">
          ${escapeHtml(salonName)} has been notified and will message you to reschedule your appointment.
        </p>
        ${appointment ? appointmentMeta(appointment, branding) : ''}
        <p class="note">No need to reply to the reminder email.</p>`,
    })
  }

  if (result === 'cancel_prompt') {
    return shell({
      salonName,
      title: 'Cancel appointment?',
      heading: 'Cancel Appointment',
      bodyHtml: `
        ${appointment ? appointmentMeta(appointment, branding) : ''}
        <p class="note">Are you sure you want to cancel this appointment?</p>
        <div class="actions">
          ${
            options.rawToken
              ? `<form method="post" action="${escapeHtml(options.postUrl || '')}">
                  <input type="hidden" name="token" value="${escapeHtml(options.rawToken)}" />
                  <input type="hidden" name="action" value="cancel_confirm" />
                  <button class="btn btn-danger" type="submit">Confirm Cancellation</button>
                </form>`
              : cancelConfirmUrl
                ? `<a class="btn btn-danger" href="${escapeHtml(cancelConfirmUrl)}">Confirm Cancellation</a>`
                : ''
          }
          ${
            keepUrl
              ? `<a class="btn btn-ghost" href="${escapeHtml(keepUrl)}">Keep Appointment</a>`
              : `<p class="note">You can close this page to keep your appointment.</p>`
          }
        </div>`,
    })
  }

  if (result === 'canceled' || result === 'already_canceled') {
    const already = result === 'already_canceled'
    return shell({
      salonName,
      title: already ? 'Already canceled' : 'Appointment canceled',
      heading: already ? 'This appointment is already canceled.' : 'Appointment Canceled',
      bodyHtml: `
        <p class="danger">${already ? '✓ Already canceled' : '✓ Appointment canceled'}</p>
        <p class="meta">
          ${
            already
              ? 'No further action is needed.'
              : `${escapeHtml(salonName)} has been notified of your cancellation.`
          }
        </p>
        ${appointment ? appointmentMeta(appointment, branding) : ''}
        <p class="note">If you still need an appointment, please contact ${escapeHtml(stylistName)} to book a new time.</p>`,
    })
  }

  if (result === 'kept') {
    return shell({
      salonName,
      title: 'Appointment kept',
      heading: 'Your appointment is still scheduled.',
      bodyHtml: `
        <p class="ok">✓ Appointment kept</p>
        ${appointment ? appointmentMeta(appointment, branding) : ''}
        <p class="note">No changes were made. We look forward to seeing you!</p>`,
    })
  }

  if (result === 'conflict') {
    return shell({
      salonName,
      title: 'Appointment already confirmed',
      heading: 'This appointment is already confirmed.',
      bodyHtml: `
        <p class="ok">✓ Already confirmed</p>
        <p class="note">
          A reschedule request cannot change a confirmed appointment.
          Please contact ${escapeHtml(stylistName)} if you need a different time.
        </p>
        ${appointment ? appointmentMeta(appointment, branding) : ''}`,
    })
  }

  if (result === 'past') {
    return shell({
      salonName,
      title: 'Appointment passed',
      heading: 'This appointment has already passed.',
      bodyHtml: `<p class="note">Please contact ${escapeHtml(stylistName)} if you have any questions.</p>`,
    })
  }

  return shell({
    salonName,
    title: 'Link not found',
    heading: "We couldn't process this appointment link.",
    bodyHtml: `<p class="note">Please contact ${escapeHtml(stylistName)} if you need assistance.</p>`,
  })
}

export function buildCancelPageOptions(rawToken, baseUrl, branding = {}) {
  const postUrl = `${String(baseUrl || '').replace(/\/$/, '')}/confirm`
  return {
    ...branding,
    rawToken,
    postUrl,
    cancelConfirmUrl: buildConfirmationUrl(baseUrl, rawToken, 'cancel_confirm'),
    keepUrl: buildConfirmationUrl(baseUrl, rawToken, 'keep'),
  }
}
