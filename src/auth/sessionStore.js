const TOKEN_KEY = 'salon_session_token_v1'

function defaultStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Ignore.
  }
  return null
}

export function getSessionToken(storage = defaultStorage()) {
  try {
    return storage?.getItem?.(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setSessionToken(token, storage = defaultStorage()) {
  try {
    if (!storage) return
    if (!token) storage.removeItem(TOKEN_KEY)
    else storage.setItem(TOKEN_KEY, token)
  } catch {
    // Ignore storage failures (private mode).
  }
}

export function clearSessionToken(storage = defaultStorage()) {
  setSessionToken('', storage)
}
