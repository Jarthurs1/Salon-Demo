/**
 * Match imported client drafts against existing records.
 * Prefer phone, then email, then exact normalized name.
 * Does not auto-merge — returns match suggestions for review.
 */

import {
  collapseWhitespace,
  buildDisplayName,
  getClientDisplayName,
  normalizeForMatch,
  normalizeEmail,
  digitsOnly,
} from '../utils/clientUtils.js'

function phoneKey(phone) {
  const digits = digitsOnly(phone)
  if (digits.length === 10) return digits
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return ''
}

/**
 * @returns {{
 *   status: 'new' | 'matched' | 'possible_duplicate',
 *   matchedClientId: string | null,
 *   matchedClient: object | null,
 *   reason: string | null,
 *   candidates: object[],
 * }}
 */
export function matchImportedClient(draft, existingClients = []) {
  const list = Array.isArray(existingClients) ? existingClients : []
  const phone = phoneKey(draft?.phone)
  const email = draft?.email ? normalizeEmail(draft.email) : ''
  const nameKey = normalizeForMatch(
    buildDisplayName(draft?.firstName, draft?.lastName) || draft?.clientName || '',
  )

  if (phone) {
    const phoneMatches = list.filter((c) => phoneKey(c.phone) === phone)
    if (phoneMatches.length === 1) {
      return {
        status: 'matched',
        matchedClientId: phoneMatches[0].id,
        matchedClient: phoneMatches[0],
        reason: 'phone',
        candidates: phoneMatches,
      }
    }
    if (phoneMatches.length > 1) {
      return {
        status: 'possible_duplicate',
        matchedClientId: null,
        matchedClient: null,
        reason: 'phone_ambiguous',
        candidates: phoneMatches,
      }
    }
  }

  if (email) {
    const emailMatches = list.filter((c) => c.email && c.email === email)
    if (emailMatches.length === 1) {
      return {
        status: 'matched',
        matchedClientId: emailMatches[0].id,
        matchedClient: emailMatches[0],
        reason: 'email',
        candidates: emailMatches,
      }
    }
    if (emailMatches.length > 1) {
      return {
        status: 'possible_duplicate',
        matchedClientId: null,
        matchedClient: null,
        reason: 'email_ambiguous',
        candidates: emailMatches,
      }
    }
  }

  if (nameKey) {
    const nameMatches = list.filter(
      (c) => normalizeForMatch(getClientDisplayName(c)) === nameKey,
    )
    if (nameMatches.length > 0) {
      return {
        status: 'possible_duplicate',
        matchedClientId: nameMatches.length === 1 ? nameMatches[0].id : null,
        matchedClient: nameMatches.length === 1 ? nameMatches[0] : null,
        reason: 'name',
        candidates: nameMatches,
      }
    }
  }

  return {
    status: 'new',
    matchedClientId: null,
    matchedClient: null,
    reason: null,
    candidates: [],
  }
}

/**
 * Attach match metadata + default resolution action to each client draft.
 * Actions: create | link | skip
 */
export function enrichClientsWithMatches(clients, existingClients = []) {
  return (Array.isArray(clients) ? clients : []).map((draft) => {
    const match = matchImportedClient(draft, existingClients)
    let action = 'create'
    if (match.status === 'matched') action = 'link'
    if (match.status === 'possible_duplicate') action = 'link'

    return {
      ...draft,
      match,
      action: match.matchedClientId ? action : match.status === 'possible_duplicate' ? 'create' : 'create',
      linkedClientId: match.matchedClientId,
    }
  })
}

export function matchLabel(match) {
  if (!match) return 'New client'
  if (match.status === 'matched') {
    if (match.reason === 'phone') return 'Matched by phone — review before saving'
    if (match.reason === 'email') return 'Matched by email — review before saving'
    return 'Matched existing client — review before saving'
  }
  if (match.status === 'possible_duplicate') {
    if (match.reason === 'name') return 'Possible duplicate (same name) — review'
    return 'Possible duplicate — review'
  }
  return 'New client'
}

export function duplicateActionLabel(action) {
  if (action === 'skip') return 'Skip'
  if (action === 'link') return 'Review Existing Client'
  return 'Add as New'
}

export function displayNameFromDraft(draft) {
  return (
    buildDisplayName(draft?.firstName, draft?.lastName) ||
    collapseWhitespace(draft?.clientName) ||
    'Unnamed client'
  )
}
