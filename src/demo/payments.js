import { getClientById } from '../services/clientRepository.js'
import { getAppointmentById, updateAppointment } from '../services/appointmentRepository.js'
import { money } from './showcase.js'
import { recordDemoMail } from './mailbox.js'

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
