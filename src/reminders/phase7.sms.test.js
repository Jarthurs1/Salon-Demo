import { describe, it, expect } from 'vitest'
import {
  getAppointmentStartUtc,
  getHoursUntilAppointmentStart,
  isWithinTwentyFourHourReminderWindow,
} from './salonTime.js'
import {
  getReminderType,
  isReminderEligible,
  applyReminderSentTimestamp,
  REMINDER_TYPE_24H,
} from './reminderEligibility.js'
import {
  classifyInboundSmsCommand,
  normalizeUsE164,
  clientAllowsSmsReminders,
  applySmsOptOut,
  applySmsOptIn,
} from './smsConsent.js'
import { buildReminderSms } from './smsMessage.js'
import { matchInboundSmsReply } from './smsReplyMatching.js'
import { processInboundSms } from './smsInboundLogic.js'
import { confirmAppointmentByToken } from './confirmationLogic.js'
import { ensureConfirmationToken } from './ensureConfirmationToken.js'
import { isAuthorizedRozieSender, parseBridgeLocalPart } from './smsConversation.js'

const baseAppt = {
  id: 'appt-1',
  type: 'appointment',
  clientId: 'client-1',
  clientName: 'Sarah Bennett',
  date: '2026-11-11',
  startTime: '14:00',
  durationMinutes: 60,
  service: 'Haircut',
  status: 'pending',
  notes: 'color formula secret',
}

const optedInClient = {
  id: 'client-1',
  firstName: 'Sarah',
  phone: '(404) 555-0100',
  email: 'sarah@example.com',
  smsConsent: { optedIn: true, optedInAt: '2026-11-01T00:00:00.000Z', optedOutAt: null, source: 'manual' },
}

/** Midday ET on the 1-day reminder calendar day. */
const reminderNow = new Date('2026-11-10T16:00:00.000Z')

describe('Phase 7 — salon time + calendar-day reminders', () => {
  const oneDay = { enabled: true, intervalsDays: [1] }

  it('computes appointment start in America/New_York (EST winter)', () => {
    const start = getAppointmentStartUtc('2026-11-11', '14:00')
    expect(start.toISOString()).toBe('2026-11-11T19:00:00.000Z')
  })

  it('handles DST spring-forward for local start time', () => {
    const start = getAppointmentStartUtc('2026-03-08', '03:00')
    expect(start.toISOString()).toBe('2026-03-08T07:00:00.000Z')
  })

  it('keeps exact-hour helper available', () => {
    const now = new Date('2026-11-10T19:00:00.000Z')
    expect(isWithinTwentyFourHourReminderWindow(baseAppt, { now })).toBe(true)
    expect(getHoursUntilAppointmentStart(baseAppt, now)).toBeCloseTo(24, 5)
  })

  it('eligible on calendar day before when 1-day interval is enabled', () => {
    expect(
      getReminderType(baseAppt, { salonToday: '2026-11-10', reminderSettings: oneDay }),
    ).toBe(1)
    expect(
      getReminderType(baseAppt, { salonToday: '2026-11-03', reminderSettings: oneDay }),
    ).toBe(null)
  })

  it('does not send same-day short-notice as a 1-day reminder', () => {
    expect(
      getReminderType(baseAppt, { salonToday: '2026-11-11', reminderSettings: oneDay }),
    ).toBe(null)
  })

  it('only one reminder — already sent blocks resend', () => {
    const sent = applyReminderSentTimestamp(baseAppt, 1, '2026-11-10T19:10:00.000Z')
    expect(
      getReminderType(sent, { salonToday: '2026-11-10', reminderSettings: oneDay }),
    ).toBe(null)
  })

  it('confirmed appointments receive no reminder', () => {
    expect(
      getReminderType(
        { ...baseAppt, status: 'confirmed' },
        { salonToday: '2026-11-10', reminderSettings: oneDay },
      ),
    ).toBe(null)
  })
})

