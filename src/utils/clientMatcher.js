/**
 * Match spoken/typed client names against the shared client list.
 */

import {
  getClientDisplayName,
  normalizeForMatch,
  titleCaseName,
} from './clientUtils.js'

/**
 * @returns {{
 *   status: 'matched' | 'ambiguous' | 'unknown' | 'empty',
 *   client?: object,
 *   matches?: object[],
 *   name?: string,
 *   query?: string
 * }}
 */
export function matchClient(clientText, clients) {
  const raw = String(clientText ?? '').trim()
  if (!raw) {
    return { status: 'empty' }
  }

  const normalized = normalizeForMatch(raw)
  const list = clients ?? []

  const exact = list.filter(
    (c) => normalizeForMatch(getClientDisplayName(c)) === normalized,
  )
  if (exact.length === 1) {
    return { status: 'matched', client: exact[0] }
  }
  if (exact.length > 1) {
    return { status: 'ambiguous', matches: exact, query: raw }
  }

  const contains = list.filter((c) => {
    const name = normalizeForMatch(getClientDisplayName(c))
    return name.includes(normalized) || normalized.includes(name)
  })
  if (contains.length === 1) {
    return { status: 'matched', client: contains[0] }
  }
  if (contains.length > 1) {
    return {
      status: 'ambiguous',
      matches: contains,
      query: titleCaseName(raw),
    }
  }

  const tokens = normalized.split(' ').filter(Boolean)
  const firstName = tokens[0]
  const lastName = tokens.length > 1 ? tokens[tokens.length - 1] : null

  if (firstName) {
    const byFirst = list.filter(
      (c) => normalizeForMatch(c.firstName) === firstName,
    )
    if (byFirst.length === 1) {
      return { status: 'matched', client: byFirst[0] }
    }
    if (byFirst.length > 1) {
      return {
        status: 'ambiguous',
        matches: byFirst,
        query: titleCaseName(firstName),
      }
    }
  }

  if (lastName && tokens.length === 1) {
    // bare last-name style query already handled as firstName above;
    // unique last name when a single token didn't match first names
  }

  if (tokens.length === 1) {
    const byLast = list.filter(
      (c) => normalizeForMatch(c.lastName) === firstName,
    )
    if (byLast.length === 1) {
      return { status: 'matched', client: byLast[0] }
    }
    if (byLast.length > 1) {
      return {
        status: 'ambiguous',
        matches: byLast,
        query: titleCaseName(firstName),
      }
    }
  }

  return {
    status: 'unknown',
    name: titleCaseName(raw),
  }
}

export { titleCaseName }
