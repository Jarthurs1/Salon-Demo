import { describe, expect, it } from 'vitest'
import { decorateShowcaseAppointments, decorateShowcaseClients } from './showcase.js'
import { clearMailbox, listMessages, recordDemoMail } from './mailbox.js'
import { assertDemoRequestAllowed } from './networkGuard.js'
import { approveDemoPayment, completionBlockReason, paymentFollowsElapsedTime, requestDemoPayment, tipCentsFor } from './payments.js'
import { buildDayBriefing, buildFollowUpDigest, emilyPaymentCopy, findEmilyPayment } from './inboxStories.js'
import { SMS_CONFIRMED, SMS_RESCHEDULE_REPLY, messagesFor, statusFor } from './smsPreview.js'
import { focusCustomerAppointment, peekCustomerFocus, subscribeCustomerFocus, takeCustomerFocus } from './focus.js'
import { DEMO_ROUTES } from './sections.js'

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
    expect(clients[0].savedCard).toBeNull()
    expect(clients[1].savedCard).toBeNull()

    const appointments = decorateShowcaseAppointments([
      { id: 'demo-appt-01', type: 'appointment' },
      { id: 'demo-appt-02', type: 'appointment' },
      { id: 'demo-appt-03', type: 'appointment', status: 'pending' },
      { id: 'demo-appt-05', type: 'appointment', date: '2026-11-18', status: 'confirmed' },
      { id: 'demo-appt-06', type: 'appointment', status: 'pending' },
    ])
    expect(appointments.find((item) => item.id === 'demo-appt-01').payment).toBeUndefined()
    expect(appointments.find((item) => item.id === 'demo-appt-01').status).not.toBe('canceled')
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
    recordDemoMail('paymentRequest', { id: 'demo-appt-01', clientName: 'Emily Carter', service: 'Haircut', date: '2026-11-16', startTime: '09:00' }, { amount: '$65.00' }, storage)
    recordDemoMail('paymentRequest', { id: 'demo-appt-01', clientName: 'Emily Carter', service: 'Haircut', date: '2026-11-16', startTime: '09:00' }, { amount: '$65.00' }, storage)
    expect(listMessages(storage).filter((item) => item.kind === 'paymentRequest')).toHaveLength(1)
    recordDemoMail('reminder', { clientName: 'Emily Carter', service: 'Haircut', date: '2026-11-16', startTime: '09:00' }, {}, storage)
    expect(listMessages(storage)[0].body).toContain('Monday, November 16 at 9:00 AM')
    expect(listMessages(storage)[0].body).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('builds the portfolio email examples from fictional visits', () => {
    const appointments = decorateShowcaseAppointments([
      { id: 'demo-appt-01', type: 'appointment', clientId: 'demo-client-emily', clientName: 'Emily Carter', date: '2026-11-16', startTime: '09:00', service: 'Haircut', status: 'confirmed' },
      { id: 'demo-appt-03', type: 'appointment', clientId: 'demo-client-sarah', clientName: 'Sarah Bennett', date: '2026-11-16', startTime: '13:00', service: 'Color', status: 'pending' },
      { id: 'demo-appt-05', type: 'appointment', clientId: 'demo-client-amanda', clientName: 'Amanda Brooks', date: '2026-11-17', startTime: '09:30', service: 'Highlights', status: 'confirmed' },
      { id: 'demo-appt-06', type: 'appointment', clientId: 'demo-client-jessica', clientName: 'Jessica Coleman', date: '2026-11-17', startTime: '14:00', service: 'Haircut & Style', status: 'pending' },
    ])
    const clients = decorateShowcaseClients([
      { id: 'demo-client-emily', firstName: 'Emily' },
      { id: 'demo-client-sarah', firstName: 'Sarah' },
    ])
    const briefing = buildDayBriefing(appointments, clients, new Date(2026, 10, 15))
    expect(briefing.dateLabel).toBe('Monday, November 16')
    expect(briefing.appointments.join(' ')).toContain('Emily Carter')
    expect(briefing.appointments.join(' ')).toContain('9:00 AM')
    const shown = [
      briefing.dateLabel,
      ...briefing.appointments,
      ...briefing.reschedules,
      ...briefing.withoutCard,
      ...briefing.unpaid,
    ].join(' ')
    expect(shown).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(briefing.withoutCard.join(' ')).toContain('Emily Carter')
    expect(briefing.unpaid).toEqual([])
    const emily = findEmilyPayment(appointments)
    expect(emilyPaymentCopy(emily).service).toBe('Haircut')
    expect(emilyPaymentCopy(emily).amount).toBe('$65.00')
    const digest = buildFollowUpDigest(appointments, clients)
    expect(digest.reschedules.join(' ')).toContain('Amanda Brooks')
    expect(digest.cancellations.join(' ')).toContain('Jessica Coleman')
    expect(digest.bookings.join(' ')).toContain('Sarah Bennett')
  })
})

describe('sms preview', () => {
  it('confirms with YES and keeps a reschedule on the original time', () => {
    expect(messagesFor('start')[0].text).toContain('Please confirm your appointment')
    expect(messagesFor('yes-wait').map((item) => item.text)).toContain('YES')
    expect(statusFor('yes-wait')).toBe('pending')
    expect(messagesFor('yes-done').at(-1).text).toBe(SMS_CONFIRMED)
    expect(statusFor('yes-done')).toBe('confirmed')
    expect(SMS_RESCHEDULE_REPLY).toMatch(/stylist approves/)
    expect(SMS_RESCHEDULE_REPLY).not.toMatch(/twilio|execute-api|sms\./i)
  })
})

describe('demo navigation', () => {
  it('keeps the mobile section labels and publishes focus while a section stays mounted', () => {
    expect(DEMO_ROUTES.map(([, label]) => label)).toEqual([
      'Stylist Experience',
      'Customer Experience',
      'Automated Messaging',
    ])
    const seen = []
    const unsubscribe = subscribeCustomerFocus((value) => seen.push(value.mode))
    focusCustomerAppointment('demo-appt-01', 'pay')
    expect(peekCustomerFocus()).toEqual({ appointmentId: 'demo-appt-01', mode: 'pay' })
    expect(seen).toEqual(['pay'])
    expect(takeCustomerFocus()).toEqual({ appointmentId: 'demo-appt-01', mode: 'pay' })
    expect(peekCustomerFocus()).toBeNull()
    unsubscribe()
  })
})

describe('payment helpers', () => {
  it('exports the request and approval actions', () => {
    expect(typeof requestDemoPayment).toBe('function')
    expect(typeof approveDemoPayment).toBe('function')
    expect(tipCentsFor(6500, '15', '')).toBe(975)
    expect(tipCentsFor(6500, '25', '')).toBe(1625)
    expect(tipCentsFor(6500, 'custom', '8.50')).toBe(850)
    expect(tipCentsFor(6500, '0', '')).toBe(0)
    expect(paymentFollowsElapsedTime()).toBe(false)
    expect(completionBlockReason({
      type: 'appointment',
      status: 'confirmed',
      date: '2020-01-01',
      startTime: '09:00',
    }, '65')).toBe('')
    expect(completionBlockReason({
      type: 'appointment',
      status: 'reschedule_requested',
      rescheduleRequest: { status: 'pending' },
    }, '65')).toMatch(/reschedule/)
    expect(completionBlockReason({
      type: 'appointment',
      status: 'confirmed',
      payment: { status: 'paid_outside' },
    }, '65')).toMatch(/already paid/)
    expect(completionBlockReason({ type: 'appointment', status: 'confirmed' }, '0')).toMatch(/price/)
  })
})