describe('Phase 7 — SMS consent + eligibility', () => {
  it('requires SMS opt-in and phone when email is unavailable', () => {
    const emailMethod = {
      salonToday: '2026-11-10',
      now: reminderNow,
      reminderSettings: { method: 'email', intervalsDays: [1] },
    }
    const bothLive = {
      salonToday: '2026-11-10',
      now: reminderNow,
      smsOperational: true,
      reminderSettings: { method: 'both', intervalsDays: [1] },
    }
    const clients = new Map([['client-1', optedInClient]])
    expect(isReminderEligible(baseAppt, clients, emailMethod).eligible).toBe(true)

    const noConsentPhoneOnly = {
      ...optedInClient,
      email: '',
      smsConsent: { optedIn: false, optedInAt: null, optedOutAt: null, source: null },
    }
    // Email-only method: missing email is the reason (no silent SMS fallback).
    expect(
      isReminderEligible(baseAppt, new Map([['client-1', noConsentPhoneOnly]]), emailMethod)
        .reason,
    ).toBe('missing_email')
    // Both/SMS with live SMS: lack of opt-in blocks the text channel.
    expect(
      isReminderEligible(baseAppt, new Map([['client-1', noConsentPhoneOnly]]), bothLive)
        .reason,
    ).toBe('sms_not_opted_in')

    const noConsentWithEmail = {
      ...optedInClient,
      smsConsent: { optedIn: false, optedInAt: null, optedOutAt: null, source: null },
    }
    const emailOnly = isReminderEligible(
      baseAppt,
      new Map([['client-1', noConsentWithEmail]]),
      emailMethod,
    )
    expect(emailOnly.eligible).toBe(true)
    expect(emailOnly.channels.email).toBe(true)
    expect(emailOnly.channels.sms).toBe(false)

    expect(clientAllowsSmsReminders({ phone: '', smsConsent: { optedIn: true } })).toBe(false)
  })

  it('booking alone is not consent', () => {
    expect(clientAllowsSmsReminders({ phone: '4045550100' })).toBe(false)
  })
})

describe('Phase 7 — SMS message', () => {
  it('builds concise reminder without notes', () => {
    const text = buildReminderSms({
      client: optedInClient,
      appointment: baseAppt,
      salonName: "Rozie's Salon",
    })
    expect(text).toContain('Sarah')
    expect(text).toContain("Rozie's Salon")
    expect(text).toContain('YES')
    expect(text).toContain('STOP')
    expect(text).toContain('HELP')
    expect(text).not.toContain('color formula')
    expect(text).not.toContain('Haircut')
  })
})

