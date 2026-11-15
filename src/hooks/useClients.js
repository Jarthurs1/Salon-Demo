import { useSyncExternalStore } from 'react'
import { getClients, subscribe } from '../services/clientRepository.js'

function getSnapshot() {
  return getClients()
}

export function useClients() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
