/**
 * localStorage-backed JSON storage provider.
 * Supports legacy Phase 1–4 keys and migrates them into envelope format in place.
 */

import { STORAGE_KEYS, DATA_VERSION, nowIso, wrapEnvelope } from './keys.js'
import { DEFAULT_SCHEDULE } from '../data/scheduleDefaults.js'

const PREFIX = 'salon-demo.data.'

const LEGACY = {
  [STORAGE_KEYS.APPOINTMENTS]: {
    data: 'rosies-salon.appointments.v1',
    seeded: 'rosies-salon.appointments.seeded.v1',
  },
  [STORAGE_KEYS.CLIENTS]: {
    data: 'rosies-salon.clients.v1',
    seeded: 'rosies-salon.clients.seeded.v1',
  },
}

function envelopeKey(key) {
  return `${PREFIX}${key}`
}

function safeParse(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function migrateLegacy(key) {
  const legacy = LEGACY[key]
  if (!legacy) return null

  const raw = localStorage.getItem(legacy.data)
  if (!raw) return null

  const parsed = safeParse(raw)
  if (!Array.isArray(parsed)) return null

  const envelope = wrapEnvelope(key, parsed)
  localStorage.setItem(envelopeKey(key), JSON.stringify(envelope))
  return envelope
}

function defaultSettingsEnvelope() {
  return {
    version: DATA_VERSION,
    updatedAt: nowIso(),
    schedule: structuredClone(DEFAULT_SCHEDULE),
    blackoutDates: [],
  }
}

export function createLocalStorageProvider() {
  return {
    name: 'local',

    async readJson(key) {
      const raw = localStorage.getItem(envelopeKey(key))
      if (raw) {
        const parsed = safeParse(raw)
        if (parsed && typeof parsed === 'object') return parsed
      }

      if (key === STORAGE_KEYS.SETTINGS) {
        const envelope = defaultSettingsEnvelope()
        localStorage.setItem(envelopeKey(key), JSON.stringify(envelope))
        return envelope
      }

      const migrated = migrateLegacy(key)
      if (migrated) return migrated

      return null
    },

    async writeJson(key, data) {
      localStorage.setItem(envelopeKey(key), JSON.stringify(data))
      return data
    },

    async exists(key) {
      return localStorage.getItem(envelopeKey(key)) != null
    },
  }
}
