/**
 * Client name / email / phone helpers shared across Clients, Book, and Calendar.
 */

export function collapseWhitespace(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

export function normalizeForMatch(value) {
  return collapseWhitespace(value).toLowerCase()
}

export function normalizeEmail(value) {
  return collapseWhitespace(value).toLowerCase()
}

export function isValidEmail(value) {
  const email = collapseWhitespace(value)
  if (!email) return false
  // Practical prototype check — not RFC-complete
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function splitFullName(fullName) {
  const parts = collapseWhitespace(fullName).split(' ').filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

export function buildDisplayName(firstName, lastName) {
  return collapseWhitespace(`${firstName ?? ''} ${lastName ?? ''}`)
}

export function getClientDisplayName(client) {
  if (!client) return ''
  if (client.displayName) return client.displayName
  const built = buildDisplayName(client.firstName, client.lastName)
  if (built) return built
  return client.name || ''
}

/** List display: "Last, First" when both names exist. */
export function getClientListName(client) {
  if (!client) return ''
  const first = collapseWhitespace(client.firstName)
  const last = collapseWhitespace(client.lastName)
  if (last && first) return `${last}, ${first}`
  if (last) return last
  if (first) return first
  return getClientDisplayName(client)
}

export function getClientInitials(client) {
  const first = collapseWhitespace(client?.firstName)
  const last = collapseWhitespace(client?.lastName)
  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase()
  }
  const display = getClientDisplayName(client)
  const parts = display.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

/** Digits only for matching / comparison */
export function digitsOnly(phone) {
  return String(phone ?? '').replace(/\D/g, '')
}

/**
 * Dialable E.164 for native sms:/tel: links (US-focused).
 * Returns null when the number is missing or not usable.
 */
export function getDialableE164(phone) {
  const raw = String(phone ?? '').trim()
  if (!raw) return null
  const digits = digitsOnly(raw)
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (raw.startsWith('+') && digits.length >= 11) return `+${digits}`
  return null
}

/**
 * Opens iOS Messages with the number populated; does not send.
 * Optional `body` is prefilled draft text (iPhone Safari: sms:+E164&body=...).
 */
export function buildSmsUrl(phone, { body } = {}) {
  const e164 = getDialableE164(phone)
  if (!e164) return null
  const draft = String(body ?? '').trim()
  if (!draft) return `sms:${e164}`
  return `sms:${e164}&body=${encodeURIComponent(draft)}`
}

/** Opens the native phone dialer. */
export function buildTelUrl(phone) {
  const e164 = getDialableE164(phone)
  return e164 ? `tel:${e164}` : null
}

/**
 * Digits for phone search — strips a leading US country code so
 * "4045551234" matches "+1 (404) 555-1234".
 */
export function phoneDigitsForSearch(phone) {
  let digits = digitsOnly(phone)
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1)
  }
  return digits
}

/**
 * Case-insensitive partial match on name, email, and phone
 * (phone compared with formatting stripped).
 */
export function clientMatchesSearchQuery(client, query) {
  const q = normalizeForMatch(query)
  if (!q) return true

  const nameFields = [
    getClientDisplayName(client),
    client?.firstName,
    client?.lastName,
    client?.displayName,
    client?.name,
    client?.email,
  ]

  if (nameFields.some((field) => normalizeForMatch(field).includes(q))) {
    return true
  }

  const qDigits = phoneDigitsForSearch(query)
  const phoneDigits = phoneDigitsForSearch(client?.phone)
  if (qDigits && phoneDigits.includes(qDigits)) {
    return true
  }

  return normalizeForMatch(client?.phone).includes(q)
}

/**
 * Secondary line under the client name: phone, else email, else muted empty label.
 */
export function getClientSecondaryContact(client) {
  const phone = collapseWhitespace(client?.phone)
  if (phone) {
    return { type: 'phone', text: formatPhoneDisplay(phone) }
  }
  const email = collapseWhitespace(client?.email)
  if (email) {
    return { type: 'email', text: email }
  }
  return { type: 'none', text: 'No contact information' }
}

/**
 * Format common US numbers for display.
 * Preserves short/incomplete values as entered.
 */
export function formatPhoneDisplay(phone) {
  const raw = collapseWhitespace(phone)
  if (!raw) return ''
  const digits = digitsOnly(raw)
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return raw
}

export function titleCaseName(text) {
  return collapseWhitespace(text)
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}
