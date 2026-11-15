import { describe, expect, it } from 'vitest'
import {
  applySmsOptOut,
  classifyInboundSmsCommand,
  clearStylistRecordedConsent,
  clientAllowsSmsReminders,
  emptySmsConsent,
  hasActiveSmsOptOut,
  normalizeSmsConsent,
  recordVerbalSmsConsent,
  SMS_CONSENT_SOURCE_STYLIST_FORM,
} from './smsConsent.js'
import {
  SMS_CONSENT_CHECKBOX_LABEL,
  SMS_DISCLOSURE_VERSION,
  buildHelpAcknowledgmentSms,
  buildStylistSmsDisclosure,
  buildStopAcknowledgmentSms,
  buildVerbalConsentScript,
} from './smsDisclosure.js'
import { buildReminderSms } from './smsMessage.js'
import { buildGatewaySmsBody } from './emailSmsGateway.js'
import { processInboundSms } from './smsInboundLogic.js'
import {
  applySmsUsageSegments,
  canSendAutomatedSmsSegments,
  estimateSmsSegments,
  SMS_MONTHLY_SEGMENT_LIMIT,
} from './smsUsageLimits.js'

const pending = {
  id: 'a1',
  type: 'appointment',
  status: 'pending',
  date: '2026-11-12',
  startTime: '14:00',
  durationMinutes: 45,
  service: 'Haircut',
  clientId: 'c1',
  clientName: 'Jamie Lee',
  reminders: {
    oneDaySentAt: '2026-11-11T19:00:00.000Z',
  },
  sms: {
    conversationId: 'smsconv-abc',
    outboundMessageId: 'msg-1',
    outboundSentAt: '2026-11-11T19:00:00.000Z',
    phoneE164: '+14045550100',
  },
}

describe('SMS consent defaults and verbal recording', () => {
  it('defaults new clients to opted out', () => {
    expect(emptySmsConsent().optedIn).toBe(false)
    expect(clientAllowsSmsReminders({ phone: '4045550100' })).toBe(false)
    expect(
      clientAllowsSmsReminders({
        phone: '4045550100',
        smsConsent: normalizeSmsConsent({}),
      }),
    ).toBe(false)
  })

  it('records verbal consent with audit fields and history', () => {
    const consent = recordVerbalSmsConsent({
      previousConsent: emptySmsConsent(),
      phone: '4045550100',
      recordedBy: 'user-rozie',
      atIso: '2026-11-10T17:00:00.000Z',
    })
    expect(consent.optedIn).toBe(true)
    expect(consent.consentMethod).toBe('verbal')
    expect(consent.consentSource).toBe(SMS_CONSENT_SOURCE_STYLIST_FORM)
    expect(consent.consentRecordedBy).toBe('user-rozie')
    expect(consent.disclosureVersion).toBe(SMS_DISCLOSURE_VERSION)
    expect(consent.history).toHaveLength(1)
    expect(clientAllowsSmsReminders({ phone: '4045550100', smsConsent: consent })).toBe(
      true,
    )
  })

  it('does not let a stylist checkbox clear STOP', () => {
    const stopped = applySmsOptOut(
      {
        phone: '4045550100',
        smsConsent: recordVerbalSmsConsent({
          phone: '4045550100',
          recordedBy: 'user-1',
        }),
      },
      '2026-11-10T18:00:00.000Z',
      { keyword: 'STOP' },
    )
    expect(hasActiveSmsOptOut(stopped)).toBe(true)
    expect(() =>
      recordVerbalSmsConsent({
        previousConsent: stopped.smsConsent,
        phone: '4045550100',
        recordedBy: 'user-1',
      }),
    ).toThrow(/START/)
    const cleared = clearStylistRecordedConsent(stopped.smsConsent)
    expect(cleared.optedOutAt).toBeTruthy()
    expect(cleared.optedIn).toBe(false)
  })
})

describe('disclosure and outbound copy', () => {
  it('uses Simple Salon in consent copy; outbound reminders still use salon name', () => {
    expect(SMS_CONSENT_CHECKBOX_LABEL).toMatch(/explicitly agreed/i)
    expect(buildStylistSmsDisclosure()).toContain('Simple Salon')
    expect(buildStylistSmsDisclosure()).toMatch(/STOP/)
    expect(buildVerbalConsentScript()).toContain('Simple Salon')
    expect(buildStylistSmsDisclosure("Rozie's Salon")).not.toContain("Rozie's Salon")

    const body = buildReminderSms({
      client: { firstName: 'Jamie' },
      appointment: pending,
      salonName: "Rozie's Salon",
    })
    expect(body).toBe(
      "Rozie's Salon: Hi Jamie, your appointment is tomorrow at 2:00 PM. Reply YES to confirm, STOP to opt out, or HELP for help.",
    )

    const gateway = buildGatewaySmsBody({
      client: { firstName: 'Jamie' },
      appointment: pending,
      salonName: "Sarah's Studio",
      conversationId: 'smsconv-abcdef12',
    })
    expect(gateway.startsWith("Sarah's Studio: Hi Jamie")).toBe(true)
    expect(gateway).not.toContain("Rozie's Salon")
  })
})

