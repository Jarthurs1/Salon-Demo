/**
 * Appointment repository — single source for Calendar and Book.
 * UI never talks to S3/localStorage directly.
 */

import { buildSeedAppointments } from '../data/appointments.js'
import { decorateShowcaseAppointments } from '../demo/showcase.js'
import { normalizeTimeTo24h, isValidTimeString, parseDateKey, startOfDay } from '../utils/dateUtils.js'
import { getStorageProvider } from '../storage/createStorageProvider.js'
import { STORAGE_KEYS, wrapEnvelope } from '../storage/keys.js'
import {
  beginSaving,
  markSaved,
  markSaveError,
  isPersistenceError,
  toUserSaveError,
} from './persistenceStatus.js'
import {
  normalizeConfirmationMeta,
  shouldInvalidateConfirmation,
  didScheduleChange,
  resetConfirmationForReschedule,
  applyManualConfirm,
  emptyConfirmation,
  emptyReminders,
  emptySmsMeta,
} from '../reminders/appointmentConfirmationMeta.js'
import {
  applyReleaseCanceledSlot,
  isCanceledAppointment,
  isCanceledSlotHeld,
  normalizeSlotReleasedAt,
} from '../utils/canceledAppointment.js'
import { getScheduleSettings } from '../data/schedule.js'
import { getSalonDate } from '../reminders/salonTime.js'
import { validatePublicSlot } from '../scheduling/publicSlot.mjs'
import { recordDemoMail } from '../demo/mailbox.js'
import {
  approveCustomerReschedule,
  cancelBySalon,
  claimNotification,
  declineCustomerReschedule,
} from '../appointments/customerManage.js'

const listeners = new Set()
let cache = null
let hydrated = false

