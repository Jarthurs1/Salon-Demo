import { describe, it, expect } from 'vitest'
import { snapToQuarterHour } from './TimePicker.jsx'
import { minutesToTime } from '../utils/dateUtils.js'

describe('snapToQuarterHour', () => {
  it('snaps to the nearest 15-minute increment', () => {
    expect(minutesToTime(snapToQuarterHour(8 * 60 + 7))).toBe('08:00')
    expect(minutesToTime(snapToQuarterHour(8 * 60 + 8))).toBe('08:15')
    expect(minutesToTime(snapToQuarterHour(10 * 60))).toBe('10:00')
    expect(minutesToTime(snapToQuarterHour(22 * 60 + 40))).toBe('22:45')
  })

  it('does not allow a start at or past midnight for a same-day slot', () => {
    expect(minutesToTime(snapToQuarterHour(23 * 60 + 59))).toBe('23:45')
  })
})