describe('inbound YES / STOP / CANCEL / HELP', () => {
  const optedInClient = {
    id: 'c1',
    firstName: 'Jamie',
    phone: '4045550100',
    smsConsent: recordVerbalSmsConsent({
      phone: '4045550100',
      recordedBy: 'user-1',
      atIso: '2026-11-01T00:00:00.000Z',
    }),
  }

  it('classifies CANCEL as SMS opt-out, not appointment cancel', () => {
    expect(classifyInboundSmsCommand('CANCEL').type).toBe('stop')
  })

  it('STOP opts out without changing appointments', () => {
    const result = processInboundSms({
      appointments: [pending],
      clients: [optedInClient],
      phoneE164: '+14045550100',
      body: 'STOP',
      options: {
        schedule: { salonName: "Rozie's Salon", contactPhone: '404-555-9999' },
        providerHandlesKeywords: false,
      },
    })
    expect(result.result).toBe('opted_out')
    expect(result.appointments[0].status).toBe('pending')
    expect(result.clients[0].smsConsent.optedIn).toBe(false)
    expect(result.clients[0].smsConsent.optedOutAt).toBeTruthy()
    expect(result.replySms).toContain('unsubscribed')
  })

  it('CANCEL keyword opts out of SMS without canceling the appointment', () => {
    const result = processInboundSms({
      appointments: [pending],
      clients: [optedInClient],
      phoneE164: '+14045550100',
      body: 'CANCEL',
      options: { providerHandlesKeywords: true },
    })
    expect(result.result).toBe('opted_out')
    expect(result.appointments[0].status).toBe('pending')
    expect(result.replySms).toBeNull()
  })

  it('HELP returns registered-brand assistance without appointment data', () => {
    const help = buildHelpAcknowledgmentSms({
      smsRegisteredBrand: 'Approved Brand',
      contactPhone: '404-555-9999',
    })
    expect(help).toContain('Approved Brand')
    expect(help).toContain('404-555-9999')
    expect(help).not.toContain('Jamie')
    expect(help).not.toContain('Haircut')

    const result = processInboundSms({
      appointments: [pending],
      clients: [optedInClient],
      phoneE164: '+14045550100',
      body: 'HELP',
      options: {
        schedule: {
          smsRegisteredBrand: 'Approved Brand',
          contactEmail: 'support@example.com',
        },
        providerHandlesKeywords: false,
      },
    })
    expect(result.result).toBe('help')
    expect(result.appointments[0].status).toBe('pending')
    expect(result.replySms).toContain('Approved Brand')
  })

  it('YES confirms only an unambiguous pending appointment', () => {
    const result = processInboundSms({
      appointments: [pending],
      clients: [optedInClient],
      phoneE164: '+14045550100',
      body: 'YES',
      options: {
        sendAcknowledgment: false,
        salonToday: '2026-11-11',
      },
    })
    expect(result.result).toBe('confirmed')
    expect(result.appointment.status).toBe('confirmed')
    expect(result.replySms).toBeNull()
  })

  it('YES does not confirm canceled or reschedule-requested appointments', () => {
    for (const status of ['canceled', 'reschedule_requested']) {
      const result = processInboundSms({
        appointments: [{ ...pending, status }],
        clients: [optedInClient],
        phoneE164: '+14045550100',
        body: 'YES',
        options: { salonToday: '2026-11-11' },
      })
      expect(['ineligible', 'none', 'ambiguous']).toContain(result.result)
      expect(result.appointments[0].status).toBe(status)
    }
  })

  it('STOP acknowledgment uses registered brand copy', () => {
    expect(buildStopAcknowledgmentSms({ smsRegisteredBrand: 'Approved Brand' })).toContain(
      'Approved Brand',
    )
  })
})

describe('SMS segment caps', () => {
  it('enforces the 300-segment monthly cap', () => {
    expect(SMS_MONTHLY_SEGMENT_LIMIT).toBe(300)
    const usage = applySmsUsageSegments(
      { monthKey: '2026-11', monthSegments: 299, dayKey: '2026-11-10', daySegments: 1 },
      0,
      { now: new Date('2026-11-10T15:00:00Z'), timeZone: 'UTC' },
    )
    const segments = estimateSmsSegments(
      "Rozie's Salon: Hi Jamie, your appointment is tomorrow at 2:00 PM. Reply YES to confirm, STOP to opt out, or HELP for help.",
    )
    expect(segments).toBe(1)
    expect(
      canSendAutomatedSmsSegments(
        { ...usage, monthSegments: 300 },
        segments,
      ).ok,
    ).toBe(false)
    expect(canSendAutomatedSmsSegments(usage, segments).ok).toBe(true)
  })
})
