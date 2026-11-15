/**
 * Customer manage / confirm / cancel / reschedule rules.
 * Browser-safe. Appointment changes stay on the original record.
 */

import { getHoursUntilAppointmentStart, getSalonDate } from '../reminders/salonTime.js'

export const CUSTOMER_CUTOFFS = [
  { id: 'anytime', label: 'Anytime before appointment' },
  { id: 'not_same_day', label: 'Not on the appointment date' },
  { id: '24h', label: 'At least 24 hours before appointment' },
  { id: '48h', label: 'At least 48 hours before appointment' },
]

const CUTOFF_IDS = new Set(CUSTOMER_CUTOFFS.map((item) => item.id))

export function normalizeCustomerCutoff(value) {
  return CUTOFF_IDS.has(value) ? value : 'not_same_day'
}

function statusOf(appointment) {
  return String(appointment?.status || '').toLowerCase()
}

export function isCanceledStatus(status) {
  const key = String(status || '').toLowerCase()
  return key === 'canceled' || key === 'cancelled'
}

export function confirmationMutates(method, action) {
  const verb = String(method || 'GET').toUpperCase()
  const name = String(action || '').toLowerCase()
  if (verb !== 'POST') return false
  return name === 'confirm' || name === 'cancel_confirm'
}

export function evaluateCustomerCutoff(appointment, options = {}) {
  const cutoff = normalizeCustomerCutoff(options.cutoff)
  const timeZone = options.timeZone || 'America/New_York'
  const now = options.now ? new Date(options.now) : new Date()
  const salonToday = options.salonToday || getSalonDate(now, timeZone)
  const dateKey = String(appointment?.date || '')
  if (!dateKey || dateKey < salonToday) {
    return {
      allowed: false,
      code: 'past',
      message: 'This appointment has already passed.',
    }
  }
  const hours = getHoursUntilAppointmentStart(appointment, now, timeZone)
  if (cutoff === 'anytime' && (hours == null || hours <= 0)) {
    return {
      allowed: false,
      code: 'past',
      message: 'This appointment has already passed.',
    }
  }
  if (cutoff === 'not_same_day' && dateKey <= salonToday) {
    return {
      allowed: false,
      code: 'cutoff',
      message:
        'Online changes are not available on the appointment date. Please contact the salon.',
    }
  }
  if (cutoff === '24h' || cutoff === '48h') {
    const required = cutoff === '48h' ? 48 : 24
    if (hours == null || hours < required) {
      return {
        allowed: false,
        code: 'cutoff',
        message: `Online changes require at least ${required} hours notice. Please contact the salon.`,
      }
    }
  }
  return { allowed: true, code: 'ok', message: '' }
}

function pendingRequest(appointment) {
  const request = appointment?.rescheduleRequest
  if (!request || request.status !== 'pending') return null
  if (!request.date || !request.startTime) return null
  return request
}

export function toPublicAppointment(appointment, options = {}) {
  const status = statusOf(appointment)
  const canceled = isCanceledStatus(status)
  const cutoff = evaluateCustomerCutoff(appointment, options)
  const request = pendingRequest(appointment)
  const canChange = !canceled && status !== 'blocked' && cutoff.allowed && !request
  return {
    salonName: String(options.salonName || '').trim() || 'Salon',
    service: appointment?.service || 'Appointment',
    serviceId: appointment?.serviceId || '',
    date: appointment?.date || '',
    startTime: appointment?.startTime || '',
    durationMinutes: Number(appointment?.durationMinutes) || 0,
    status,
    rescheduleRequest: request
      ? { date: request.date, startTime: request.startTime, status: 'pending' }
      : null,
    actions: {
      confirm: status === 'pending' && !canceled,
      reschedule: canChange,
      cancel: !canceled && status !== 'blocked' && cutoff.allowed && !request,
    },
    unavailableMessage: cutoff.allowed || canceled ? '' : cutoff.message,
    contactPhone: String(options.contactPhone || '').trim(),
    contactEmail: String(options.contactEmail || '').trim(),
  }
}

function priorStatus(appointment) {
  if (statusOf(appointment) === 'confirmed' || appointment?.confirmation?.confirmedAt) {
    return 'confirmed'
  }
  return 'pending'
}

function result(ok, code, appointment, extra = {}) {
  return { ok, code, appointment, mutates: Boolean(extra.mutates), ...extra }
}

export function confirmByCustomer(appointment, atIso) {
  if (!appointment) return result(false, 'invalid', null)
  if (isCanceledStatus(appointment.status)) {
    return result(false, 'canceled', appointment)
  }
  if (statusOf(appointment) === 'confirmed') {
    return result(true, 'already_confirmed', appointment)
  }
  if (statusOf(appointment) !== 'pending') {
    return result(false, 'not_pending', appointment)
  }
  return result(
    true,
    'confirmed',
    {
      ...appointment,
      status: 'confirmed',
      confirmation: {
        ...(appointment.confirmation || {}),
        confirmedAt: appointment.confirmation?.confirmedAt || atIso,
      },
    },
    { mutates: true },
  )
}

