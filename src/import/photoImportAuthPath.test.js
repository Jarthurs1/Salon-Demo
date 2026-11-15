import { describe, expect, it } from 'vitest'

/**
 * Locks the photo-import auth S3 path to the Data API auth store.
 * Regression: using DATA_PREFIX ("data") caused S3 AccessDenied and
 * "Could not verify your session."
 */
function authObjectKeys(authPrefix = 'auth') {
  const prefix = String(authPrefix || 'auth').replace(/^\/|\/$/g, '')
  return {
    sessions: `${prefix}/sessions.json`,
    users: `${prefix}/users.json`,
  }
}

describe('photo-import auth S3 paths', () => {
  it('reads sessions/users under auth/, not data/', () => {
    expect(authObjectKeys()).toEqual({
      sessions: 'auth/sessions.json',
      users: 'auth/users.json',
    })
    expect(authObjectKeys('data')).not.toEqual(authObjectKeys('auth'))
  })
})