function notify() {
  listeners.forEach((listener) => listener())
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `appt-${crypto.randomUUID()}`
  }
  return `appt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function normalize(record) {
  const type =
    record.type ?? (record.status === 'blocked' ? 'blocked' : 'appointment')
  const status = type === 'blocked' ? 'blocked' : record.status
  const startTime = normalizeTimeTo24h(record.startTime) ?? record.startTime
  const { confirmation, reminders, sms } = normalizeConfirmationMeta(record)

  return {
    id: record.id,
    type,
    clientId: type === 'blocked' ? null : (record.clientId ?? null),
    clientName: type === 'blocked' ? null : (record.clientName ?? null),
    date: record.date,
    startTime,
    durationMinutes: Number(record.durationMinutes),
    service: record.service ?? '',
    status,
    notes: record.notes ?? '',
    canceledAt: record.canceledAt ?? confirmation.canceledAt ?? null,
    slotReleasedAt: normalizeSlotReleasedAt(record, status),
    confirmation: type === 'blocked' ? emptyConfirmation() : confirmation,
    reminders: type === 'blocked' ? emptyReminders() : reminders,
    sms: type === 'blocked' ? emptySmsMeta() : sms,
    serviceId: record.serviceId || '',
    source: record.source || '',
    cancellationSource: record.cancellationSource || '',
    rescheduleRequest: type === 'blocked' ? null : record.rescheduleRequest || null,
    ownerNotifications: record.ownerNotifications || {},
    customerNotifications: record.customerNotifications || {},
    payment: type === 'blocked' ? null : normalizePayment(record.payment),
  }
}

function normalizePayment(payment) {
  if (!payment || typeof payment !== 'object') return null
  const status = ['requested', 'paid', 'unpaid'].includes(payment.status) ? payment.status : 'unpaid'
  return {
    status,
    amountCents: Number(payment.amountCents) || 0,
    tipCents: Number(payment.tipCents) || 0,
    requestedAt: payment.requestedAt || null,
    paidAt: payment.paidAt || null,
    brand: String(payment.brand || ''),
    last4: String(payment.last4 || ''),
  }
}

function isUsableAppointment(record) {
  return (
    Boolean(record?.date) &&
    isValidTimeString(record.startTime) &&
    Number.isFinite(Number(record.durationMinutes)) &&
    Number(record.durationMinutes) > 0
  )
}

function sortAppointments(list) {
  return [...list].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date)
    if (byDate !== 0) return byDate
    return a.startTime.localeCompare(b.startTime)
  })
}

function extractList(envelope) {
  if (!envelope) return null
  if (Array.isArray(envelope)) return envelope
  if (Array.isArray(envelope.appointments)) return envelope.appointments
  return null
}

export function hydrateAppointments(envelope) {
  const list = extractList(envelope)
  cache = sortAppointments(
    (list ?? []).map(normalize).filter(isUsableAppointment),
  )
  hydrated = true
  notify()
  return cache
}

export function resetAppointmentsCache() {
  cache = null
  hydrated = false
}

export function isAppointmentsHydrated() {
  return hydrated
}

/**
 * Local: seed mock data once if empty.
 * AWS: empty array if missing — never repeatedly overwrite with mocks.
 */
export async function ensureAppointmentsInitialized(envelope) {
  const storage = getStorageProvider()
  const list = extractList(envelope)

  if (list) {
    hydrateAppointments(envelope)
    return cache
  }

  if (storage.name === 'local') {
    const seeded = sortAppointments(decorateShowcaseAppointments(buildSeedAppointments()).map(normalize))
    hydrateAppointments({ appointments: seeded })
    await storage.writeJson(
      STORAGE_KEYS.APPOINTMENTS,
      wrapEnvelope(STORAGE_KEYS.APPOINTMENTS, seeded),
    )
    return cache
  }

  // AWS first run — empty, persist once
  hydrateAppointments({ appointments: [] })
  await storage.writeJson(
    STORAGE_KEYS.APPOINTMENTS,
    wrapEnvelope(STORAGE_KEYS.APPOINTMENTS, []),
  )
  return cache
}

function requireCache() {
  if (!cache) {
    cache = []
    hydrated = true
  }
  return cache
}

async function persist(list, { quiet = false } = {}) {
  const storage = getStorageProvider()
  const sorted = sortAppointments(list.filter(isUsableAppointment))
  const previous = cache
  cache = sorted
  notify()

  if (!quiet) beginSaving()
  try {
    await storage.writeJson(
      STORAGE_KEYS.APPOINTMENTS,
      wrapEnvelope(STORAGE_KEYS.APPOINTMENTS, sorted),
    )
    if (!quiet) markSaved()
    return sorted
  } catch (error) {
    console.error('[appointmentRepository] persist failed', error)
    cache = previous
    notify()
    if (!quiet) markSaveError()
    if (isPersistenceError(error)) throw toUserSaveError()
    throw error
  }
}

export function getAppointments() {
  return requireCache()
}

export function getAppointmentsForDate(dateKey) {
  return getAppointments().filter((appt) => appt.date === dateKey)
}

export function getAppointmentById(id) {
  return getAppointments().find((appt) => appt.id === id) ?? null
}

export async function createAppointment(input) {
  const record = normalize({
    ...input,
    id: createId(),
  })
  if (!isUsableAppointment(record)) {
    throw new Error('Appointment requires a valid date, start time, and duration.')
  }
  await persist([...getAppointments(), record])
  if (record.type !== 'blocked') recordDemoMail('confirmation', record)
  return record
}

export async function updateAppointment(id, patch) {
  const appointments = [...getAppointments()]
  const index = appointments.findIndex((appt) => appt.id === id)
  if (index === -1) {
    throw new Error(`Appointment not found: ${id}`)
  }
  const previous = appointments[index]
  let updated = normalize({
    ...previous,
    ...patch,
    id,
    confirmation: patch.confirmation ?? previous.confirmation,
    reminders: patch.reminders ?? previous.reminders,
  })

  if (shouldInvalidateConfirmation(previous, updated)) {
    updated = normalize(resetConfirmationForReschedule(updated))
  } else if (didScheduleChange(previous, updated)) {
    // Pending (or other) schedule change: clear reminder delivery so new
    // intervals can fire once without duplicating for the old slot.
    const { confirmation } = normalizeConfirmationMeta(updated)
    updated = normalize({
      ...updated,
      confirmation,
      reminders: emptyReminders(),
      sms: emptySmsMeta(),
    })
  } else if (previous.status !== 'confirmed' && updated.status === 'confirmed') {
    updated = normalize(applyManualConfirm(updated))
  } else if (
    previous.status === 'reschedule_requested' &&
    updated.status === 'pending'
  ) {
    // Clear reschedule flag without changing the slot — keep reminder sent flags
    // so the same appointment does not get a duplicate reminder.
    const { confirmation, reminders } = normalizeConfirmationMeta(updated)
    updated = normalize({
      ...updated,
      status: 'pending',
      confirmation: {
        ...confirmation,
        rescheduleRequestedAt: null,
        confirmedAt: null,
      },
      reminders,
    })
  } else if (previous.status === 'confirmed' && updated.status === 'pending') {
    // Manual confirmed → pending: keep reminder sent flags & token; clear confirmedAt
    const { confirmation, reminders } = normalizeConfirmationMeta(updated)
    updated = normalize({
      ...updated,
      status: 'pending',
      confirmation: {
        ...confirmation,
        confirmedAt: null,
        rescheduleRequestedAt: null,
      },
      reminders,
    })
  }

  if (!isUsableAppointment(updated)) {
    throw new Error('Appointment requires a valid date, start time, and duration.')
  }
  appointments[index] = updated
  await persist(appointments)
  return updated
}

function queueNotice(appointment, bucket, event, key) {
  return claimNotification(appointment, bucket, event, key, new Date().toISOString()).appointment
}

export async function approveRescheduleRequest(id) {
  const appointments = [...getAppointments()]
  const index = appointments.findIndex((appt) => appt.id === id)
  if (index === -1) throw new Error(`Appointment not found: ${id}`)
  const current = appointments[index]
  const request = current.rescheduleRequest
  const schedule = getScheduleSettings()
  const salonToday = getSalonDate(new Date(), schedule.timezone || 'America/New_York')
  const dateObj = request?.date ? parseDateKey(request.date) : null
  const check = request
    ? validatePublicSlot(
        {
          date: request.date,
          startTime: request.startTime,
          durationMinutes: current.durationMinutes,
        },
        appointments,
        schedule,
        { today: startOfDay(new Date()), salonToday, dateObj, excludeId: current.id },
      )
    : { ok: false }
  const outcome = approveCustomerReschedule(current, {
    atIso: new Date().toISOString(),
    available: Boolean(check.ok),
  })
  if (!outcome.mutates) return outcome
  let next = queueNotice(outcome.appointment, 'customer', 'rescheduleApproved', outcome.notifyKey)
  next = normalize(next)
  appointments[index] = next
  await persist(appointments)
  recordDemoMail('rescheduleApproved', next)
  return { ...outcome, appointment: next }
}

export async function declineRescheduleRequest(id) {
  const appointments = [...getAppointments()]
  const index = appointments.findIndex((appt) => appt.id === id)
  if (index === -1) throw new Error(`Appointment not found: ${id}`)
  const outcome = declineCustomerReschedule(appointments[index], new Date().toISOString())
  if (!outcome.mutates) return outcome
  const next = normalize(
    queueNotice(outcome.appointment, 'customer', 'rescheduleDeclined', outcome.notifyKey),
  )
  appointments[index] = next
  await persist(appointments)
  recordDemoMail('rescheduleDeclined', next)
  return { ...outcome, appointment: next }
}

export async function cancelAppointmentFromSalon(id) {
  const appointments = [...getAppointments()]
  const index = appointments.findIndex((appt) => appt.id === id)
  if (index === -1) throw new Error(`Appointment not found: ${id}`)
  const outcome = cancelBySalon(appointments[index], new Date().toISOString())
  if (!outcome.mutates) return outcome
  let next = queueNotice(outcome.appointment, 'owner', 'canceled', outcome.notifyKey)
  next = normalize(queueNotice(next, 'customer', 'canceled', outcome.notifyKey))
  appointments[index] = next
  await persist(appointments)
  recordDemoMail('cancellation', next)
  return { ...outcome, appointment: next }
}

export async function deleteAppointment(id) {
  const appointments = getAppointments()
  const next = appointments.filter((appt) => appt.id !== id)
  if (next.length === appointments.length) {
    throw new Error(`Appointment not found: ${id}`)
  }
  await persist(next)
  return true
}

/** Release a canceled appointment's held calendar slot (idempotent). */
export async function releaseCanceledAppointmentSlot(id) {
  const appointments = [...getAppointments()]
  const index = appointments.findIndex((appt) => appt.id === id)
  if (index === -1) {
    throw new Error(`Appointment not found: ${id}`)
  }
  const current = appointments[index]
  if (!isCanceledAppointment(current)) {
    throw new Error('Only canceled appointments can free up a slot.')
  }
  if (!isCanceledSlotHeld(current)) {
    return current
  }
  const updated = normalize(
    applyReleaseCanceledSlot(current, new Date().toISOString()),
  )
  appointments[index] = updated
  await persist(appointments)
  return updated
}

export function getAppointmentsForClient(clientId) {
  if (!clientId) return []
  return getAppointments().filter((appt) => appt.clientId === clientId)
}

export function countAppointmentsForClient(clientId) {
  return getAppointmentsForClient(clientId).length
}

export async function syncClientDisplayName(clientId, displayName) {
  const appointments = [...getAppointments()]
  let changed = false
  for (let i = 0; i < appointments.length; i += 1) {
    const appt = appointments[i]
    if (appt.clientId === clientId && appt.clientName !== displayName) {
      appointments[i] = normalize({ ...appt, clientName: displayName })
      changed = true
    }
  }
  if (changed) {
    await persist(appointments)
  }
}

/**
 * Development helper (local mode): clear and re-seed mock appointments.
 * Browser console: resetAppointments()
 */
export async function resetAppointments() {
  const storage = getStorageProvider()
  if (storage.name !== 'local') {
    console.warn('resetAppointments() only seeds in local storage mode.')
    return getAppointments()
  }
  resetAppointmentsCache()
  const seeded = sortAppointments(buildSeedAppointments().map(normalize))
  hydrateAppointments({ appointments: seeded })
  await storage.writeJson(
    STORAGE_KEYS.APPOINTMENTS,
    wrapEnvelope(STORAGE_KEYS.APPOINTMENTS, seeded),
  )
  notify()
  return seeded
}

if (typeof window !== 'undefined') {
  window.resetAppointments = resetAppointments
}
