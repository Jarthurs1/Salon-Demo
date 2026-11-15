import { describe, expect, it } from 'vitest'
import { buildBookingConfirmationEmail, deliverConfirmationEmail } from './appointmentEmails.js'

describe('booking confirmation email', () => {
  it('uses the salon name and a confirm button plus manage button', () => {
    const message = buildBookingConfirmationEmail({
      salonName: "Rozie's Salon",
      client: { firstName: 'Ada' },
      appointment: {
        status: 'pending',
        service: 'Haircut',
        date: '2026-11-20',
        startTime: '10:00',
      },
      confirmUrl: 'https://example.test/appointment/tok?intent=confirm',
      manageUrl: 'https://example.test/appointment/tok',
    })
    expect(message.subject).toContain("Rozie's Salon")
    expect(message.html).toContain('#2a7a6e')
    expect(message.html).toContain('Confirm Appointment')
    expect(message.html).toContain('Manage Appointment')
    expect(message.text).not.toContain('Request Reschedule')
  })
})

describe('email delivery', () => {
  it('does not send while dry run is on', async () => {
    let sent = 0
    const result = await deliverConfirmationEmail({
      dryRun: true,
      fromEmail: 'salon@example.com',
      to: 'ada@example.com',
      message: { subject: 'Hi', text: 'Hello' },
      sendEmail: async () => {
        sent += 1
      },
    })
    expect(result.status).toBe('not_sent')
    expect(sent).toBe(0)
  })

  it('records a delivery failure without throwing', async () => {
    const result = await deliverConfirmationEmail({
      dryRun: false,
      fromEmail: 'salon@example.com',
      to: 'ada@example.com',
      message: { subject: 'Hi', text: 'Hello' },
      sendEmail: async () => {
        throw new Error('ses_down')
      },
    })
    expect(result).toEqual({ status: 'failed', error: 'ses_down' })
  })
})
