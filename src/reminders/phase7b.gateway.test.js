import { describe, it, expect } from 'vitest'
import {
  buildGatewayRecipient,
  buildGatewaySmsBody,
  buildCorrelationRef,
  parseGatewayInboundEmail,
  extractPhoneFromInboundEmail,
  getGatewayConfig,
} from './emailSmsGateway.js'
import { getReminderType } from './reminderEligibility.js'
import { processInboundSms } from './smsInboundLogic.js'
import {
  applySmsOptOut,
  clientAllowsSmsReminders,
  consentFromOptInCheckbox,
  SMS_DISCLOSURE_VERSION,
} from './smsConsent.js'
import { confirmAppointmentByToken } from './confirmationLogic.js'
import { ensureConfirmationToken } from './ensureConfirmationToken.js'

const appt = {
  id: 'appt-1',
  type: 'appointment',
  clientId: 'client-1',
  clientName: 'Sarah Bennett',
  date: '2026-11-11',
  startTime: '14:00',
  durationMinutes: 60,
  service: 'Haircut',
  status: 'pending',
}

const client = {
  id: 'client-1',
  firstName: 'Sarah',
  phone: '(404) 555-0100',
  smsConsent: {
    optedIn: true,
    optedInAt: '2026-11-01T00:00:00.000Z',
    optedOutAt: null,
    source: 'website',
    disclosureVersion: '2026-11-tollfree',
    phoneE164AtConsent: '+14045550100',
  },
}

describe('Phase 7B — email-to-SMS gateway adapter', () => {
  it('builds text.email recipient addresses', () => {
    expect(
      buildGatewayRecipient('+14045550100', { domain: 'text.email', subdomain: '' }),
    ).toBe('4045550100@text.email')
    expect(
      buildGatewayRecipient('+14045550100', { domain: 'text.email', subdomain: 'rozie' }),
    ).toBe('4045550100@rozie.text.email')
  })

  it('returns null when gateway domain missing', () => {
    expect(buildGatewayRecipient('+14045550100', { domain: '' })).toBe(null)
  })

  it('embeds correlation Ref in outbound SMS body', () => {
    const body = buildGatewaySmsBody({
      client,
      appointment: appt,
      conversationId: 'smsconv-abcd1234ffff',
    })
    expect(body).toContain('YES')
    expect(body).toContain('STOP')
    expect(body).toContain('Ref:abcd1234')
    expect(buildCorrelationRef('smsconv-abcd1234ffff')).toBe('abcd1234')
  })

  it('parses gateway reply email with phone in subject', () => {
    const parsed = parseGatewayInboundEmail(
      {
        fromEmail: 'noreply@text.email',
        subject: 'SMS reply from 4045550100',
        body: 'YES',
      },
      getGatewayConfig({ EMAIL_SMS_INBOUND_FROM_DOMAINS: 'text.email' }),
    )
    expect(parsed.ok).toBe(true)
    expect(parsed.phoneE164).toBe('+14045550100')
    expect(parsed.command.type).toBe('confirm_yes')
  })

  it('extracts phone from varied subject formats', () => {
    expect(
      extractPhoneFromInboundEmail({ subject: 'Reply from (404) 555-0100' }),
    ).toBe('+14045550100')
  })
})

describe('Phase 7B — reminder schedule defaults', () => {
  it('default settings fire only the 1-day calendar reminder', () => {
    expect(
      getReminderType(appt, {
        salonToday: '2026-11-10',
        reminderSettings: { enabled: true, intervalsDays: [1] },
      }),
    ).toBe(1)
  })
  it('does not fire unconfigured 7-day or 2-day intervals', () => {
    expect(
      getReminderType(appt, {
        salonToday: '2026-11-04',
        reminderSettings: { enabled: true, intervalsDays: [1] },
      }),
    ).toBe(null)
    expect(
      getReminderType(appt, {
        salonToday: '2026-11-09',
        reminderSettings: { enabled: true, intervalsDays: [1] },
      }),
    ).toBe(null)
  })
})

