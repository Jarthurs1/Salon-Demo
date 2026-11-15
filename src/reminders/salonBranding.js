/**
 * Resolve per-salon branding from schedule settings.
 * Never falls back to another salon's contact email.
 */

import {
  PRODUCT_NAME,
  UNNAMED_SALON_FALLBACK,
  UNNAMED_STYLIST_FALLBACK,
} from './productName.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidContactEmail(value) {
  const email = String(value || '').trim()
  if (!email || email.length > 254) return false
  return EMAIL_RE.test(email)
}

export function normalizeContactEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  return isValidContactEmail(email) ? email : ''
}

export function normalizeContactPhone(value) {
  return String(value || '').trim()
}

/**
 * @param {object} [schedule]
 */
export function resolveSalonBranding(schedule = {}) {
  const salonName =
    String(schedule?.salonName || '').trim() || UNNAMED_SALON_FALLBACK
  const stylistName =
    String(schedule?.stylistName || schedule?.stylistFirstName || '').trim() ||
    UNNAMED_STYLIST_FALLBACK
  const contactEmail = normalizeContactEmail(schedule?.contactEmail)
  const contactPhone = normalizeContactPhone(schedule?.contactPhone)

  return {
    salonName,
    stylistName,
    stylistFirstName: stylistName,
    contactEmail,
    contactPhone,
    productName: PRODUCT_NAME,
    hasContactEmail: Boolean(contactEmail),
  }
}

/**
 * One-time seed for Rozie's existing account only.
 * Never use her mailbox as a global default for other salons.
 */
export function shouldSeedRozieContactEmail() {
  return false
}

export const ROZIE_LEGACY_CONTACT_EMAIL = ''

export function applyContactEmailMigration(schedule = {}) {
  return { schedule, migrated: false }
}

export function buildTestNotificationEmail(branding) {
  const resolved = resolveSalonBranding(branding)
  const subject = `${PRODUCT_NAME} — Test Notification`
  const text = [
    `Hi ${resolved.stylistName},`,
    '',
    `This is a test notification from ${PRODUCT_NAME}.`,
    '',
    'Your salon notification email is configured successfully.',
    '',
    `Salon: ${resolved.salonName}`,
    '',
    'You will receive appointment cancellations and reschedule notifications at this address.',
    '',
    PRODUCT_NAME,
  ].join('\n')
  return { subject, text }
}
