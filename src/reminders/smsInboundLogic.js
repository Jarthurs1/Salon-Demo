/**
 * Pure inbound SMS processing — confirm YES, STOP/CANCEL opt-out, HELP, START.
 * CANCEL as an SMS keyword opts out of texts — it never cancels the appointment.
 */

import { applySmsConfirm, normalizeConfirmationMeta } from './appointmentConfirmationMeta.js'
import {
  applySmsOptIn,
  applySmsOptOut,
  normalizeUsE164,
  SMS_CONSENT_SOURCE_SMS_START,
} from './smsConsent.js'
import {
  buildHelpAcknowledgmentSms,
  buildStartAcknowledgmentSms,
  buildStopAcknowledgmentSms,
} from './smsDisclosure.js'
import { matchInboundSmsReply } from './smsReplyMatching.js'
import {
  isCanceledAppointment,
  isConfirmedAppointment,
  isRescheduleRequestedAppointment,
} from './reminderEligibility.js'

/**
 * @returns {{
 *   appointments: object[],
 *   clients: object[],
 *   result: string,
 *   appointment: object | null,
 *   client: object | null,
 *   forward: object | null,
 *   replySms: string | null,
 * }}
 */
export function processInboundSms({
  appointments,
  clients,
  phoneE164,
  body,
  options = {},
}) {
  const phone = normalizeUsE164(phoneE164)
  const list = Array.isArray(appointments) ? [...appointments] : []
  const clientList = Array.isArray(clients) ? [...clients] : []
  const atIso = options.atIso || new Date().toISOString()

  if (!phone) {
    return {
      appointments: list,
      clients: clientList,
      result: 'unknown_phone',
      appointment: null,
      client: null,
      forward: null,
      replySms: null,
    }
  }

  const match = matchInboundSmsReply(list, phone, body, {
    ...options,
    correlationRef: options.correlationRef,
  })
  const clientIdx = clientList.findIndex((c) => normalizeUsE164(c.phone) === phone)
  const client = clientIdx >= 0 ? clientList[clientIdx] : null

  const schedule = options.schedule || {
    salonName: options.salonName,
    contactPhone: options.contactPhone,
    contactEmail: options.contactEmail,
    smsRegisteredBrand: options.smsRegisteredBrand,
  }
  // When AWS End User Messaging already auto-replies to STOP/HELP, skip app replies.
  const providerHandlesKeywords = options.providerHandlesKeywords === true

  if (match.command.type === 'stop') {
    if (clientIdx >= 0) {
      clientList[clientIdx] = applySmsOptOut(clientList[clientIdx], atIso, {
        keyword: match.command.normalized,
        source: 'sms_keyword',
      })
    }
    return {
      // Appointments intentionally untouched — CANCEL/STOP never cancel the booking.
      appointments: list,
      clients: clientList,
      result: 'opted_out',
      appointment: null,
      client: clientList[clientIdx] || null,
      forward: {
        subjectHint: match.command.normalized || 'STOP',
        body: String(body || '').trim().slice(0, 40),
        outcome: 'Customer opted out of SMS. Appointment unchanged.',
      },
      replySms: providerHandlesKeywords
        ? null
        : buildStopAcknowledgmentSms(schedule),
    }
  }

  if (match.command.type === 'start') {
    if (clientIdx >= 0) {
      clientList[clientIdx] = applySmsOptIn(
        clientList[clientIdx],
        atIso,
        SMS_CONSENT_SOURCE_SMS_START,
        {
          keyword: match.command.normalized,
          disclosureVersion: options.disclosureVersion,
        },
      )
    }
    return {
      appointments: list,
      clients: clientList,
      result: 'opted_in',
      appointment: null,
      client: clientList[clientIdx] || null,
      forward: {
        subjectHint: match.command.normalized || 'START',
        body: String(body || '').trim().slice(0, 40),
        outcome:
          'Customer re-subscribed via carrier keyword. Confirm provider opt-out list is cleared before sending.',
      },
      replySms: providerHandlesKeywords
        ? null
        : buildStartAcknowledgmentSms(schedule),
    }
  }

  if (match.command.type === 'help') {
    return {
      appointments: list,
      clients: clientList,
      result: 'help',
      appointment: null,
      client,
      forward: {
        subjectHint: 'HELP',
        body: String(body || '').trim().slice(0, 40),
        outcome: 'Customer requested HELP.',
      },
      replySms: providerHandlesKeywords
        ? null
        : buildHelpAcknowledgmentSms(schedule),
    }
  }

  if (match.status === 'ambiguous') {
    return {
      appointments: list,
      clients: clientList,
      result: 'ambiguous',
      appointment: null,
      client,
      forward: {
        subjectHint: 'Ambiguous YES',
        body: String(body || '').trim(),
        outcome: 'Multiple pending SMS confirmations — no appointment changed.',
      },
      replySms: null,
    }
  }

  if (match.status === 'already_confirmed') {
    return {
      appointments: list,
      clients: clientList,
      result: 'already_confirmed',
      appointment: match.appointment,
      client,
      forward: {
        subjectHint: 'Duplicate YES',
        body: String(body || '').trim(),
        outcome: 'Appointment already confirmed — no change.',
      },
      replySms: null,
    }
  }

  if (match.status === 'matched' && match.command.type === 'confirm_yes') {
    const idx = list.findIndex((a) => a.id === match.appointment.id)
    if (idx === -1) {
      return {
        appointments: list,
        clients: clientList,
        result: 'none',
        appointment: null,
        client,
        forward: null,
        replySms: null,
      }
    }
    const target = list[idx]
    if (
      isCanceledAppointment(target) ||
      isRescheduleRequestedAppointment(target)
    ) {
      return {
        appointments: list,
        clients: clientList,
        result: 'ineligible',
        appointment: target,
        client,
        forward: {
          subjectHint: 'YES ignored',
          body: String(body || '').trim().slice(0, 40),
          outcome:
            'YES ignored — appointment is canceled or awaiting reschedule.',
        },
        replySms: null,
      }
    }
    if (isConfirmedAppointment(target)) {
      return {
        appointments: list,
        clients: clientList,
        result: 'already_confirmed',
        appointment: target,
        client,
        forward: {
          subjectHint: 'Duplicate YES',
          body: String(body || '').trim().slice(0, 40),
          outcome: 'Appointment already confirmed — no change.',
        },
        replySms: null,
      }
    }

    const confirmed = applySmsConfirm(target, atIso, {
      lastInboundAt: atIso,
      lastInboundBody: String(body || '').trim().slice(0, 40),
    })
    list[idx] = confirmed

    const name = client?.firstName || confirmed.clientName || 'Customer'
    return {
      appointments: list,
      clients: clientList,
      result: 'confirmed',
      appointment: confirmed,
      client,
      forward: {
        subjectHint: `${name} — ${confirmed.date} ${confirmed.startTime}`,
        body: String(body || '').trim().slice(0, 40),
        outcome: 'Appointment automatically confirmed.',
      },
      // Avoid YES confirmation SMS loops / extra segments unless explicitly enabled.
      replySms: options.sendAcknowledgment === true
        ? `Thanks! Your appointment with ${String(options.salonName || 'Your Salon').trim() || 'Your Salon'} is confirmed. Reply STOP to opt out.`
        : null,
    }
  }

  // Freeform or unmatched YES
  const { sms } = match.appointment
    ? normalizeConfirmationMeta(match.appointment)
    : { sms: {} }

  return {
    appointments: list,
    clients: clientList,
    result: match.command.type === 'freeform' ? 'freeform' : 'none',
    appointment: match.appointment,
    client,
    forward: {
      subjectHint: client?.firstName || phone,
      body: String(body || '').trim(),
      outcome: match.command.type === 'freeform'
        ? 'Customer message forwarded — no automatic appointment change.'
        : 'No matching pending SMS confirmation.',
      conversationId: sms.conversationId || null,
    },
    replySms: null,
  }
}
