/**
 * Client repository — single source of truth for Calendar, Book, and Clients.
 * UI must not touch storage providers directly.
 */

import { SEED_CLIENTS } from '../data/clients.js'
import { decorateShowcaseClients } from '../demo/showcase.js'
import {
  countAppointmentsForClient,
  syncClientDisplayName,
} from './appointmentRepository.js'
import {
  buildDisplayName,
  collapseWhitespace,
  clientMatchesSearchQuery,
  digitsOnly,
  getClientDisplayName,
  isValidEmail,
  normalizeEmail,
  normalizeForMatch,
  splitFullName,
} from '../utils/clientUtils.js'
import { getStorageProvider } from '../storage/createStorageProvider.js'
import { STORAGE_KEYS, wrapEnvelope } from '../storage/keys.js'
import {
  beginSaving,
  markSaved,
  markSaveError,
  isPersistenceError,
  toUserSaveError,
} from './persistenceStatus.js'
import { emptySmsConsent, normalizeSmsConsent } from '../reminders/smsConsent.js'

function normalizeSavedCard(card) {
  if (!card || typeof card !== 'object') return null
  const brand = String(card.brand || '').trim()
  const last4 = String(card.last4 || '').replace(/\D/g, '').slice(-4)
  if (!brand || last4.length !== 4) return null
  return { brand, last4 }
}

function normalizeClientSmsConsent(raw) {
  if (!raw || typeof raw !== 'object') return emptySmsConsent()
  return normalizeSmsConsent({ smsConsent: raw })
}

const listeners = new Set()
let cache = null
let hydrated = false

function notify() {
  listeners.forEach((listener) => listener())
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `client-${crypto.randomUUID()}`
  }
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function nowIso() {
  return new Date().toISOString()
}

/**
 * Migrate Phase 1–3 `{ id, name, email }` records and normalize Phase 4 shape.
 * Preserves existing IDs so appointments keep working.
 */
export function normalizeClient(record) {
  let firstName = collapseWhitespace(record.firstName)
  let lastName = collapseWhitespace(record.lastName)

  if (!firstName && !lastName && (record.name || record.displayName)) {
    const split = splitFullName(record.name || record.displayName)
    firstName = split.firstName
    lastName = split.lastName
  }

  const displayName =
    collapseWhitespace(record.displayName) ||
    buildDisplayName(firstName, lastName) ||
    collapseWhitespace(record.name)

  const emailRaw = collapseWhitespace(record.email)
  const phoneRaw = collapseWhitespace(record.phone)

  const smsConsent = normalizeClientSmsConsent(record.smsConsent)

  return {
    id: record.id,
    firstName,
    lastName,
    displayName,
    name: displayName,
    email: emailRaw ? normalizeEmail(emailRaw) : '',
    phone: phoneRaw,
    notes: String(record.notes ?? '').trim(),
    savedCard: normalizeSavedCard(record.savedCard),
    smsConsent,
    createdAt: record.createdAt || nowIso(),
    updatedAt: record.updatedAt || record.createdAt || nowIso(),
  }
}

function sortClients(list) {
  return [...list].sort((a, b) => {
    const last = a.lastName.localeCompare(b.lastName, undefined, {
      sensitivity: 'base',
    })
    if (last !== 0) return last
    const first = a.firstName.localeCompare(b.firstName, undefined, {
      sensitivity: 'base',
    })
    if (first !== 0) return first
    return a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: 'base',
    })
  })
}

function extractList(envelope) {
  if (!envelope) return null
  if (Array.isArray(envelope)) return envelope
  if (Array.isArray(envelope.clients)) return envelope.clients
  return null
}

export function hydrateClients(envelope) {
  const list = extractList(envelope)
  cache = sortClients((list ?? []).map(normalizeClient))
  hydrated = true
  notify()
  return cache
}

export function resetClientsCache() {
  cache = null
  hydrated = false
}

export function isClientsHydrated() {
  return hydrated
}

export async function ensureClientsInitialized(envelope) {
  const storage = getStorageProvider()
  const list = extractList(envelope)

  if (list) {
    hydrateClients(envelope)
    return cache
  }

  if (storage.name === 'local') {
    const seeded = decorateShowcaseClients(SEED_CLIENTS).map((seed) =>
      normalizeClient({
        ...seed,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }),
    )
    hydrateClients({ clients: seeded })
    await storage.writeJson(
      STORAGE_KEYS.CLIENTS,
      wrapEnvelope(STORAGE_KEYS.CLIENTS, seeded),
    )
    return cache
  }

  hydrateClients({ clients: [] })
  await storage.writeJson(
    STORAGE_KEYS.CLIENTS,
    wrapEnvelope(STORAGE_KEYS.CLIENTS, []),
  )
  return cache
}

function requireCache() {
  if (!cache) {
    cache = []
    hydrated = true
  }
  return cache
}

async function persist(list, { quiet = false } = {}) {
  const storage = getStorageProvider()
  const sorted = sortClients(list)
  const previous = cache
  cache = sorted
  notify()

  if (!quiet) beginSaving()
  try {
    await storage.writeJson(
      STORAGE_KEYS.CLIENTS,
      wrapEnvelope(STORAGE_KEYS.CLIENTS, sorted),
    )
    if (!quiet) markSaved()
    return sorted
  } catch (error) {
    console.error('[clientRepository] persist failed', error)
    cache = previous
    notify()
    if (!quiet) markSaveError()
    if (isPersistenceError(error)) throw toUserSaveError()
    throw error
  }
}

export function getClients() {
  return requireCache()
}

