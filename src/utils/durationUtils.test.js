import { describe, it, expect } from 'vitest'
import {
  combineDurationParts,
  formatDurationPickerLabel,
  splitDurationMinutes,
} from './durationUtils.js'

describe('durationUtils', () => {
  it('rejects zero and clamps to 12 hours', () => {
    expect(combineDurationParts(0, 0)).toBe(15)
    expect(combineDurationParts(12, 30)).toBe(12 * 60)
    expect(splitDurationMinutes(0)).toEqual({ hours: 0, minutes: 30 })
    expect(splitDurationMinutes(12 * 60 + 45)).toEqual({ hours: 12, minutes: 0 })
  })

  it('formats closed-field labels', () => {
    expect(formatDurationPickerLabel(30)).toBe('30 min')
    expect(formatDurationPickerLabel(60)).toBe('1 hr')
    expect(formatDurationPickerLabel(75)).toBe('1 hr 15 min')
    expect(formatDurationPickerLabel(240)).toBe('4 hr')
    expect(formatDurationPickerLabel(510)).toBe('8 hr 30 min')
  })
})
