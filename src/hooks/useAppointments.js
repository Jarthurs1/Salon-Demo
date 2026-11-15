import { useSyncExternalStore } from 'react'
import {
  getAppointments,
  subscribe,
} from '../services/appointmentRepository.js'

function getSnapshot() {
  return getAppointments()
}

/**
 * Reactive appointment list backed by the repository.
 * Re-renders when create/update/delete/reset runs.
 */
export function useAppointments() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useAppointmentsForDate(dateKey) {
  const all = useAppointments()
  return all.filter((appt) => appt.date === dateKey)
}
