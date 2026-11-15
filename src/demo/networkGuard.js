const BLOCKED = /execute-api|amazonaws|stripe\.com|api\.stripe/i

export function assertDemoRequestAllowed(url) {
  const value = String(url?.url || url || '')
  if (BLOCKED.test(value)) {
    throw new Error('Salon Demo does not contact live services.')
  }
}

export function installNetworkGuard(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') return
  globalThis.fetch = (input, init) => {
    assertDemoRequestAllowed(input)
    return fetchImpl(input, init)
  }
}
