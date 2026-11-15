/**
 * Confirm, request-reschedule, or cancel by raw token — pure business logic.
 */

import { tokensMatch } from './confirmationTokens.js'
import {
  isBlockedAppointment,
  isCanceledAppointment,
  isConfirmedAppointment,
} from './reminderEligibility.js'
import {
  applyCancelAppointment,
  applyLinkConfirm,
  applyRescheduleRequest,
  normalizeConfirmationMeta,
} from './appointmentConfirmationMeta.js'
import { isPastAppointmentDate, getSalonDate } from './salonTime.js'

export function normalizeConfirmationAction(action) {
  const raw = String(action || 'confirm').trim().toLowerCase()
  if (raw === 'reschedule' || raw === 'request_reschedule') return 'reschedule'
  if (raw === 'cancel') return 'cancel'
  if (raw === 'cancel_confirm' || raw === 'confirm_cancel') return 'cancel_confirm'
  if (raw === 'keep') return 'keep'
  return 'confirm'
}

function findByToken(list, rawToken) {
  return list.findIndex((appt) => {
    const { confirmation } = normalizeConfirmationMeta(appt)
    return tokensMatch(rawToken, confirmation.tokenHash)
  })
}

/**
 * @returns {{
 *   status:
 *     | 'confirmed'
 *     | 'already_confirmed'
 *     | 'reschedule_requested'
 *     | 'already_reschedule_requested'
 *     | 'cancel_prompt'
 *     | 'canceled'
 *     | 'already_canceled'
 *     | 'kept'
 *     | 'invalid'
 *     | 'past'
 *     | 'blocked'
 *     | 'conflict',
 *   appointment: object | null,
 *   appointments: object[],
 *   action: string,
 *   mutates: boolean,
 * }}
 */
export function processAppointmentActionByToken(
  appointments,
  rawToken,
  actionInput = 'confirm',
  options = {},
) {
  const action = normalizeConfirmationAction(actionInput)
  const now = options.now ? new Date(options.now) : new Date()
  const salonToday = options.salonToday || getSalonDate(now)
  const list = Array.isArray(appointments) ? appointments : []
  const atIso = options.atIso || now.toISOString()

  if (!rawToken) {
    return {
      status: 'invalid',
      appointment: null,
      appointments: list,
      action,
      mutates: false,
    }
  }

  const index = findByToken(list, rawToken)
  if (index === -1) {
    return {
      status: 'invalid',
      appointment: null,
      appointments: list,
      action,
      mutates: false,
    }
  }

  const current = list[index]
  if (isBlockedAppointment(current)) {
    return {
      status: 'blocked',
      appointment: current,
      appointments: list,
      action,
      mutates: false,
    }
  }

  if (isCanceledAppointment(current)) {
    return {
      status: 'already_canceled',
      appointment: current,
      appointments: list,
      action,
      mutates: false,
    }
  }

  if (action === 'keep') {
    return {
      status: 'kept',
      appointment: current,
      appointments: list,
      action,
      mutates: false,
    }
  }

  if (action === 'cancel') {
    if (isPastAppointmentDate(current.date, salonToday)) {
      return {
        status: 'past',
        appointment: current,
        appointments: list,
        action,
        mutates: false,
      }
    }
    return {
      status: 'cancel_prompt',
      appointment: current,
      appointments: list,
      action,
      mutates: false,
    }
  }

  if (action === 'cancel_confirm') {
    if (isPastAppointmentDate(current.date, salonToday)) {
      return {
        status: 'past',
        appointment: current,
        appointments: list,
        action,
        mutates: false,
      }
    }
    const canceled = applyCancelAppointment(current, atIso)
    const next = [...list]
    next[index] = canceled
    return {
      status: 'canceled',
      appointment: canceled,
      appointments: next,
      action,
      mutates: true,
    }
  }

  if (isPastAppointmentDate(current.date, salonToday)) {
    return {
      status: 'past',
      appointment: current,
      appointments: list,
      action,
      mutates: false,
    }
  }

  if (action === 'confirm') {
    if (isConfirmedAppointment(current)) {
      return {
        status: 'already_confirmed',
        appointment: current,
        appointments: list,
        action,
        mutates: false,
      }
    }
    const confirmed = applyLinkConfirm(current, atIso)
    const next = [...list]
    next[index] = confirmed
    return {
      status: 'confirmed',
      appointment: confirmed,
      appointments: next,
      action,
      mutates: true,
    }
  }

  // reschedule
  if (isConfirmedAppointment(current)) {
    return {
      status: 'conflict',
      appointment: current,
      appointments: list,
      action,
      mutates: false,
    }
  }

  if (current.status === 'reschedule_requested') {
    return {
      status: 'already_reschedule_requested',
      appointment: current,
      appointments: list,
      action,
      mutates: false,
    }
  }

  const requested = applyRescheduleRequest(current, atIso)
  const next = [...list]
  next[index] = requested
  return {
    status: 'reschedule_requested',
    appointment: requested,
    appointments: next,
    action,
    mutates: true,
  }
}

/** Backward-compatible confirm-only helper. */
export function confirmAppointmentByToken(appointments, rawToken, options = {}) {
  const result = processAppointmentActionByToken(
    appointments,
    rawToken,
    'confirm',
    options,
  )
  return {
    status: result.status,
    appointment: result.appointment,
    appointments: result.appointments,
  }
}
