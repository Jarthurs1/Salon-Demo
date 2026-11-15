/**
 * URLs that must never be cached by the service worker
 * (appointments, clients, auth, billing, salon data).
 */
export function isSensitiveApiRequest(url) {
  const parsed = typeof url === 'string' ? new URL(url) : url
  const host = parsed.hostname
  const path = parsed.pathname
  return (
    host.includes('execute-api') ||
    host.includes('amazonaws.com') ||
    path.startsWith('/auth') ||
    path.includes('/appointments') ||
    path.includes('/clients') ||
    path.includes('/settings') ||
    path.includes('/billing') ||
    path.includes('/data')
  )
}
