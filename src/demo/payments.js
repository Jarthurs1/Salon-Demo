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