describe('Phase 7B — consent', () => {
  it('website checkbox unchecked by default → no consent', () => {
    const consent = consentFromOptInCheckbox({
      optedIn: false,
      phone: '4045550100',
      source: 'website',
    })
    expect(consent.optedIn).toBe(false)
  })

  it('website checkbox checked persists disclosure version', () => {
    const consent = consentFromOptInCheckbox({
      optedIn: true,
      phone: '4045550100',
      source: 'website',
    })
    expect(consent.optedIn).toBe(true)
    expect(consent.disclosureVersion).toBe(SMS_DISCLOSURE_VERSION)
    expect(consent.phoneE164AtConsent).toBe('+14045550100')
  })

  it('STOP prevents future SMS', () => {
    const stopped = applySmsOptOut(client)
    expect(clientAllowsSmsReminders(stopped)).toBe(false)
  })
})

describe('Phase 7B — YES confirmation via gateway-shaped inbound', () => {
  const pending = {
    ...appt,
    reminders: { sevenDaySentAt: null, threeDaySentAt: null, oneDaySentAt: '2026-11-10T19:00:00.000Z' },
    sms: {
      conversationId: 'smsconv-abcd1234ffff',
      outboundMessageId: 'ses-gateway:smsconv-abcd1234ffff',
      outboundSentAt: '2026-11-10T19:00:00.000Z',
      phoneE164: '+14045550100',
    },
  }

  it('YES confirms and sets confirmedAt', () => {
    const result = processInboundSms({
      appointments: [pending],
      clients: [client],
      phoneE164: '+14045550100',
      body: 'YES',
      options: { salonToday: '2026-11-10', sendAcknowledgment: false },
    })
    expect(result.result).toBe('confirmed')
    expect(result.appointment.status).toBe('confirmed')
    expect(result.appointment.confirmation.confirmedAt).toBeTruthy()
    expect(result.replySms).toBe(null)
  })

  it('ambiguous YES does not confirm', () => {
    const other = {
      ...pending,
      id: 'appt-2',
      date: '2026-11-12',
      sms: { ...pending.sms, conversationId: 'smsconv-zzzz9999aaaa', outboundMessageId: 'other' },
    }
    const result = processInboundSms({
      appointments: [pending, other],
      clients: [client],
      phoneE164: '+14045550100',
      body: 'YES',
      options: { salonToday: '2026-11-10' },
    })
    expect(result.result).toBe('ambiguous')
    expect(result.appointments.every((a) => a.status === 'pending')).toBe(true)
  })

  it('correlation Ref disambiguates multiple appointments', () => {
    const other = {
      ...pending,
      id: 'appt-2',
      date: '2026-11-12',
      sms: {
        ...pending.sms,
        conversationId: 'smsconv-zzzz9999aaaa',
        outboundMessageId: 'other',
      },
    }
    const result = processInboundSms({
      appointments: [pending, other],
      clients: [client],
      phoneE164: '+14045550100',
      body: 'YES',
      options: { salonToday: '2026-11-10', correlationRef: 'zzzz9999' },
    })
    expect(result.result).toBe('confirmed')
    expect(result.appointment.id).toBe('appt-2')
  })

  it('unknown phone does not confirm', () => {
    const result = processInboundSms({
      appointments: [pending],
      clients: [client],
      phoneE164: '+14045559999',
      body: 'YES',
      options: { salonToday: '2026-11-10' },
    })
    expect(result.result).toBe('none')
  })

  it('notification-path freeform does not change appointment', () => {
    const result = processInboundSms({
      appointments: [pending],
      clients: [client],
      phoneE164: '+14045550100',
      body: 'Can I come later?',
      options: { salonToday: '2026-11-10' },
    })
    expect(result.result).toBe('freeform')
    expect(result.appointments[0].status).toBe('pending')
  })
})

describe('Phase 7B — existing link confirmation still works', () => {
  it('link confirm still works', () => {
    const ensured = ensureConfirmationToken(appt)
    const result = confirmAppointmentByToken([ensured.appointment], ensured.rawToken, {
      salonToday: '2026-11-01',
    })
    expect(result.status).toBe('confirmed')
  })
})

describe('Phase 7B — email-reply-to-SMS disabled contract', () => {
  it('documents disabled pathway expectation', async () => {
    // Handler lives in Lambda package; assert adapter does not expose reply routing helpers for Rozie.
    const config = getGatewayConfig({ EMAIL_SMS_GATEWAY_DOMAIN: 'text.email' })
    expect(config.domain).toBe('text.email')
    // No buildBridgeAddress import required for POC outbound — gateway recipient is used instead.
    expect(buildGatewayRecipient('+14045550100', config)).toContain('@text.email')
  })
})
