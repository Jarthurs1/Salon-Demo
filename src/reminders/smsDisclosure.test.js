import { describe, it, expect } from 'vitest'
import {
  SMS_CONSENT_CHECKBOX_LABEL,
  SMS_CONSENT_DISCLOSURE,
  SMS_CONSENT_DISCLOSURE_STYLIST,
  SMS_DISCLOSURE_VERSION,
  SMS_PRIVACY_URL,
  SMS_TERMS_URL,
  SMS_PROGRAM_NAME,
  buildStylistSmsDisclosure,
  buildVerbalConsentScript,
} from './smsDisclosure.js'
import { consentFromOptInCheckbox } from './smsConsent.js'

describe('SMS toll-free consent disclosure', () => {
  it('provides stylist checkbox and Simple Salon disclosure (not a program/salon brand)', () => {
    expect(SMS_CONSENT_CHECKBOX_LABEL).toMatch(/explicitly agreed/i)
    expect(SMS_PROGRAM_NAME).toBe('Simple Salon')
    expect(buildStylistSmsDisclosure()).toContain('Simple Salon')
    expect(buildStylistSmsDisclosure()).not.toMatch(/Appointment Reminders/i)
    expect(buildStylistSmsDisclosure("Rozie's Salon")).not.toContain("Rozie's Salon")
    expect(buildStylistSmsDisclosure()).toMatch(/STOP/)
    expect(buildVerbalConsentScript()).toContain('Simple Salon')
    expect(buildVerbalConsentScript("Sarah's Studio")).not.toContain("Sarah's Studio")
    expect(SMS_CONSENT_DISCLOSURE).toMatch(/Simple Salon|STOP/i)
    expect(SMS_CONSENT_DISCLOSURE_STYLIST).toMatch(/STOP|HELP/i)
  })

  it('includes required carrier disclosure elements', () => {
    const text = buildStylistSmsDisclosure()
    expect(text).toMatch(/optional/i)
    expect(text).toMatch(/message and data rates may apply/i)
    expect(text).toMatch(/STOP/)
    expect(text).toMatch(/HELP/)
    expect(text).toMatch(/not required/i)
  })

  it('points to deployed Amplify policy pages', () => {
    expect(SMS_PRIVACY_URL).toBe(
      'https://main.d2oxpzhi8msliv.amplifyapp.com/sms-privacy',
    )
    expect(SMS_TERMS_URL).toBe(
      'https://main.d2oxpzhi8msliv.amplifyapp.com/sms-terms',
    )
  })

  it('keeps checkbox opt-in off by default and records timestamp when checked', () => {
    const off = consentFromOptInCheckbox({
      optedIn: false,
      phone: '4045550100',
      source: 'website',
    })
    expect(off.optedIn).toBe(false)
    expect(off.optedInAt).toBe(null)

    const on = consentFromOptInCheckbox({
      optedIn: true,
      phone: '4045550100',
      source: 'website',
      atIso: '2026-11-05T12:00:00.000Z',
    })
    expect(on.optedIn).toBe(true)
    expect(on.optedInAt).toBe('2026-11-05T12:00:00.000Z')
    expect(on.disclosureVersion).toBe(SMS_DISCLOSURE_VERSION)
  })
})