export function getAllClients() {
  return getClients()
}

export function getClientById(id) {
  if (!id) return null
  return getClients().find((client) => client.id === id) ?? null
}

export function findClientsByName(query) {
  const q = normalizeForMatch(query)
  if (!q) return []
  return getClients().filter((client) => {
    const haystack = normalizeForMatch(
      `${client.firstName} ${client.lastName} ${client.displayName}`,
    )
    return haystack.includes(q)
  })
}

export function searchClients(query) {
  const q = normalizeForMatch(query)
  if (!q) return getClients()
  return getClients().filter((client) => clientMatchesSearchQuery(client, query))
}

function phoneMatchKey(phone) {
  const digits = digitsOnly(phone)
  if (digits.length === 10) return digits
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return ''
}

export function findDuplicateClients({
  firstName,
  lastName,
  name,
  email,
  phone,
  excludeId,
} = {}) {
  const clients = getClients().filter((c) => c.id !== excludeId)
  const display =
    buildDisplayName(firstName, lastName) || collapseWhitespace(name)
  const emailKey = email ? normalizeEmail(email) : ''
  const nameKey = normalizeForMatch(display)
  const phoneKey = phoneMatchKey(phone)

  const phoneMatch = phoneKey
    ? (clients.find((c) => phoneMatchKey(c.phone) === phoneKey) ?? null)
    : null

  const emailMatch = emailKey
    ? (clients.find((c) => c.email && c.email === emailKey) ?? null)
    : null

  const nameMatches = nameKey
    ? clients.filter(
        (c) => normalizeForMatch(getClientDisplayName(c)) === nameKey,
      )
    : []

  return { phoneMatch, emailMatch, nameMatches }
}

function resolveNameParts(input) {
  if (input.firstName != null || input.lastName != null) {
    return {
      firstName: collapseWhitespace(input.firstName),
      lastName: collapseWhitespace(input.lastName),
    }
  }
  if (input.name || input.displayName) {
    return splitFullName(input.name || input.displayName)
  }
  return { firstName: '', lastName: '' }
}

export async function createClient(input = {}, options = {}) {
  const { allowDuplicate = false } = options
  const { firstName, lastName } = resolveNameParts(input)

  if (!firstName) {
    throw new Error('First name is required.')
  }

  const email = collapseWhitespace(input.email)
  if (email && !isValidEmail(email)) {
    throw new Error('Please enter a valid email address.')
  }

  if (!allowDuplicate) {
    const dupes = findDuplicateClients({ firstName, lastName, email })
    if (dupes.emailMatch) {
      const err = new Error('This client may already exist.')
      err.code = 'duplicate_email'
      err.matches = [dupes.emailMatch]
      throw err
    }
    if (dupes.nameMatches.length > 0) {
      const err = new Error('This client may already exist.')
      err.code = 'duplicate_name'
      err.matches = dupes.nameMatches
      throw err
    }
  }

  const timestamp = nowIso()
  const record = normalizeClient({
    id: createId(),
    firstName,
    lastName,
    email,
    phone: input.phone ?? '',
    notes: input.notes ?? '',
    smsConsent: input.smsConsent,
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  await persist([...getClients(), record])
  return record
}

export async function updateClient(id, patch = {}) {
  const clients = [...getClients()]
  const index = clients.findIndex((c) => c.id === id)
  if (index === -1) {
    throw new Error('Client not found.')
  }

  const current = clients[index]
  const parts = resolveNameParts({
    firstName: patch.firstName ?? current.firstName,
    lastName: patch.lastName ?? current.lastName,
    name: patch.name,
  })

  if (!parts.firstName) {
    throw new Error('First name is required.')
  }

  const email =
    patch.email != null ? collapseWhitespace(patch.email) : current.email
  if (email && !isValidEmail(email)) {
    throw new Error('Please enter a valid email address.')
  }

  const updated = normalizeClient({
    ...current,
    ...patch,
    firstName: parts.firstName,
    lastName: parts.lastName,
    email,
    phone: patch.phone != null ? patch.phone : current.phone,
    notes: patch.notes != null ? patch.notes : current.notes,
    smsConsent: patch.smsConsent != null ? patch.smsConsent : current.smsConsent,
    id,
    createdAt: current.createdAt,
    updatedAt: nowIso(),
  })

  clients[index] = updated
  await persist(clients)
  await syncClientDisplayName(updated.id, updated.displayName)
  return updated
}

export async function deleteClient(id) {
  const client = getClientById(id)
  if (!client) {
    throw new Error('Client not found.')
  }

  const related = countAppointmentsForClient(id)
  if (related > 0) {
    const err = new Error(
      'This client has appointments associated with their record.',
    )
    err.code = 'has_appointments'
    err.count = related
    throw err
  }

  await persist(getClients().filter((c) => c.id !== id))
  return true
}

/**
 * Development helper (local mode): clear and re-seed clients.
 * Browser console: resetClients()
 */
export async function resetClients() {
  const storage = getStorageProvider()
  if (storage.name !== 'local') {
    console.warn('resetClients() only seeds in local storage mode.')
    return getClients()
  }
  resetClientsCache()
  const seeded = SEED_CLIENTS.map((seed) =>
    normalizeClient({
      ...seed,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }),
  )
  hydrateClients({ clients: seeded })
  await storage.writeJson(
    STORAGE_KEYS.CLIENTS,
    wrapEnvelope(STORAGE_KEYS.CLIENTS, seeded),
  )
  notify()
  return seeded
}

if (typeof window !== 'undefined') {
  window.resetClients = resetClients
}