describe('Phase 7 — YES matching + inbound', () => {
  const pendingWithSms = {
    ...baseAppt,
    reminders: { sevenDaySentAt: null, threeDaySentAt: null, oneDaySentAt: '2026-11-10T19:00:00.000Z' },
    sms: {
      conversationId: 'smsconv-abc',
      outboundMessageId: 'msg-1',
      outboundSentAt: '2026-11-10T19:00:00.000Z',
      phoneE164: '+14045550100',
      confirmedVia: null,
    },
  }

  it('recognizes YES variants', () => {
    expect(classifyInboundSmsCommand('YES').type).toBe('confirm_yes')
    expect(classifyInboundSmsCommand('Yes').type).toBe('confirm_yes')
    expect(classifyInboundSmsCommand('yes').type).toBe('confirm_yes')
    expect(classifyInboundSmsCommand('YES!').type).toBe('confirm_yes')
  })

  it('confirms matching pending appointment and sets confirmedAt', () => {
    const result = processInboundSms({
      appointments: [pendingWithSms],
      clients: [optedInClient],
      phoneE164: '+14045550100',
      body: 'YES',
      options: { atIso: '2026-11-10T19:05:00.000Z', salonToday: '2026-11-10' },
    })
    expect(result.result).toBe('confirmed')
    expect(result.appointment.status).toBe('confirmed')
    expect(result.appointment.confirmation.confirmedAt).toBe('2026-11-10T19:05:00.000Z')
    expect(result.appointment.sms.confirmedVia).toBe('sms')
    expect(result.forward.outcome).toMatch(/automatically confirmed/i)
  })

  it('duplicate YES is idempotent', () => {
    const first = processInboundSms({
      appointments: [pendingWithSms],
      clients: [optedInClient],
      phoneE164: '4045550100',
      body: 'yes',
      options: { salonToday: '2026-11-10' },
    })
    const second = processInboundSms({
      appointments: first.appointments,
      clients: first.clients,
      phoneE164: '4045550100',
      body: 'YES',
      options: { salonToday: '2026-11-10' },
    })
    expect(second.result).toBe('already_confirmed')
  })

  it('unknown phone cannot confirm', () => {
    const result = processInboundSms({
      appointments: [pendingWithSms],
      clients: [optedInClient],
      phoneE164: '+14045559999',
      body: 'YES',
      options: { salonToday: '2026-11-10' },
    })
    expect(result.result).toBe('none')
    expect(result.appointments[0].status).toBe('pending')
  })

  it('does not guess among multiple pending SMS confirmations', () => {
    const other = {
      ...pendingWithSms,
      id: 'appt-2',
      date: '2026-11-12',
      sms: { ...pendingWithSms.sms, outboundMessageId: 'msg-2' },
    }
    const match = matchInboundSmsReply([pendingWithSms, other], '+14045550100', 'YES', {
      salonToday: '2026-11-10',
    })
    expect(match.status).toBe('ambiguous')

    const byMsg = matchInboundSmsReply([pendingWithSms, other], '+14045550100', 'YES', {
      salonToday: '2026-11-10',
      outboundMessageId: 'msg-2',
    })
    expect(byMsg.status).toBe('matched')
    expect(byMsg.appointment.id).toBe('appt-2')
  })

  it('STOP opts out and blocks future automated SMS', () => {
    const result = processInboundSms({
      appointments: [pendingWithSms],
      clients: [optedInClient],
      phoneE164: '+14045550100',
      body: 'STOP',
    })
    expect(result.result).toBe('opted_out')
    expect(clientAllowsSmsReminders(result.clients[0])).toBe(false)
  })

  it('freeform messages do not auto-change appointments', () => {
    const result = processInboundSms({
      appointments: [pendingWithSms],
      clients: [optedInClient],
      phoneE164: '+14045550100',
      body: 'Can I come 30 minutes later?',
      options: { salonToday: '2026-11-10' },
    })
    expect(result.result).toBe('freeform')
    expect(result.appointments[0].status).toBe('pending')
    expect(result.forward.outcome).toMatch(/no automatic/i)
  })
})

describe('Phase 7 — email reply authorization + bridge routing', () => {
  it('parses sms+conversation local parts', () => {
    expect(parseBridgeLocalPart('sms+smsconv-abc')).toBe('smsconv-abc')
    expect(parseBridgeLocalPart('random')).toBe(null)
  })

  it('rejects unauthorized email senders', () => {
    expect(isAuthorizedRozieSender('attacker@evil.com', ['rozie@salon.example'])).toBe(false)
    expect(isAuthorizedRozieSender('rozie@salon.example', ['rozie@salon.example'])).toBe(true)
  })
})

describe('Phase 7 — existing confirmation link still works', () => {
  it('link confirmation still confirms and marks channel', () => {
    const ensured = ensureConfirmationToken(baseAppt)
    const result = confirmAppointmentByToken([ensured.appointment], ensured.rawToken, {
      salonToday: '2026-11-01',
    })
    expect(result.status).toBe('confirmed')
    expect(result.appointment.status).toBe('confirmed')
    expect(result.appointment.confirmation.confirmedAt).toBeTruthy()
    expect(result.appointment.sms.confirmedVia).toBe('link')
  })
})

describe('phone normalize', () => {
  it('normalizes US numbers to E.164', () => {
    expect(normalizeUsE164('(404) 555-0100')).toBe('+14045550100')
    expect(normalizeUsE164('14045550100')).toBe('+14045550100')
    expect(applySmsOptIn(optedInClient).smsConsent.optedIn).toBe(true)
    expect(applySmsOptOut(optedInClient).smsConsent.optedIn).toBe(false)
  })
})
