import { describe, expect, it } from 'vitest'
import {
  applyContactEmailMigration,
  buildTestNotificationEmail,
  isValidContactEmail,
  resolveSalonBranding,
  shouldSeedRozieContactEmail,
} from './salonBranding.js'
import { buildReminderEmail } from './reminderEmail.js'
import {
  buildStylistCancelNotifyEmail,
  buildStylistRescheduleNotifyEmail,
} from './stylistNotifyEmail.js'
import { PRODUCT_NAME } from './productName.js'

describe('salonBranding', () => {
  it('never falls back to another salon contact email', () => {
    const branding = resolveSalonBranding({
      salonName: "Sarah's Studio",
      stylistName: 'Sarah',
      contactEmail: '',
    })
    expect(branding.contactEmail).toBe('')
    expect(branding.hasContactEmail).toBe(false)
    expect(branding.salonName).toBe("Sarah's Studio")
  })

  it('uses Settings salon/stylist names for customer-facing branding', () => {
    const branding = resolveSalonBranding({
      salonName: 'Salon',
      stylistName: 'Test',
    })
    expect(branding.salonName).toBe('Salon')
    expect(branding.stylistName).toBe('Test')
    expect(branding.salonName).not.toBe("Rozie's Salon")
  })

  it('seeds Rozie contact email only for her existing branded account', () => {
    expect(
      shouldSeedRozieContactEmail({
        salonName: "Rozie's Salon",
        stylistName: 'Rozie',
        contactEmail: '',
      }),
    ).toBe(false)
    expect(
      shouldSeedRozieContactEmail({
        salonName: "Sarah's Studio",
        stylistName: 'Sarah',
        contactEmail: '',
      }),
    ).toBe(false)
    expect(
      shouldSeedRozieContactEmail({
        salonName: "Rozie's Salon",
        contactEmail: 'already@example.com',
      }),
    ).toBe(false)

    const migrated = applyContactEmailMigration({
      salonName: "Rozie's Salon",
      stylistName: 'Rozie',
      contactEmail: '',
    })
    expect(migrated.migrated).toBe(false)
    expect(migrated.schedule.contactEmail).toBe('')
    expect(JSON.stringify(migrated)).not.toContain('gmail.com')
  })

  it('validates contact emails', () => {
    expect(isValidContactEmail('studio@example.com')).toBe(true)
    expect(isValidContactEmail('not-an-email')).toBe(false)
  })

  it('builds a product-branded test email from salon settings', () => {
    const { subject, text } = buildTestNotificationEmail({
      salonName: "Rozie's Salon",
      stylistName: 'Rozie',
    })
    expect(subject).toBe(`${PRODUCT_NAME} — Test Notification`)
    expect(text).toContain('Hi Rozie,')
    expect(text).toContain("Salon: Rozie's Salon")
    expect(text).toContain(PRODUCT_NAME)
  })
})

describe('dynamic customer and stylist emails', () => {
  const appointment = {
    date: '2026-11-17',
    startTime: '14:00',
    service: 'Haircut',
    durationMinutes: 45,
  }

  it('uses salon A branding in customer reminders', () => {
    const { subject, text } = buildReminderEmail({
      reminderType: 1,
      client: { firstName: 'John' },
      appointment,
      confirmationUrl: 'https://example.test/c',
      manageUrl: 'https://example.test/m',
      salonName: "Rozie's Salon",
      stylistName: 'Rozie',
    })
    expect(subject).toBe("Appointment Reminder — Rozie's Salon")
    expect(text).toContain('appointment with Rozie is tomorrow')
    expect(text).toContain('Thank you,')
    expect(text).toContain('Rozie')
    expect(text).not.toContain("Sarah's Studio")
  })

  it('uses salon B branding in customer reminders', () => {
    const { subject, text } = buildReminderEmail({
      reminderType: 1,
      client: { firstName: 'Alex' },
      appointment,
      confirmationUrl: 'https://example.test/c',
      manageUrl: 'https://example.test/m',
      salonName: "Sarah's Studio",
      stylistName: 'Sarah',
    })
    expect(subject).toBe("Appointment Reminder — Sarah's Studio")
    expect(text).toContain('appointment with Sarah is tomorrow')
    expect(text).toContain('Sarah')
    expect(text).not.toContain("Rozie's Salon")
    expect(text).not.toContain('john.arthurs4510@gmail.com')
  })

  it('builds stylist cancel notify with contact greeting and product footer', () => {
    const { subject, text } = buildStylistCancelNotifyEmail({
      clientName: 'John Tester',
      appointment,
      salonName: "Rozie's Salon",
      stylistName: 'Rozie',
    })
    expect(subject).toBe('Appointment Canceled — John Tester')
    expect(text).toContain('Hi Rozie,')
    expect(text).toContain('marked CANCELED')
    expect(text).toContain(PRODUCT_NAME)
    expect(text).not.toContain('now available for new bookings')
  })

  it('builds stylist reschedule notify with stylist greeting', () => {
    const { subject, text } = buildStylistRescheduleNotifyEmail({
      clientName: 'Jamie Lee',
      clientPhone: '4045551234',
      appointment: { ...appointment, service: 'Color', durationMinutes: 90 },
      salonName: "Sarah's Studio",
      stylistName: 'Sarah',
    })
    expect(subject).toBe('Reschedule Requested — Jamie Lee')
    expect(text).toContain('Hi Sarah,')
    expect(text).toContain(PRODUCT_NAME)
    expect(text).not.toContain('Rozie')
  })
})
