/**
 * SMS consent + phone normalization (US-focused).
 * Booking alone is NOT consent — optedIn must be explicitly true.
 * A prior STOP cannot be cleared by a stylist checkbox alone.
 */

export { SMS_DISCLOSURE_VERSION } from './smsDisclosure.js'
import { SMS_DISCLOSURE_VERSION } from './smsDisclosure.js'

export const SMS_CONSENT_SOURCE_STYLIST_FORM = 'stylist_client_form'
export const SMS_CONSENT_SOURCE_WEBSITE = 'website'
export const SMS_CONSENT_SOURCE_SMS_START = 'sms_start'
export const SMS_CONSENT_METHOD_VERBAL = 'verbal'

export function digitsOnly(phone) {
  return String(phone ?? '').replace(/\D/g, '')
}

/**
 * Normalize to E.164 for US numbers (+1XXXXXXXXXX).
 * Returns null if not a usable US mobile/landline form.
 */
export function normalizeUsE164(phone) {
  const digits = digitsOnly(phone)
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (String(phone ?? '').trim().startsWith('+') && digits.length >= 11) {
    return `+${digits}`
  }
  return null
}

export function emptySmsConsent() {
  return {
    optedIn: false,
    consentMethod: null,
    consentTimestamp: null,
    optedInAt: null,
    consentRecordedBy: null,
    disclosureVersion: null,
    optedOutAt: null,
    consentSource: null,
    /** @deprecated Prefer consentSource — kept for older records. */
    source: null,
    phoneE164AtConsent: null,
    history: [],
  }
}

function asHistory(raw) {
  return Array.isArray(raw) ? raw.filter((entry) => entry && typeof entry === 'object') : []
}

function resolveSource(raw = {}) {
  return (
    String(raw.consentSource || raw.source || '').trim() || null
  )
}

export function normalizeSmsConsent(client) {
  const raw = client?.smsConsent && typeof client.smsConsent === 'object'
    ? client.smsConsent
    : {}
  const consentSource = resolveSource(raw)
  const consentTimestamp = raw.consentTimestamp || raw.optedInAt || null
  const optedOutAt = raw.optedOutAt || null
  return {
    ...emptySmsConsent(),
    ...raw,
    optedIn: Boolean(raw.optedIn) && !optedOutAt,
    consentMethod: raw.consentMethod || null,
    consentTimestamp,
    optedInAt: raw.optedInAt || consentTimestamp || null,
    consentRecordedBy: raw.consentRecordedBy || null,
    disclosureVersion: raw.disclosureVersion || null,
    optedOutAt,
    consentSource,
    source: consentSource,
    phoneE164AtConsent: raw.phoneE164AtConsent || null,
    history: asHistory(raw.history),
  }
}

export function clientAllowsSmsReminders(client) {
  const phone = normalizeUsE164(client?.phone)
  if (!phone) return false
  const consent = normalizeSmsConsent(client)
  return consent.optedIn === true && !consent.optedOutAt
}

/** True when a carrier/provider STOP (or equivalent) is on file. */
export function hasActiveSmsOptOut(client) {
  const consent = normalizeSmsConsent(client)
  return Boolean(consent.optedOutAt)
}

function appendHistory(consent, entry) {
  const history = asHistory(consent.history)
  return [...history, entry].slice(-50)
}

export function applySmsOptOut(
  client,
  atIso = new Date().toISOString(),
  options = {},
) {
  const consent = normalizeSmsConsent(client)
  const next = {
    ...consent,
    optedIn: false,
    optedOutAt: atIso,
  }
  next.history = appendHistory(consent, {
    type: 'opt_out',
    at: atIso,
    keyword: options.keyword || null,
    source: options.source || 'sms_keyword',
    by: options.by || null,
  })
  return {
    ...client,
    smsConsent: next,
  }
}

/**
 * Re-opt-in via carrier-supported START/UNSTOP (or equivalent).
 * Does not clear provider-level suppression by itself — callers must
 * coordinate with Amazon End User Messaging when that path is live.
 */
export function applySmsOptIn(
  client,
  atIso = new Date().toISOString(),
  source = 'manual',
  options = {},
) {
  const consent = normalizeSmsConsent(client)
  const phoneE164 = normalizeUsE164(options.phoneE164 || client?.phone)
  const consentSource = source || SMS_CONSENT_SOURCE_SMS_START
  const next = {
    ...consent,
    optedIn: true,
    optedInAt: atIso,
    consentTimestamp: atIso,
    optedOutAt: null,
    consentMethod: options.consentMethod || (consentSource === SMS_CONSENT_SOURCE_SMS_START ? 'sms_keyword' : null),
    consentRecordedBy: options.consentRecordedBy || null,
    consentSource,
    source: consentSource,
    disclosureVersion: options.disclosureVersion || SMS_DISCLOSURE_VERSION,
    phoneE164AtConsent: phoneE164,
  }
  next.history = appendHistory(consent, {
    type: 'opt_in',
    at: atIso,
    source: consentSource,
    method: next.consentMethod,
    by: options.consentRecordedBy || null,
    disclosureVersion: next.disclosureVersion,
    keyword: options.keyword || null,
  })
  return {
    ...client,
    smsConsent: next,
  }
}

