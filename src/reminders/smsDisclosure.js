/**
 * Customer-facing SMS consent disclosure for AWS US toll-free verification.
 * Consent UI uses the application working name "Simple Salon" — not a salon
 * business name, DBA, company identity, or formal SMS program name.
 */

export const SMS_PRIVACY_URL =
  'https://main.d2oxpzhi8msliv.amplifyapp.com/sms-privacy'
export const SMS_TERMS_URL =
  'https://main.d2oxpzhi8msliv.amplifyapp.com/sms-terms'

/** Bump when disclosure wording changes. */
export const SMS_DISCLOSURE_VERSION = '2026-11-verbal-v2'

/** Application working name used in consent UI (not a registered company). */
export const SMS_CONSENT_APP_NAME = 'Simple Salon'

/**
 * Fallback label for STOP/HELP acknowledgments when no registered brand is configured.
 * Prefer schedule.smsRegisteredBrand once AWS registration is approved.
 */
export const DEFAULT_REGISTERED_MESSAGING_BRAND = SMS_CONSENT_APP_NAME

export function getRegisteredMessagingBrand(schedule = {}) {
  const configured = String(schedule?.smsRegisteredBrand || '').trim()
  return configured || DEFAULT_REGISTERED_MESSAGING_BRAND
}

export function getSmsSupportContact(schedule = {}) {
  const phone = String(schedule?.contactPhone || '').trim()
  if (phone) return phone
  const email = String(schedule?.contactEmail || '').trim()
  if (email) return email
  return 'your salon'
}

/** @deprecated Consent copy no longer uses a formal "* Appointment Reminders" program name. */
export function getSmsProgramName() {
  return SMS_CONSENT_APP_NAME
}

/** Stylist checkbox confirmation line (short). */
export const SMS_CONSENT_CHECKBOX_LABEL =
  'I confirm this customer has explicitly agreed to receive appointment reminders by text message.'

/**
 * Disclosure shown beside the stylist checkbox.
 * Argument ignored — kept for call-site compatibility.
 */
export function buildStylistSmsDisclosure() {
  return (
    `By agreeing, the customer authorizes appointment reminder texts from ${SMS_CONSENT_APP_NAME}, ` +
    'generally up to one per appointment. Message and data rates may apply. ' +
    'Consent is optional and not required to receive salon services. ' +
    'The customer can reply STOP to unsubscribe or HELP for assistance.'
  )
}

/**
 * Verbal consent script the stylist can read aloud.
 * Argument ignored — kept for call-site compatibility.
 */
export function buildVerbalConsentScript() {
  return (
    `Would you like to receive appointment reminders by text from ${SMS_CONSENT_APP_NAME}? ` +
    "Usually it's one text per appointment if you haven't confirmed. " +
    'Message and data rates may apply. You can reply STOP anytime or HELP for assistance. ' +
    "It's completely optional."
  )
}

/** @deprecated Prefer buildStylistSmsDisclosure for the client form. */
export function buildSmsConsentDisclosure() {
  return buildStylistSmsDisclosure()
}

/** @deprecated Prefer buildStylistSmsDisclosure + SMS_CONSENT_CHECKBOX_LABEL. */
export function buildSmsConsentDisclosureStylist() {
  return buildStylistSmsDisclosure()
}

export const SMS_PROGRAM_NAME = getSmsProgramName()
export const SMS_CONSENT_DISCLOSURE = buildStylistSmsDisclosure()
export const SMS_CONSENT_DISCLOSURE_STYLIST = buildStylistSmsDisclosure()

export function buildStopAcknowledgmentSms(schedule = {}) {
  const brand = getRegisteredMessagingBrand(schedule)
  return (
    `${brand}: You are unsubscribed from appointment texts. ` +
    'No further messages will be sent. Reply HELP for assistance.'
  )
}

export function buildHelpAcknowledgmentSms(schedule = {}) {
  const brand = getRegisteredMessagingBrand(schedule)
  const support = getSmsSupportContact(schedule)
  return (
    `${brand}: Appointment reminder assistance: ${support}. Reply STOP to opt out.`
  )
}

export function buildStartAcknowledgmentSms(schedule = {}) {
  const brand = getRegisteredMessagingBrand(schedule)
  return (
    `${brand}: You are subscribed to appointment reminder texts. ` +
    'Reply STOP to opt out.'
  )
}
