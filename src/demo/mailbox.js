import { formatTimeDisplay } from '../utils/dateUtils.js'
import { formatVisit } from './formatVisit.js'

const KEY = 'salon-demo.inbox.v1'
const listeners = new Set()
let snapshot = []
let snapshotReady = false

function storageOf(storage) {
  if (storage) return storage
  if (typeof localStorage === 'undefined') {
    return { getItem() { return null }, setItem() {}, removeItem() {} }
  }
  return localStorage
}

function read(storage) {
  try {
    const parsed = JSON.parse(storageOf(storage).getItem(KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(messages, storage) {
  storageOf(storage).setItem(KEY, JSON.stringify(messages))
  if (!storage) {
    snapshot = messages
    snapshotReady = true
  }
  listeners.forEach((listener) => listener())
}

export function subscribeMailbox(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function listMessages(storage) {
  if (storage) return read(storage)
  if (!snapshotReady) {
    snapshot = read()
    snapshotReady = true
  }
  return snapshot
}

export function clearMailbox(storage) {
  write([], storage)
}

function id() {
  return `mail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function addMessage(message, storage) {
  const next = [
    {
      id: id(),
      createdAt: new Date().toISOString(),
      actions: [],
      ...message,
    },
    ...read(storage),
  ]
  write(next, storage)
  return next[0]
}

export function recordDemoMail(kind, appointment, extra = {}, storage) {
  const name = appointment?.clientName || extra.clientName || 'there'
  const when = formatVisit(appointment?.date, appointment?.startTime)
  const requestedWhen = formatVisit(extra.requestedDate, extra.requestedTime)
  const service = appointment?.service || 'Appointment'
  const salon = extra.salonName || 'Lumen & Co.'
  const templates = {
    confirmed: {
      kind: 'confirmed',
      to: name,
      subject: `Your appointment is confirmed — ${salon}`,
      body: `${name}, your ${service} on ${when} is confirmed.`,
      actions: [{ id: 'manage', label: 'Manage Appointment', appointmentId: appointment?.id }],
    },
    confirmation: {
      kind,
      to: name,
      subject: `Confirm your appointment — ${salon}`,
      body: `${name}, your ${service} on ${when} is pending. Confirm it when you are ready. Opening this message does not confirm the appointment.`,
      actions: [{ id: 'confirm', label: 'Confirm Appointment', appointmentId: appointment?.id }],
    },
    reminder: {
      kind,
      to: name,
      subject: `Appointment reminder — ${salon}`,
      body: `${name}, this is a reminder for your ${service} on ${when}.`,
      actions: [{ id: 'manage', label: 'Manage Appointment', appointmentId: appointment?.id }],
    },
    rescheduleRequested: {
      kind,
      to: 'Mara',
      subject: `Reschedule requested — ${name}`,
      body: `${name} asked to move ${service} from ${when} to ${requestedWhen}. The original time stays reserved.`,
      actions: [{ id: 'review', label: 'Review in calendar', appointmentId: appointment?.id }],
    },
    rescheduleApproved: {
      kind,
      to: name,
      subject: `Reschedule approved — ${salon}`,
      body: `${name}, your ${service} is now ${when}.`,
      actions: [{ id: 'manage', label: 'Manage Appointment', appointmentId: appointment?.id }],
    },
    rescheduleDeclined: {
      kind,
      to: name,
      subject: `Reschedule declined — ${salon}`,
      body: `${name}, your ${service} stays on ${when}.`,
      actions: [{ id: 'manage', label: 'Manage Appointment', appointmentId: appointment?.id }],
    },
    cancellation: {
      kind,
      to: name,
      subject: `Appointment canceled — ${salon}`,
      body: `${name}, your ${service} on ${when} has been canceled.`,
      actions: [],
    },
    paymentRequest: {
      kind,
      to: name,
      subject: `Payment request — ${salon}`,
      body: `${name}, ${service} on ${when} is ready to pay. The amount due is ${extra.amount || ''}. You can add a tip before approving.`,
      actions: [{ id: 'pay', label: 'Review payment', appointmentId: appointment?.id }],
    },
    receipt: {
      kind,
      to: name,
      subject: `Payment receipt — ${salon}`,
      body: `${name}, thank you. ${service} is paid. Total ${extra.total || ''}${extra.tip ? `, including a ${extra.tip} tip` : ''}.`,
      actions: [],
    },
    dailySummary: {
      kind,
      to: 'Mara',
      subject: `Daily summary — ${salon}`,
      body: extra.summary || 'Here is a fictional summary of today’s book.',
      actions: [{ id: 'review', label: 'Open stylist calendar', appointmentId: '' }],
    },
    test: {
      kind,
      to: 'studio@example.com',
      subject: `Test notification — ${salon}`,
      body: 'This simulated message confirms the salon notification address. No email was sent.',
      actions: [],
    },
  }
  return addMessage(templates[kind] || templates.test, storage)
}

export function ensureSeedMailbox(appointments, storage) {
  if (read(storage).length > 0) return
  const upcoming = (appointments || []).find((item) => item.type !== 'blocked' && item.status === 'confirmed')
  if (upcoming) recordDemoMail('reminder', upcoming, {}, storage)
  const names = (appointments || [])
    .filter((item) => item.type !== 'blocked' && item.status !== 'canceled')
    .slice(0, 4)
    .map((item) => `${formatTimeDisplay(item.startTime)} ${item.clientName || item.service}`)
  recordDemoMail(
    'dailySummary',
    null,
    { summary: `Today’s book includes ${names.join(', ') || 'a few open hours'}.` },
    storage,
  )
}
