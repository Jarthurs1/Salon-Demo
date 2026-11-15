import { getClientById } from '../services/clientRepository.js'
import { getAppointmentById, updateAppointment } from '../services/appointmentRepository.js'
import { money } from './showcase.js'
import { recordDemoMail } from './mailbox.js'

export function finalPriceCents(dollars) {
  const amount = Number(String(dollars ?? '').trim())
  if (!Number.isFinite(amount) || amount <= 0) return null
  return Math.round(amount * 100)
}

export function completionBlockReason(appointment, dollars) {
  if (!appointment || appointment.type === 'blocked') return 'Choose an appointment to complete.'
  if (appointment.status === 'reschedule_requested' || appointment.rescheduleRequest?.status === 'pending') {
    return 'Resolve the reschedule request before completing this appointment.'
  }
  if (appointment.status === 'canceled') return 'This appointment is canceled.'
  if (appointment.status !== 'confirmed') return 'Confirm the appointment before marking it completed.'
  if (appointment.payment?.status === 'paid') return 'This appointment is already paid.'
  if (appointment.payment?.status === 'requested') return 'Payment is already awaiting the customer.'
  if (!finalPriceCents(dollars)) return 'Enter a final price greater than zero.'
  return ''
}

export function paymentFollowsElapsedTime() {
  return false
}

export async function completeDemoAppointment(id, dollars) {
  const current = getAppointmentById(id)
  const reason = completionBlockReason(current, dollars)
  if (reason) return { ok: false, message: reason }
  const amountCents = finalPriceCents(dollars)
  const client = getClientById(current.clientId)
  const payment = {
    status: 'requested',
    amountCents,
    tipCents: 0,
    requestedAt: new Date().toISOString(),
    paidAt: null,
    brand: client?.savedCard?.brand || '',
    last4: client?.savedCard?.last4 || '',
  }
  const saved = await updateAppointment(id, {
    ...current,
    completedAt: new Date().toISOString(),
    payment,
  })
  recordDemoMail('paymentRequest', saved, { amount: money(amountCents) })
  return { ok: true, appointment: saved }
}

export async function previewPaymentReminder(id, which) {
  const current = getAppointmentById(id)
  if (!current || current.payment?.status !== 'requested') {
    return { ok: false, message: 'Reminders stop once the payment is complete.' }
  }
  recordDemoMail('paymentReminder', current, {
    hours: which === '72h' ? '72 hours' : '24 hours',
    amount: money(current.payment.amountCents),
  })
  return { ok: true }
}

export async function requestDemoPayment(id, amountCents) {
  const current = getAppointmentById(id)
  const client = getClientById(current.clientId)
  const payment = {
    status: 'requested',
    amountCents,
    tipCents: 0,
    requestedAt: new Date().toISOString(),
    paidAt: null,
    brand: client?.savedCard?.brand || '',
    last4: client?.savedCard?.last4 || '',
  }
  const saved = await updateAppointment(id, { ...current, payment })
  recordDemoMail('paymentRequest', saved, { amount: money(amountCents) })
  return saved
}

export function tipCentsFor(amountCents, choice, customDollars) {
  if (choice === 'custom') {
    const dollars = Number(customDollars)
    if (!Number.isFinite(dollars) || dollars < 0) return 0
    return Math.min(Math.round(dollars * 100), 50000)
  }
  const percent = Number(choice) || 0
  return Math.round((Number(amountCents) || 0) * (percent / 100))
}

export async function approveDemoPayment(id, tipCents) {
  const current = getAppointmentById(id)
  const payment = {
    ...(current.payment || {}),
    status: 'paid',
    tipCents: Number(tipCents) || 0,
    paidAt: new Date().toISOString(),
  }
  const saved = await updateAppointment(id, { ...current, payment })
  recordDemoMail('receipt', saved, {
    total: money((payment.amountCents || 0) + payment.tipCents),
    tip: payment.tipCents ? money(payment.tipCents) : '',
  })
  return saved
}
