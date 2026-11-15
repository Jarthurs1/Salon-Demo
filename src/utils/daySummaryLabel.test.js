import { describe, expect, it } from 'vitest'
import { parseDateKey } from './dateUtils.js'
import { getDaySummaryPrefix } from './daySummaryLabel.js'

describe('getDaySummaryPrefix', () => {
  const timezone = 'America/New_York'

  it('returns Today only for salon-timezone today', () => {
    // 2026-11-08 10:00 America/New_York
    const now = new Date('2026-11-08T15:00:00.000Z')
    expect(
      getDaySummaryPrefix(parseDateKey('2026-11-08'), { now, timezone }),
    ).toBe('Today')
    expect(
      getDaySummaryPrefix(parseDateKey('2026-11-09'), { now, timezone }),
    ).toBe('Tomorrow')
    expect(
      getDaySummaryPrefix(parseDateKey('2026-11-10'), { now, timezone }),
    ).toBeNull()
  })

  it('does not call a late Pacific evening “today” when salon is already next day', () => {
    // 2026-11-08 23:30 PT = 2026-11-09 02:30 ET
    const now = new Date('2026-11-09T07:30:00.000Z')
    expect(
      getDaySummaryPrefix(parseDateKey('2026-11-08'), { now, timezone }),
    ).toBeNull()
    expect(
      getDaySummaryPrefix(parseDateKey('2026-11-09'), { now, timezone }),
    ).toBe('Today')
  })
})
