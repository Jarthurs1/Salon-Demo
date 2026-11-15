/**
 * Correlate inbound SMS YES replies to the correct pending appointment.
 * Never guess when multiple outstanding confirmations exist for one phone.
 */

import { normalizeConfirmationMeta } from './appointmentConfirmationMeta.js'
import { isBlockedAppointment, isConfirmedAppointment } from './reminderEligibility.js'
import { classifyInboundSmsCommand, normalizeUsE164 } from './smsConsent.js'
import { getSalonDate, isPastAppointmentDate } from './salonTime.js'

export function normalizeInboundBody(body) {
  return classifyInboundSmsCommand(body)
}

/**
 * Find pending appointments that have an outstanding SMS confirmation request
 * for this phone number.
 */
export function findOutstandingSmsAppointments(appointments, phoneE164, options = {}) {
  const now = options.now ? new Date(options.now) : new Date()
  const salonToday = options.salonToday || getSalonDate(now)
  const phone = normalizeUsE164(phoneE164)
  if (!phone) return []

  return (Array.isArray(appointments) ? appointments : []).filter((appt) => {
    if (!appt || isBlockedAppointment(appt)) return false
    if (isConfirmedAppointment(appt)) return false
    if (isPastAppointmentDate(appt.date, salonToday)) return false
    if (appt.status === 'cancelled' || appt.cancelledAt) return false

    const { reminders, sms } = normalizeConfirmationMeta(appt)
    const reminderSent = Boolean(reminders.oneDaySentAt || sms.outboundSentAt)
    if (!reminderSent) return false

    const apptPhone = normalizeUsE164(sms.phoneE164)
    return apptPhone === phone
  })
}

/**
 * Match inbound SMS to an appointment.
 * @returns {{
 *   status: 'matched' | 'ambiguous' | 'none' | 'already_confirmed' | 'command',
 *   appointment: object | null,
 *   command: object,
 *   candidates: object[],
 * }}
 */
export function matchInboundSmsReply(appointments, phoneE164, body, options = {}) {
  const command = normalizeInboundBody(body)
  const phone = normalizeUsE164(phoneE164)

  if (!phone) {
    return { status: 'none', appointment: null, command, candidates: [] }
  }

  if (command.type !== 'confirm_yes') {
    return { status: 'command', appointment: null, command, candidates: [] }
  }

  const candidates = findOutstandingSmsAppointments(appointments, phone, options)

  if (candidates.length === 0) {
    // Maybe already confirmed for this phone recently — do not invent a match
    const already = (Array.isArray(appointments) ? appointments : []).filter((appt) => {
      const { sms } = normalizeConfirmationMeta(appt)
      return normalizeUsE164(sms.phoneE164) === phone && isConfirmedAppointment(appt)
    })
    if (already.length === 1) {
      return {
        status: 'already_confirmed',
        appointment: already[0],
        command,
        candidates: already,
      }
    }
    return { status: 'none', appointment: null, command, candidates: [] }
  }

  if (candidates.length > 1) {
    // Prefer explicit conversation / outbound message id / correlation ref
    const messageId = options.previousPublishedMessageId || options.outboundMessageId
    if (messageId) {
      const byMsg = candidates.filter((a) => {
        const { sms } = normalizeConfirmationMeta(a)
        return sms.outboundMessageId && sms.outboundMessageId === messageId
      })
      if (byMsg.length === 1) {
        return { status: 'matched', appointment: byMsg[0], command, candidates: byMsg }
      }
    }
    const ref = String(options.correlationRef || '').toLowerCase()
    if (ref) {
      const byRef = candidates.filter((a) => {
        const { sms } = normalizeConfirmationMeta(a)
        const id = String(sms.conversationId || '').replace(/^smsconv-/, '').toLowerCase()
        return id.startsWith(ref) || id === ref
      })
      if (byRef.length === 1) {
        return { status: 'matched', appointment: byRef[0], command, candidates: byRef }
      }
    }
    return { status: 'ambiguous', appointment: null, command, candidates }
  }

  return { status: 'matched', appointment: candidates[0], command, candidates }
}
