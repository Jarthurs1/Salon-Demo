import { describe, expect, it } from 'vitest'
import { isSensitiveApiRequest } from './sensitiveApiCache.js'

describe('PWA sensitive API cache policy', () => {
  it('treats Amplify Data API and auth routes as uncacheable', () => {
    expect(
      isSensitiveApiRequest(
        'https://7hue8i7nx6.execute-api.us-east-1.amazonaws.com/auth/me',
      ),
    ).toBe(true)
    expect(
      isSensitiveApiRequest(
        'https://example.execute-api.us-east-1.amazonaws.com/data/appointments',
      ),
    ).toBe(true)
    expect(
      isSensitiveApiRequest('https://main.dwa96jjx887l8.amplifyapp.com/'),
    ).toBe(false)
    expect(
      isSensitiveApiRequest(
        'https://main.dwa96jjx887l8.amplifyapp.com/assets/app.js',
      ),
    ).toBe(false)
  })
})
