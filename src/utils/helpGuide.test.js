import { describe, expect, it } from 'vitest'
import {
  HELP_SEEN_STORAGE_KEY,
  PWA_INSTALL_GUIDE,
  hasSeenHelpGuide,
  markHelpGuideSeen,
} from './helpGuide.js'

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value))
    },
  }
}

describe('helpGuide preference', () => {
  it('defaults to unseen', () => {
    expect(hasSeenHelpGuide(memoryStorage())).toBe(false)
  })

  it('marks the guide as seen with the versioned key', () => {
    const storage = memoryStorage()
    markHelpGuideSeen(storage)
    expect(storage.getItem(HELP_SEEN_STORAGE_KEY)).toBe('1')
    expect(hasSeenHelpGuide(storage)).toBe(true)
  })

  it('survives refresh via stored preference', () => {
    const storage = memoryStorage({ [HELP_SEEN_STORAGE_KEY]: '1' })
    expect(hasSeenHelpGuide(storage)).toBe(true)
  })

  it('documents iPhone Home Screen install steps', () => {
    expect(PWA_INSTALL_GUIDE.title).toBe('Install on iPhone')
    expect(PWA_INSTALL_GUIDE.steps).toEqual([
      'Open Simple Salon in Safari.',
      'Tap Share.',
      'Select Add to Home Screen (or Open as Web App where applicable).',
      'Tap Add.',
    ])
    expect(PWA_INSTALL_GUIDE.body).toContain('Simple Salon')
  })
})
