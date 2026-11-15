/**
 * Central bootstrap / refresh for clients, appointments, and settings.
 * UI renders only after hydrate (or shows error + retry).
 */

import { getStorageProvider, getStorageMode } from '../storage/createStorageProvider.js'
import { STORAGE_KEYS, wrapEnvelope, DATA_VERSION, nowIso } from '../storage/keys.js'
import {
  hydrateAppointments,
  resetAppointmentsCache,
  ensureAppointmentsInitialized,
} from './appointmentRepository.js'
import {
  hydrateClients,
  resetClientsCache,
  ensureClientsInitialized,
} from './clientRepository.js'
import {
  ensureSettingsInitialized,
  resetSettingsCache,
} from './settingsRepository.js'
import {
  beginRefreshing,
  markSaved,
  markSaveError,
  clearPersistenceStatus,
} from './persistenceStatus.js'

const bootstrapListeners = new Set()

let bootstrapState = {
  status: 'idle', // idle | loading | ready | error
  error: null,
  code: null,
  mode: getStorageMode(),
}

export function subscribeBootstrap(listener) {
  bootstrapListeners.add(listener)
  return () => bootstrapListeners.delete(listener)
}

export function getBootstrapState() {
  return bootstrapState
}

function setBootstrap(next) {
  bootstrapState = { ...bootstrapState, ...next }
  bootstrapListeners.forEach((listener) => listener(bootstrapState))
}

async function loadAll() {
  const storage = getStorageProvider()

  const [clientsEnvelope, appointmentsEnvelope, settingsEnvelope] =
    await Promise.all([
      storage.readJson(STORAGE_KEYS.CLIENTS),
      storage.readJson(STORAGE_KEYS.APPOINTMENTS),
      storage.readJson(STORAGE_KEYS.SETTINGS),
    ])

  await ensureClientsInitialized(clientsEnvelope)
  await ensureAppointmentsInitialized(appointmentsEnvelope)
  await ensureSettingsInitialized(settingsEnvelope)
}

export async function bootstrapAppData() {
  setBootstrap({
    status: 'loading',
    error: null,
    code: null,
    mode: getStorageMode(),
  })

  try {
    await loadAll()
    setBootstrap({ status: 'ready', error: null, code: null })
    return bootstrapState
  } catch (error) {
    console.error('[bootstrap] failed to load app data', error)
    const unauthorized = error?.status === 401
    const offline =
      typeof navigator !== 'undefined' && navigator.onLine === false
    setBootstrap({
      status: 'error',
      code: unauthorized ? 'unauthorized' : null,
      error: unauthorized
        ? 'Sign in required.'
        : offline
          ? "You're offline. Connect to the internet to load appointments — salon data is never shown from an offline cache."
          : "Couldn't load your schedule. Check your connection and try again.",
    })
    return bootstrapState
  }
}

/** Soft refresh from remote/local storage without full app remount. */
export async function refreshAppData() {
  beginRefreshing()
  try {
    resetAppointmentsCache()
    resetClientsCache()
    resetSettingsCache()
    await loadAll()
    markSaved('Updated')
    setBootstrap({ status: 'ready', error: null })
    return true
  } catch (error) {
    console.error('[refresh] failed', error)
    if (error?.status === 401) {
      setBootstrap({
        status: 'error',
        code: 'unauthorized',
        error: 'Sign in required.',
      })
      return false
    }
    markSaveError("Couldn't refresh. Showing your last loaded data.")
    return false
  }
}

export function resetBootstrapForTests() {
  clearPersistenceStatus()
  resetAppointmentsCache()
  resetClientsCache()
  resetSettingsCache()
  setBootstrap({ status: 'idle', error: null, code: null, mode: getStorageMode() })
}

/** Empty envelopes for AWS first-run (written once by ensure* helpers). */
export function emptyClientsEnvelope() {
  return wrapEnvelope(STORAGE_KEYS.CLIENTS, [])
}

export function emptyAppointmentsEnvelope() {
  return wrapEnvelope(STORAGE_KEYS.APPOINTMENTS, [])
}

export { DATA_VERSION, nowIso }
