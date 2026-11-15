/**
 * Schedule / settings repository.
 * UI uses getScheduleSettings() via data/schedule.js re-export.
 */

import {
  DEFAULT_SCHEDULE,
  DEFAULT_WEEKLY_HOURS,
  matchesLegacyIncorrectWeeklyHours,
} from '../data/scheduleDefaults.js'
import { normalizeCustomerCutoff } from '../appointments/customerManage.js'
import { getStorageProvider } from '../storage/createStorageProvider.js'
import { STORAGE_KEYS, DATA_VERSION, nowIso, wrapEnvelope } from '../storage/keys.js'
import {
  beginSaving,
  markSaved,
  markSaveError,
  isPersistenceError,
  toUserSaveError,
} from './persistenceStatus.js'
import {
  DEFAULT_REMINDER_SETTINGS,
  normalizeReminderSettings,
  reminderSettingsAreValid,
} from '../reminders/reminderSettings.js'
import {
  applyContactEmailMigration,
  normalizeContactEmail,
  normalizeContactPhone,
} from '../reminders/salonBranding.js'

const listeners = new Set()
let cache = null
let hydrated = false

function notify() {
  listeners.forEach((listener) => listener())
}

export function subscribeSettings(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function cloneDefaults() {
  return structuredClone(DEFAULT_SCHEDULE)
}

export function normalizeSettingsEnvelope(envelope) {
  const base = cloneDefaults()
  if (!envelope || typeof envelope !== 'object') {
    return {
      version: DATA_VERSION,
      updatedAt: nowIso(),
      schedule: base,
      blackoutDates: [],
      reminders: { ...DEFAULT_REMINDER_SETTINGS },
    }
  }

  const incomingWeekly =
    envelope.schedule && typeof envelope.schedule === 'object'
      ? envelope.schedule.weeklyHours
      : null

  let weeklyHours = {
    ...base.weeklyHours,
    ...(incomingWeekly || {}),
  }

  // Safely correct the known incorrect seed without clobbering custom schedules.
  let migratedLegacyHours = false
  if (matchesLegacyIncorrectWeeklyHours(weeklyHours)) {
    weeklyHours = structuredClone(DEFAULT_WEEKLY_HOURS)
    migratedLegacyHours = true
  }

  const incomingSchedule =
    envelope.schedule && typeof envelope.schedule === 'object'
      ? envelope.schedule
      : {}

  let schedule = {
    ...base,
    ...incomingSchedule,
    weeklyHours,
    contactEmail: normalizeContactEmail(
      incomingSchedule.contactEmail ?? base.contactEmail,
    ),
    contactPhone: normalizeContactPhone(
      incomingSchedule.contactPhone ?? base.contactPhone,
    ),
    stylistName: String(
      incomingSchedule.stylistName ||
        incomingSchedule.stylistFirstName ||
        base.stylistName ||
        '',
    ).trim(),
    salonName: String(incomingSchedule.salonName ?? base.salonName ?? '').trim(),
    customerChangeCutoff: normalizeCustomerCutoff(incomingSchedule.customerChangeCutoff),
  }

  if (migratedLegacyHours) {
    schedule.calendarDisplayStart = schedule.calendarDisplayStart || '08:00'
    schedule.calendarDisplayEnd = schedule.calendarDisplayEnd || '18:00'
  }

  const contactMigration = applyContactEmailMigration(schedule)
  schedule = contactMigration.schedule
  const migratedContactEmail = contactMigration.migrated

  const blackoutDates = Array.isArray(envelope.blackoutDates)
    ? envelope.blackoutDates
    : Array.isArray(schedule.blackoutDates)
      ? schedule.blackoutDates
      : []

  schedule.blackoutDates = blackoutDates

  const reminders = normalizeReminderSettings(
    envelope.reminders || schedule.reminders || DEFAULT_REMINDER_SETTINGS,
  )

  return {
    version: Number(envelope.version) || DATA_VERSION,
    updatedAt: envelope.updatedAt || nowIso(),
    schedule,
    blackoutDates,
    reminders,
    _migratedLegacyHours: migratedLegacyHours,
    _migratedContactEmail: migratedContactEmail,
  }
}

export function hydrateSettings(envelope) {
  cache = normalizeSettingsEnvelope(envelope)
  hydrated = true
  notify()
  if (cache?._migratedLegacyHours || cache?._migratedContactEmail) {
    // Persist one-time migrations; do not block UI hydration.
    const {
      _migratedLegacyHours,
      _migratedContactEmail,
      ...toSave
    } = cache
    persistSettings(toSave, { quiet: true }).catch((error) => {
      console.warn('[settingsRepository] settings migration persist failed', error)
    })
    cache = { ...toSave }
  }
  return cache
}

export function isSettingsHydrated() {
  return hydrated
}

export function getSettingsEnvelope() {
  if (!cache) {
    cache = normalizeSettingsEnvelope(null)
  }
  return cache
}

/** Live schedule object used by calendar/conflict helpers. */
export function getScheduleSettings() {
  return structuredClone(getSettingsEnvelope().schedule)
}

async function persistSettings(envelope, { quiet = false } = {}) {
  const storage = getStorageProvider()
  if (!quiet) beginSaving()
  try {
    const payload = wrapEnvelope(STORAGE_KEYS.SETTINGS, {
      schedule: envelope.schedule,
      blackoutDates: envelope.blackoutDates,
      reminders: normalizeReminderSettings(
        envelope.reminders || DEFAULT_REMINDER_SETTINGS,
      ),
    })
    payload.version = envelope.version || DATA_VERSION
    await storage.writeJson(STORAGE_KEYS.SETTINGS, payload)
    cache = normalizeSettingsEnvelope(payload)
    if (!quiet) markSaved()
    notify()
    return cache
  } catch (error) {
    console.error('[settingsRepository] persist failed', error)
    if (!quiet) markSaveError()
    if (isPersistenceError(error)) throw toUserSaveError()
    throw error
  }
}

/**
 * Ensure remote empty settings get a one-time default write.
 * Does not overwrite existing remote settings.
 */
export async function ensureSettingsInitialized(existingEnvelope) {
  if (existingEnvelope) {
    return hydrateSettings(existingEnvelope)
  }

  const defaults = normalizeSettingsEnvelope({
    schedule: {
      salonName: 'Lumen & Co.',
      stylistName: 'Mara',
      contactEmail: 'studio@example.com',
      contactPhone: '555-014-2200',
    },
  })
  hydrateSettings(defaults)
  await persistSettings(defaults, { quiet: true })
  return cache
}

export async function updateScheduleSettings(patch = {}) {
  const current = getSettingsEnvelope()
  const next = normalizeSettingsEnvelope({
    ...current,
    schedule: {
      ...current.schedule,
      ...patch,
      weeklyHours: {
        ...current.schedule.weeklyHours,
        ...(patch.weeklyHours || {}),
      },
    },
    blackoutDates: patch.blackoutDates ?? current.blackoutDates,
    reminders: current.reminders,
  })
  return persistSettings(next)
}

export function getReminderSettings() {
  return normalizeReminderSettings(getSettingsEnvelope().reminders)
}

export async function updateReminderSettings(patch = {}) {
  const current = getSettingsEnvelope()
  const nextReminders = normalizeReminderSettings({
    ...current.reminders,
    ...patch,
  })
  if (!reminderSettingsAreValid(nextReminders)) {
    throw new Error('Choose at least one reminder day when reminders are on.')
  }
  const next = normalizeSettingsEnvelope({
    ...current,
    reminders: nextReminders,
  })
  return persistSettings(next)
}

export function resetSettingsCache() {
  cache = null
  hydrated = false
}
