/**
 * Subtle save / refresh status for the shell UI.
 * Not a toast framework — soft status chip only.
 */

const listeners = new Set()

let state = {
  status: 'idle', // idle | saving | saved | error | refreshing
  message: null,
}

function emit() {
  listeners.forEach((listener) => listener(state))
}

export function subscribePersistence(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getPersistenceState() {
  return state
}

export function setPersistenceState(next) {
  state = { ...state, ...next }
  emit()
}

let savedTimer = null

export function beginSaving(message = 'Saving...') {
  if (savedTimer) {
    clearTimeout(savedTimer)
    savedTimer = null
  }
  setPersistenceState({ status: 'saving', message })
}

export function markSaved(message = 'Saved') {
  setPersistenceState({ status: 'saved', message })
  if (savedTimer) clearTimeout(savedTimer)
  savedTimer = setTimeout(() => {
    setPersistenceState({ status: 'idle', message: null })
    savedTimer = null
  }, 1600)
}

export function markSaveError(message = "Couldn't save your changes. Please try again.") {
  if (savedTimer) {
    clearTimeout(savedTimer)
    savedTimer = null
  }
  setPersistenceState({ status: 'error', message })
}

export function beginRefreshing() {
  setPersistenceState({ status: 'refreshing', message: 'Refreshing...' })
}

export function clearPersistenceStatus() {
  if (savedTimer) {
    clearTimeout(savedTimer)
    savedTimer = null
  }
  setPersistenceState({ status: 'idle', message: null })
}

export function isPersistenceError(error) {
  return (
    error?.code === 'storage_error' ||
    error?.name === 'TypeError' ||
    typeof error?.status === 'number' ||
    /failed to fetch|network|storage/i.test(String(error?.message || ''))
  )
}

export function toUserSaveError() {
  return new Error("Couldn't save your changes. Please try again.")
}
