import { describe, it, expect } from 'vitest'
import {
  buildDayTimeline,
  getDayStatusIndicator,
  summarizeDay,
} from './timelineUtils.js'
import { scheduleSettings } from '../data/schedule.js'

describe('buildDayTimeline', () => {
  const thursday = new Date(2026, 8, 24)

  it('inserts available gaps between appointments', () => {
    const appointments = [
      {
        id: '1',
        startTime: '09:00',
        durationMinutes: 60,
        type: 'appointment',
        status: 'confirmed',
        clientName: 'Sarah',
        service: 'Haircut',
      },
      {
        id: '2',
        startTime: '11:30',
        durationMinutes: 90,
        type: 'appointment',
        status: 'pending',
        clientName: 'Emily',
        service: 'Color',
      },
    ]

    const timeline = buildDayTimeline(appointments, thursday, scheduleSettings)
    expect(timeline[0].type).toBe('available')
    expect(timeline[0].startTime).toBe('08:00')
    expect(timeline[0].endTime).toBe('09:00')
    expect(timeline[1].type).toBe('appointment')
    expect(timeline[2].type).toBe('available')
    expect(timeline[2].startTime).toBe('10:00')
    expect(timeline[2].endTime).toBe('11:30')
    expect(timeline[3].type).toBe('appointment')
    expect(timeline[4].type).toBe('available')
  })

  it('returns empty available slots on closed days with no appointments', () => {
    const saturday = new Date(2026, 8, 26)
    expect(buildDayTimeline([], saturday, scheduleSettings)).toEqual([])
  })

  it('still lists appointments on closed days', () => {
    const saturday = new Date(2026, 8, 26)
    const timeline = buildDayTimeline(
      [
        {
          id: 'wedding',
          startTime: '10:00',
          durationMinutes: 240,
          type: 'appointment',
          status: 'pending',
          clientName: 'Bride',
          service: 'Bridal / Wedding',
        },
      ],
      saturday,
      scheduleSettings,
    )
    expect(timeline).toHaveLength(1)
    expect(timeline[0].type).toBe('appointment')
    expect(timeline.every((item) => item.type !== 'available')).toBe(true)
  })
})

describe('getDayStatusIndicator', () => {
  it('prioritizes pending over confirmed', () => {
    expect(
      getDayStatusIndicator([
        { type: 'appointment', status: 'confirmed' },
        { type: 'appointment', status: 'pending' },
      ]),
    ).toBe('pending')
  })

  it('prioritizes reschedule_requested over pending and confirmed', () => {
    expect(
      getDayStatusIndicator([
        { type: 'appointment', status: 'confirmed' },
        { type: 'appointment', status: 'pending' },
        { type: 'appointment', status: 'reschedule_requested' },
      ]),
    ).toBe('reschedule_requested')
  })

  it('returns confirmed when all client appts confirmed', () => {
    expect(
      getDayStatusIndicator([
        { type: 'appointment', status: 'confirmed' },
        { type: 'blocked', status: 'blocked' },
      ]),
    ).toBe('confirmed')
  })

  it('returns blocked when only blocks', () => {
    expect(
      getDayStatusIndicator([{ type: 'blocked', status: 'blocked' }]),
    ).toBe('blocked')
  })

  it('returns null when empty', () => {
    expect(getDayStatusIndicator([])).toBe(null)
  })

  it('ignores released canceled appointments on the active schedule', () => {
    expect(
      getDayStatusIndicator([
        {
          type: 'appointment',
          status: 'canceled',
          slotReleasedAt: '2026-11-08T12:00:00.000Z',
        },
        { type: 'appointment', status: 'confirmed' },
      ]),
    ).toBe('confirmed')
  })
})

describe('summarizeDay', () => {
  it('counts client appointments and pending', () => {
    const summary = summarizeDay([
      { type: 'appointment', status: 'confirmed' },
      { type: 'appointment', status: 'pending' },
      { type: 'blocked', status: 'blocked' },
    ])
    expect(summary.total).toBe(2)
    expect(summary.pending).toBe(1)
    expect(summary.blocked).toBe(1)
  })

  it('keeps held canceled appointments in the active day total', () => {
    const summary = summarizeDay([
      { type: 'appointment', status: 'confirmed' },
      { type: 'appointment', status: 'canceled', slotReleasedAt: null },
    ])
    expect(summary.total).toBe(2)
  })

  it('excludes released canceled appointments from the active day total', () => {
    const summary = summarizeDay([
      { type: 'appointment', status: 'confirmed' },
      {
        type: 'appointment',
        status: 'canceled',
        slotReleasedAt: '2026-11-08T12:00:00.000Z',
      },
    ])
    expect(summary.total).toBe(1)
  })
})
