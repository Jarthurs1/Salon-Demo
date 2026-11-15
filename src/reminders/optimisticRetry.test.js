import { describe, it, expect, vi } from 'vitest'
import { withOptimisticRetry } from './optimisticRetry.js'

describe('optimistic concurrency retry', () => {
  it('retries on conflict then succeeds without losing intended change', async () => {
    let version = 1
    let store = { appointments: [{ id: 'a', notes: 'old', status: 'pending' }] }

    const result = await withOptimisticRetry({
      maxAttempts: 3,
      async load() {
        return { version, data: structuredClone(store) }
      },
      async apply(loaded) {
        const appointments = loaded.data.appointments.map((appt) =>
          appt.id === 'a' ? { ...appt, status: 'confirmed' } : appt,
        )
        return { ...loaded, data: { appointments } }
      },
      async save(next, loaded) {
        if (loaded.version !== version) {
          const err = new Error('conflict')
          err.code = 'conflict'
          throw err
        }
        // simulate Rozie edit landing between first load and first save
        if (version === 1) {
          version = 2
          store = {
            appointments: [{ id: 'a', notes: 'rozie edit', status: 'pending' }],
          }
          const err = new Error('conflict')
          err.code = 'conflict'
          throw err
        }
        store = next.data
        version += 1
      },
    })

    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(2)
    expect(store.appointments[0].status).toBe('confirmed')
    expect(store.appointments[0].notes).toBe('rozie edit')
  })
})