/**
 * Record explicit verbal consent from the stylist client form.
 * Refuses to clear an active STOP — customer must text START/UNSTOP.
 */
export function recordVerbalSmsConsent({
  previousConsent,
  phone,
  recordedBy,
  atIso = new Date().toISOString(),
  disclosureVersion = SMS_DISCLOSURE_VERSION,
} = {}) {
  const previous = normalizeSmsConsent({ smsConsent: previousConsent })
  if (previous.optedOutAt) {
    const err = new Error(
      'This customer previously replied STOP. They must text START to re-subscribe before SMS reminders can resume.',
    )
    err.code = 'sms_stop_requires_start'
    throw err
  }

  const phoneE164 = normalizeUsE164(phone)
  const next = {
    ...previous,
    optedIn: true,
    optedInAt: previous.optedInAt || atIso,
    consentTimestamp: atIso,
    optedOutAt: null,
    consentMethod: SMS_CONSENT_METHOD_VERBAL,
    consentRecordedBy: recordedBy || null,
    consentSource: SMS_CONSENT_SOURCE_STYLIST_FORM,
    source: SMS_CONSENT_SOURCE_STYLIST_FORM,
    disclosureVersion,
    phoneE164AtConsent: phoneE164,
  }
  next.history = appendHistory(previous, {
    type: 'opt_in',
    at: atIso,
    source: SMS_CONSENT_SOURCE_STYLIST_FORM,
    method: SMS_CONSENT_METHOD_VERBAL,
    by: recordedBy || null,
    disclosureVersion,
  })
  return next
}

/**
 * Clear stylist-recorded consent without implying a carrier STOP.
 * Does not send SMS. Used when the stylist unchecks the box before any STOP.
 */
export function clearStylistRecordedConsent(
  previousConsent,
  atIso = new Date().toISOString(),
  options = {},
) {
  const previous = normalizeSmsConsent({ smsConsent: previousConsent })
  if (previous.optedOutAt) {
    // Preserve STOP evidence — never silently undo provider opt-out.
    return {
      ...previous,
      optedIn: false,
    }
  }
  const next = {
    ...previous,
    optedIn: false,
    consentTimestamp: previous.consentTimestamp,
    optedInAt: previous.optedInAt,
    optedOutAt: null,
  }
  if (previous.optedIn) {
    next.history = appendHistory(previous, {
      type: 'consent_cleared',
      at: atIso,
      source: SMS_CONSENT_SOURCE_STYLIST_FORM,
      by: options.recordedBy || null,
    })
  }
  return next
}

/** Build consent object from a public/website booking checkbox (unchecked = no consent). */
export function consentFromOptInCheckbox({
  optedIn,
  phone,
  source,
  atIso = new Date().toISOString(),
  disclosureVersion = SMS_DISCLOSURE_VERSION,
  recordedBy = null,
}) {
  if (!optedIn) return emptySmsConsent()
  const phoneE164 = normalizeUsE164(phone)
  const consentSource = source || SMS_CONSENT_SOURCE_WEBSITE
  return {
    ...emptySmsConsent(),
    optedIn: true,
    optedInAt: atIso,
    consentTimestamp: atIso,
    optedOutAt: null,
    consentMethod: 'checkbox',
    consentRecordedBy: recordedBy,
    consentSource,
    source: consentSource,
    disclosureVersion,
    phoneE164AtConsent: phoneE164,
    history: [
      {
        type: 'opt_in',
        at: atIso,
        source: consentSource,
        method: 'checkbox',
        by: recordedBy,
        disclosureVersion,
      },
    ],
  }
}

/** Provider-required keyword commands (US). CANCEL opts out of SMS — it does NOT cancel appointments. */
export function classifyInboundSmsCommand(body) {
  const normalized = String(body ?? '')
    .trim()
    .toUpperCase()
    .replace(/[!.,]+$/g, '')

  if (!normalized) return { type: 'empty', normalized }

  if (['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(normalized)) {
    return { type: 'stop', normalized }
  }
  if (['START', 'UNSTOP'].includes(normalized)) {
    return { type: 'start', normalized }
  }
  if (['HELP', 'INFO'].includes(normalized)) {
    return { type: 'help', normalized }
  }
  if (normalized === 'YES' || normalized === 'Y') {
    return { type: 'confirm_yes', normalized: 'YES' }
  }

  return { type: 'freeform', normalized, original: String(body ?? '').trim() }
}
