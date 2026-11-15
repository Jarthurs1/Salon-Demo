/**
 * Salon Demo keeps every visitor on browser storage.
 * Live API mode is intentionally unavailable.
 */

import { createLocalStorageProvider } from './localStorageProvider.js'

let cachedProvider = null

export function resolveStorageMode() {
  return 'local'
}

export function getStorageMode() {
  return 'local'
}

export function createStorageProvider() {
  return createLocalStorageProvider()
}

export function getStorageProvider() {
  if (!cachedProvider) cachedProvider = createStorageProvider()
  return cachedProvider
}

export function __setStorageProviderForTests(provider) {
  cachedProvider = provider
}

export function __resetStorageProviderForTests() {
  cachedProvider = null
}