export function requestCustomerReschedule(appointment, proposal, atIso) {
  if (!appointment) return result(false, 'invalid', null)
  if (isCanceledStatus(appointment.status)) return result(false, 'canceled', appointment)
  const existing = pendingRequest(appointment)
  if (
    existing &&
    existing.date === proposal.date &&
    existing.startTime === proposal.startTime
  ) {
    return result(true, 'already_requested', appointment)
  }
  if (existing) return result(false, 'request_open', appointment)
  const next = {
    ...appointment,
    status: 'reschedule_requested',
    rescheduleRequest: {
      status: 'pending',
      date: proposal.date,
      startTime: proposal.startTime,
      requestedAt: atIso,
      resolvedAt: null,
      source: 'customer_website',
      priorStatus: priorStatus(appointment),
    },
    confirmation: {
      ...(appointment.confirmation || {}),
      rescheduleRequestedAt: appointment.confirmation?.rescheduleRequestedAt || atIso,
    },
  }
  return result(true, 'reschedule_requested', next, { mutates: true, notifyKey: atIso })
}

export function approveCustomerReschedule(appointment, { atIso, available }) {
  const request = pendingRequest(appointment)
  if (!request) {
    const code =
      appointment?.rescheduleRequest?.status === 'approved' ? 'already_approved' : 'no_request'
    return result(code === 'already_approved', code, appointment)
  }
  if (!available) {
    return result(false, 'conflict', appointment, {
      message: 'That time is no longer available.',
    })
  }
  const restored = request.priorStatus === 'confirmed' ? 'confirmed' : 'pending'
  const next = {
    ...appointment,
    date: request.date,
    startTime: request.startTime,
    status: restored,
    rescheduleRequest: { ...request, status: 'approved', resolvedAt: atIso },
    confirmation: {
      ...(appointment.confirmation || {}),
      confirmedAt:
        restored === 'confirmed'
          ? appointment.confirmation?.confirmedAt || atIso
          : appointment.confirmation?.confirmedAt || null,
    },
  }
  return result(true, 'approved', next, { mutates: true, notifyKey: request.requestedAt })
}

export function declineCustomerReschedule(appointment, atIso) {
  const request = appointment?.rescheduleRequest
  if (!request) return result(false, 'no_request', appointment)
  if (request.status === 'declined') return result(true, 'already_declined', appointment)
  if (request.status !== 'pending') return result(false, 'no_request', appointment)
  const restored = request.priorStatus === 'confirmed' ? 'confirmed' : 'pending'
  const next = {
    ...appointment,
    status: restored,
    rescheduleRequest: { ...request, status: 'declined', resolvedAt: atIso },
  }
  return result(true, 'declined', next, { mutates: true, notifyKey: request.requestedAt })
}

export function cancelByCustomer(appointment, atIso) {
  if (!appointment) return result(false, 'invalid', null)
  if (isCanceledStatus(appointment.status)) {
    return result(true, 'already_canceled', appointment)
  }
  const next = {
    ...appointment,
    status: 'canceled',
    canceledAt: appointment.canceledAt || atIso,
    slotReleasedAt: atIso,
    cancellationSource: 'customer_website',
    confirmation: {
      ...(appointment.confirmation || {}),
      canceledAt: appointment.confirmation?.canceledAt || atIso,
    },
  }
  return result(true, 'canceled', next, { mutates: true, notifyKey: appointment.id })
}

export function cancelBySalon(appointment, atIso) {
  if (!appointment || isCanceledStatus(appointment.status)) {
    return result(true, 'already_canceled', appointment)
  }
  const next = {
    ...appointment,
    status: 'canceled',
    canceledAt: appointment.canceledAt || atIso,
    slotReleasedAt: null,
    cancellationSource: 'management_app',
    confirmation: {
      ...(appointment.confirmation || {}),
      canceledAt: appointment.confirmation?.canceledAt || atIso,
    },
  }
  return result(true, 'canceled', next, { mutates: true, notifyKey: appointment.id })
}

export function claimNotification(appointment, bucket, event, key, atIso) {
  const field = bucket === 'customer' ? 'customerNotifications' : 'ownerNotifications'
  const current = appointment?.[field]?.[event]
  if (current && current.key === key && (current.status === 'sent' || current.status === 'pending')) {
    return { appointment, claimed: false }
  }
  return {
    claimed: true,
    appointment: {
      ...appointment,
      [field]: {
        ...(appointment?.[field] || {}),
        [event]: { status: 'pending', key, at: atIso },
      },
    },
  }
}

export function completeNotification(appointment, bucket, event, outcome) {
  const field = bucket === 'customer' ? 'customerNotifications' : 'ownerNotifications'
  const current = appointment?.[field]?.[event]
  if (!current) return appointment
  return {
    ...appointment,
    [field]: {
      ...appointment[field],
      [event]: {
        ...current,
        status: outcome.status,
        error: outcome.error || null,
        completedAt: outcome.at,
      },
    },
  }
}

export function listPendingNotices(appointment) {
  const found = []
  for (const bucket of ['owner', 'customer']) {
    const field = bucket === 'customer' ? 'customerNotifications' : 'ownerNotifications'
    const notices = appointment?.[field] || {}
    for (const [event, notice] of Object.entries(notices)) {
      if (notice?.status === 'pending') found.push({ bucket, event, notice })
    }
  }
  return found
}

export function shouldSendNewCustomerNotice(mode) {
  return mode === 'new'
}
