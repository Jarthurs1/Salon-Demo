import { describe, it, expect } from 'vitest'
import {
  normalizeForMatch,
  normalizeEmail,
  isValidEmail,
  splitFullName,
  getClientInitials,
  getClientDisplayName,
  formatPhoneDisplay,
  digitsOnly,
  phoneDigitsForSearch,
  clientMatchesSearchQuery,
  getClientSecondaryContact,
  getDialableE164,
  buildSmsUrl,
  buildTelUrl,
} from './clientUtils.js'
import { matchClient } from './clientMatcher.js'
import { normalizeClient } from '../services/clientRepository.js'

const CLIENTS = [
  normalizeClient({
    id: 'client-001',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john@email.com',
  }),
  normalizeClient({
    id: 'client-002',
    firstName: 'Sarah',
    lastName: 'Reynolds',
    email: 'sarah@email.com',
  }),
  normalizeClient({
    id: 'client-008',
    firstName: 'John',
    lastName: 'Williams',
    email: 'johnw@email.com',
  }),
]

describe('clientUtils', () => {
  it('normalizes names and emails for matching', () => {
    expect(normalizeForMatch('  JOHN   SMITH ')).toBe('john smith')
    expect(normalizeEmail('John@Example.com')).toBe('john@example.com')
  })

  it('validates emails', () => {
    expect(isValidEmail('john@example.com')).toBe(true)
    expect(isValidEmail('john@')).toBe(false)
    expect(isValidEmail('john')).toBe(false)
    expect(isValidEmail('@example.com')).toBe(false)
  })

  it('splits and formats names', () => {
    expect(splitFullName('Jennifer Adams')).toEqual({
      firstName: 'Jennifer',
      lastName: 'Adams',
    })
    expect(getClientInitials(CLIENTS[0])).toBe('JS')
    expect(getClientDisplayName(CLIENTS[0])).toBe('John Smith')
  })

  it('formats US phone numbers', () => {
    expect(formatPhoneDisplay('4045551234')).toBe('(404) 555-1234')
    expect(digitsOnly('(404) 555-1234')).toBe('4045551234')
    expect(phoneDigitsForSearch('+1 (404) 555-1234')).toBe('4045551234')
  })

  it('builds sms: and tel: links only for dialable numbers', () => {
    expect(getDialableE164('(404) 555-1234')).toBe('+14045551234')
    expect(buildSmsUrl('4045551234')).toBe('sms:+14045551234')
    expect(buildTelUrl('1-404-555-1234')).toBe('tel:+14045551234')
    expect(buildSmsUrl('')).toBe(null)
    expect(buildTelUrl('123')).toBe(null)
    expect(buildSmsUrl('not-a-phone')).toBe(null)
    expect(buildSmsUrl('4045551234', { body: 'Hello there' })).toBe(
      `sms:+14045551234&body=${encodeURIComponent('Hello there')}`,
    )
  })

  it('matches clients by name, email, and formatted/unformatted phone', () => {
    const client = normalizeClient({
      id: 'c-phone',
      firstName: 'Ava',
      lastName: 'Nguyen',
      email: 'ava@salon.test',
      phone: '(404) 555-1234',
    })
    expect(clientMatchesSearchQuery(client, 'ava')).toBe(true)
    expect(clientMatchesSearchQuery(client, 'NGUYEN')).toBe(true)
    expect(clientMatchesSearchQuery(client, 'ava@salon')).toBe(true)
    expect(clientMatchesSearchQuery(client, '4045551234')).toBe(true)
    expect(clientMatchesSearchQuery(client, '404-555')).toBe(true)
    expect(clientMatchesSearchQuery(client, '555999')).toBe(false)
  })

  it('prefers phone, then email, for secondary contact display', () => {
    expect(
      getClientSecondaryContact({
        phone: '4045551234',
        email: 'a@b.com',
      }),
    ).toEqual({ type: 'phone', text: '(404) 555-1234' })
    expect(getClientSecondaryContact({ email: 'a@b.com' })).toEqual({
      type: 'email',
      text: 'a@b.com',
    })
    expect(getClientSecondaryContact({})).toEqual({
      type: 'none',
      text: 'No contact information',
    })
  })

  it('migrates legacy name-only records', () => {
    const migrated = normalizeClient({
      id: 'client-legacy',
      name: 'Emily Chen',
      email: 'emily@email.com',
    })
    expect(migrated.firstName).toBe('Emily')
    expect(migrated.lastName).toBe('Chen')
    expect(migrated.displayName).toBe('Emily Chen')
    expect(migrated.id).toBe('client-legacy')
  })
})

describe('matchClient with Phase 4 model', () => {
  it('matches full name', () => {
    const result = matchClient('John Smith', CLIENTS)
    expect(result.status).toBe('matched')
    expect(result.client.id).toBe('client-001')
  })

  it('returns ambiguous for multiple Johns', () => {
    const result = matchClient('John', CLIENTS)
    expect(result.status).toBe('ambiguous')
    expect(result.matches.length).toBe(2)
  })

  it('matches unique first name', () => {
    const result = matchClient(
      'Sarah',
      CLIENTS.filter((c) => c.id !== 'client-008'),
    )
    expect(result.status).toBe('matched')
    expect(result.client.displayName).toBe('Sarah Reynolds')
  })
})
