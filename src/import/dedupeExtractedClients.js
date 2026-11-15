/**
 * Collapse duplicate client drafts extracted from overlapping screenshots.
 */

import {
  buildDisplayName,
  digitsOnly,
  normalizeEmail,
  normalizeForMatch,
} from '../utils/clientUtils.js'

function phoneKey(phone) {
  const digits = digitsOnly(phone)
  if (digits.length === 10) return digits
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return ''
}

function confidenceRank(value) {
  if (value === 'high') return 3
  if (value === 'medium') return 2
  if (value === 'low') return 1
  return 0
}

function mergeRow(primary, incoming) {
  const next = { ...primary }
  for (const field of ['firstName', 'lastName', 'phone', 'email', 'notes']) {
    if (!String(next[field] || '').trim() && String(incoming[field] || '').trim()) {
      next[field] = incoming[field]
    }
  }
  const uncertain = new Set([
    ...(primary.uncertainFields || []),
    ...(incoming.uncertainFields || []),
  ])
  next.uncertainFields = [...uncertain]
  if (confidenceRank(incoming.confidence) > confidenceRank(primary.confidence)) {
    next.confidence = incoming.confidence
  }
  return next
}

function identityKey(row) {
  const phone = phoneKey(row.phone)
  if (phone) return `phone:${phone}`
  const email = row.email ? normalizeEmail(row.email) : ''
  if (email) return `email:${email}`
  const name = normalizeForMatch(
    buildDisplayName(row.firstName, row.lastName) || row.clientName || '',
  )
  if (name) return `name:${name}`
  return `temp:${row.tempId}`
}

/**
 * Prefer phone, then email, then exact normalized name for within-batch dedupe.
 */
export function dedupeExtractedClients(clients = []) {
  const map = new Map()
  for (const row of Array.isArray(clients) ? clients : []) {
    const key = identityKey(row)
    if (!map.has(key)) {
      map.set(key, { ...row })
      continue
    }
    map.set(key, mergeRow(map.get(key), row))
  }
  return [...map.values()].map((row, index) => ({
    ...row,
    tempId: row.tempId || `client-${index + 1}`,
  }))
}
