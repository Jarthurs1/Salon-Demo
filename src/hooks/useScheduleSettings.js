import { useSyncExternalStore } from 'react'
import {
  getSettingsEnvelope,
  subscribeSettings,
} from '../services/settingsRepository.js'

function getSnapshot() {
  return getSettingsEnvelope()
}

/** Live salon schedule, including the S3 booking horizon. */
export function useScheduleSettings() {
  const envelope = useSyncExternalStore(
    subscribeSettings,
    getSnapshot,
    getSnapshot,
  )
  return envelope.schedule
}
