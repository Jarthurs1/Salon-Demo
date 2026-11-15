import { describe, expect, it } from 'vitest'
import { decorateShowcaseAppointments, decorateShowcaseClients } from './showcase.js'
import { clearMailbox, listMessages, recordDemoMail } from './mailbox.js'
import { assertDemoRequestAllowed } from './networkGuard.js'
import { approveDemoPayment, requestDemoPayment } from './payments.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, String(value))
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

describe('salon demo isolation', () => {
  it('blocks live AWS and Stripe requests', () => {
    expect(() => assertDemoRequestAllowed('https://example.execute-api.us-east-1.amazonaws.com/book')).toThrow(/live services/)
    expect(() => assertDemoRequestAllowed('https://api.stripe.com/v1/charges')).toThrow(/live services/)
    expect(() => assertDemoRequestAllowed('https://fonts.googleapis.com/css')).not.toThrow()
  })

  it('seeds fictional payment, reschedule, and cancellation examples', () => {
    const clients = decorateShowcaseClients([
      { id: 'demo-client-emily', firstName: 'Emily' },
      { id: 'demo-client-sarah', firstName: 'Sarah' },
    ])
    expect(clients[0].savedCard.last4).toBe('4242')
    expect(clients[1].savedCard).toBeNull()

    const appointments = decorateShowcaseAppointments([
      { id: 'demo-appt-01', type: 'appointment' },
      { id: 'demo-appt-02', type: 'appointment' },
      { id: 'demo-appt-03', type: 'appointment', status: 'pending' },
      { id: 'demo-appt-05', type: 'appointment', date: '2026-11-18', status: 'confirmed' },
      { id: 'demo-appt-06', type: 'appointment', status: 'pending' },
    ])
    expect(appointments.find((item) => item.id === 'demo-appt-01').payment.status).toBe('paid')
    expect(appointments.find((item) => item.id === 'demo-appt-02').payment.status).toBe('requested')
    expect(appointments.find((item) => item.id === 'demo-appt-03').status).toBe('pending')
    expect(appointments.find((item) => item.id === 'demo-appt-05').status).toBe('reschedule_requested')
    expect(appointments.find((item) => item.id === 'demo-appt-05').date).toBe('2026-11-18')
    expect(appointments.find((item) => item.id === 'demo-appt-06').status).toBe('canceled')
  })

  it('keeps simulated mail in the supplied storage', () => {
    const storage = memoryStorage()
    clearMailbox(storage)
    recordDemoMail('receipt', { clientName: 'Emily Carter', service: 'Haircut', date: '2026-11-18', startTime: '09:00' }, { total: '$75.00', tip: '$10.00' }, storage)
    const [message] = listMessages(storage)
    expect(message.subject).toContain('Payment receipt')
    expect(message.body).toContain('$75.00')
    expect(JSON.stringify(message)).not.toContain('execute-api')
  })
})

describe('payment helpers', () => {
  it('exports the request and approval actions', () => {
    expect(typeof requestDemoPayment).toBe('function')
    expect(typeof approveDemoPayment).toBe('function')
  })
})
