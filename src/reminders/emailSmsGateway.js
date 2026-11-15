/**
 * Provider-independent email ↔ SMS gateway adapter (Phase 7B POC).
 *
 * Preferred POC target: text.email
 *   Outbound: {10digit}@{subdomain.}text.email
 *   Inbound replies: emailed to the text.email account-holder address
 *     (subject typically includes the customer phone). Exact MIME format
 *     remains partially unverified until a controlled live test.
 *
 * Does NOT use AWS End User Messaging origination numbers.
 */

import {
  normalizeUsE164,
  digitsOnly,
  classifyInboundSmsCommand,
  SMS_DISCLOSURE_VERSION,
} from './smsConsent.js'

export { SMS_DISCLOSURE_VERSION }
export const SMS_CONSENT_SOURCE_WEBSITE = 'website'
export const SMS_CONSENT_SOURCE_STYLIST = 'stylist_app'

export function getGatewayConfig(env = process.env) {
  return {
    provider: String(env.EMAIL_SMS_PROVIDER || 'text_email').trim() || 'text_email',
    domain: String(env.EMAIL_SMS_GATEWAY_DOMAIN || '').trim(),
    subdomain: String(env.EMAIL_SMS_GATEWAY_SUBDOMAIN || '').trim(),
    // Optional allowlist of From domains for inbound reply emails
    inboundFromDomains: String(env.EMAIL_SMS_INBOUND_FROM_DOMAINS || 'text.email')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
  }
}

/** 10-digit US/CA national number for gateway local-part addressing. */
export function toGatewayLocalPart(phone) {
  const e164 = normalizeUsE164(phone)
  if (!e164) return null
  const digits = digitsOnly(e164)
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  if (digits.length === 10) return digits
  return null
}

/**
 * Build outbound email recipient for the gateway.
 * Returns null if gateway domain or phone is not configured.
 */
export function buildGatewayRecipient(phone, config = getGatewayConfig()) {
  const local = toGatewayLocalPart(phone)
  const domain = String(config.domain || '').replace(/^@/, '').trim()
  if (!local || !domain) return null
  const subdomain = String(config.subdomain || '').trim()
  const host = subdomain ? `${subdomain}.${domain}` : domain
  return `${local}@${host}`
}

/** Short correlation token embedded in outbound SMS body. */
export function buildCorrelationRef(conversationId) {
  const raw = String(conversationId || '').replace(/^smsconv-/, '')
  return raw.slice(0, 8).toLowerCase() || null
}

export function extractCorrelationRef(text) {
  const match = /\bRef:\s*([a-z0-9]{6,16})\b/i.exec(String(text || ''))
  return match ? match[1].toLowerCase() : null
}

/**
 * Outbound SMS body for gateway delivery (customer-visible).
 * Includes Ref for reply correlation when the gateway does not preserve headers.
 */
export function buildGatewaySmsBody({ client, appointment, salonName, conversationId }) {
  const name =
    String(client?.firstName || '').trim() ||
    String(client?.name || client?.fullName || 'there').trim().split(/\s+/)[0] ||
    'there'
  const [hRaw, mRaw] = String(appointment?.startTime || '00:00').split(':').map(Number)
  const h = Number.isFinite(hRaw) ? hRaw : 0
  const m = Number.isFinite(mRaw) ? mRaw : 0
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  const time =
    m === 0
      ? `${hour12}:00 ${suffix}`
      : `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
  const ref = buildCorrelationRef(conversationId)
  const brand = String(salonName || '').trim() || 'Your Salon'
  let body =
    `${brand}: Hi ${name}, your appointment is tomorrow at ${time}. ` +
    `Reply YES to confirm, STOP to opt out, or HELP for help.`
  if (ref) body += ` Ref:${ref}`
  return body
}

export function isAuthorizedGatewaySender(fromEmail, config = getGatewayConfig()) {
  const from = String(fromEmail || '').trim().toLowerCase()
  if (!from || !from.includes('@')) return false
  const domain = from.split('@').pop()
  return (config.inboundFromDomains || []).some(
    (allowed) => domain === allowed || domain.endsWith(`.${allowed}`),
  )
}

/**
 * Extract phone from text.email-style subjects / bodies.
 * Examples (documented patterns; exact live format TBD):
 *   "SMS reply from 4045550100"
 *   "Re: 404-555-0100"
 */
export function extractPhoneFromInboundEmail({ subject = '', body = '', from = '' } = {}) {
  const haystack = `${subject}\n${body}\n${from}`
  const e164Direct = /\+(\d{11,15})\b/.exec(haystack)
  if (e164Direct) return normalizeUsE164(`+${e164Direct[1]}`)

  const tenDigit = /(?:\b|from\s+|reply(?:ing)?\s+from\s+)(?:\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/i.exec(
    haystack,
  )
  if (tenDigit) return normalizeUsE164(`${tenDigit[1]}${tenDigit[2]}${tenDigit[3]}`)

  return null
}

/**
 * Strip quoted reply chains and extract the customer's reply text.
 */
export function extractInboundReplyBody(rawBody) {
  const text = String(rawBody || '')
  const parts = text.split(/\r?\n\r?\n/)
  const body = parts.length > 1 ? parts.slice(1).join('\n\n') : text
  const lines = body.split(/\r?\n/)
  const kept = []
  for (const line of lines) {
    if (/^On .+ wrote:$/i.test(line) || /^>/.test(line) || /^From:/i.test(line)) break
    if (/^-{2,}\s*Original Message/i.test(line)) break
    kept.push(line)
  }
  return kept.join('\n').trim().slice(0, 600)
}

/**
 * Parse a gateway-forwarded reply email into a normalized inbound command.
 * @returns {{
 *   ok: boolean,
 *   reason?: string,
 *   phoneE164: string | null,
 *   body: string,
 *   command: object,
 *   correlationRef: string | null,
 * }}
 */
export function parseGatewayInboundEmail(mail, config = getGatewayConfig()) {
  const fromEmail = String(mail.fromEmail || mail.from || '')
    .replace(/.*</, '')
    .replace(/>.*/, '')
    .trim()
  const subject = String(mail.subject || '')
  const body = extractInboundReplyBody(mail.body || mail.content || '')

  if (config.inboundFromDomains?.length && !isAuthorizedGatewaySender(fromEmail, config)) {
    // Still allow if phone can be extracted from subject (some gateways rewrite From)
    const phoneFallback = extractPhoneFromInboundEmail({ subject, body, from: fromEmail })
    if (!phoneFallback) {
      return {
        ok: false,
        reason: 'unauthorized_or_unrecognized_sender',
        phoneE164: null,
        body,
        command: classifyInboundSmsCommand(body),
        correlationRef: extractCorrelationRef(`${subject}\n${body}`),
      }
    }
  }

  const phoneE164 =
    extractPhoneFromInboundEmail({ subject, body, from: fromEmail }) ||
    normalizeUsE164(mail.phoneE164)

  if (!phoneE164) {
    return {
      ok: false,
      reason: 'missing_phone',
      phoneE164: null,
      body,
      command: classifyInboundSmsCommand(body),
      correlationRef: extractCorrelationRef(`${subject}\n${body}`),
    }
  }

  return {
    ok: true,
    phoneE164,
    body,
    command: classifyInboundSmsCommand(body),
    correlationRef: extractCorrelationRef(`${subject}\n${body}`),
    fromEmail,
  }
}
