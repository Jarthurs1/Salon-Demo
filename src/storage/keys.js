/**
 * Logical storage object keys (not full S3 paths).
 * S3 paths: data/{key}.json under the configured bucket prefix.
 */
export const STORAGE_KEYS = {
  CLIENTS: 'clients',
  APPOINTMENTS: 'appointments',
  SETTINGS: 'settings',
}

export const DATA_VERSION = 1

export function nowIso() {
  return new Date().toISOString()
}

export function wrapEnvelope(collectionKey, itemsOrSettings) {
  if (collectionKey === STORAGE_KEYS.SETTINGS) {
    return {
      version: DATA_VERSION,
      updatedAt: nowIso(),
      schedule: itemsOrSettings.schedule,
      blackoutDates: itemsOrSettings.blackoutDates ?? [],
      reminders: itemsOrSettings.reminders ?? undefined,
    }
  }

  return {
    version: DATA_VERSION,
    updatedAt: nowIso(),
    [collectionKey]: itemsOrSettings,
  }
}
