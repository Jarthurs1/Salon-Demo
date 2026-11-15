import { describe, expect, it } from 'vitest'
import { DEFAULT_SCHEDULE } from '../data/scheduleDefaults.js'
import {
  buildAppointmentMessageBody,
  buildCanceledFollowUpMessage,
  buildConfirmedFollowUpMessage,
  buildPendingFollowUpMessage,
  buildRescheduleSuggestionsMessage,
  formatAppointmentWhenPhrase,
} from './appointmentMessages.js'
import {
  findDayAvailabilityWindows,
  findRescheduleSuggestions,
  formatDurationForSms,
  formatWindowRange,
  toValidStartRange,
} from './rescheduleSuggestions.js'

const settings = {
  ...DEFAULT_SCHEDULE,
  stylistName: 'Rozie',
  timezone: 'America/New_York',
  calendarDisplayStart: '09:00',
  calendarDisplayEnd: '17:00',
  weeklyHours: {
    ...DEFAULT_SCHEDULE.weeklyHours,
    monday: { closed: false, start: '09:00', end: '17:00' },
    tuesday: { closed: false, start: '09:00', end: '17:00' },
    wednesday: { closed: false, start: '09:00', end: '17:00' },
    thursday: { closed: false, start: '09:00', end: '17:00' },
    friday: { closed: false, start: '09:00', end: '17:00' },
    saturday: { closed: true },
    sunday: { closed: true },
  },
}

describe('appointmentMessages', () => {
  it('uses today for pending follow-ups on the salon date', () => {
    const phrase = formatAppointmentWhenPhrase(
      { date: '2026-11-09', startTime: '14:00' },
      {
        settings,
        now: new Date('2026-11-09T18:00:00.000Z'), // 1 PM ET
      },
    )
    expect(phrase.dateLabel).toBe('today')
    expect(phrase.timeLabel).toMatch(/2:00\s*PM/i)

    const body = buildPendingFollowUpMessage({
      customerFirstName: 'Jamie',
      stylistFirstName: 'Rozie',
      appointment: { date: '2026-11-09', startTime: '14:00' },
      settings,
      now: new Date('2026-11-09T18:00:00.000Z'),
    })
    expect(body).toContain("Hi Jamie, it's Rozie!")
    expect(body).toContain('on today at')
    expect(body).toContain("haven't heard back")
  })

  it('builds confirmed outreach with the appointment date and time', () => {
    const body = buildConfirmedFollowUpMessage({
      customerFirstName: 'Jamie',
      stylistFirstName: 'Rozie',
      appointment: { date: '2026-11-12', startTime: '10:30' },
      settings,
      now: new Date('2026-11-09T15:00:00.000Z'),
    })
    expect(body).toContain('Just wanted to reach out about your appointment on')
    expect(body).toContain('at')
    expect(body).not.toContain('on today at')
  })

  it('preserves the canceled follow-up wording', () => {
    expect(
      buildCanceledFollowUpMessage({
        customerFirstName: 'Jamie',
        stylistFirstName: 'Rozie',
      }),
    ).toBe(
      "Hi Jamie, it's Rozie! I saw that you canceled your appointment. Just checking if you'd like to find another time.",
    )
  })

  it('groups valid start ranges by day in the SMS body', () => {
    const body = buildRescheduleSuggestionsMessage({
      customerFirstName: 'Jamie',
      stylistFirstName: 'Rozie',
      durationMinutes: 45,
      suggestions: [
        {
          date: '2026-11-10',
          dateLabel: 'Tuesday, November 10',
          windows: [{ label: '8:00–8:45 AM' }, { label: '3:00–4:00 PM' }],
        },
        {
          date: '2026-11-11',
          dateLabel: 'Wednesday, November 11',
          windows: [{ label: '11:00 AM' }],
        },
      ],
    })
    expect(body).toContain("I saw your request to reschedule.")
    expect(body).toContain(
      'Would any start time within the following ranges work for your 45-minute appointment?',
    )
    expect(body).toContain('Tuesday, November 10')
    expect(body).toContain('• 8:00–8:45 AM')
    expect(body).toContain('• 3:00–4:00 PM')
    expect(body).toContain('Wednesday, November 11')
    expect(body).toContain('• 11:00 AM')
    expect(body).toContain('Let me know what works best!')
  })

  it('falls back when no openings exist', () => {
    const body = buildAppointmentMessageBody({
      appointment: {
        id: 'a1',
        status: 'reschedule_requested',
        date: '2026-11-10',
        startTime: '10:00',
        durationMinutes: 60,
        clientName: 'Jamie Lee',
      },
      client: { firstName: 'Jamie' },
      appointments: [],
      settings: {
        ...settings,
        weeklyHours: {
          sunday: { closed: true },
          monday: { closed: true },
          tuesday: { closed: true },
          wednesday: { closed: true },
          thursday: { closed: true },
          friday: { closed: true },
          saturday: { closed: true },
        },
      },
      now: new Date('2026-11-09T15:00:00.000Z'),
    })
    expect(body).toContain('Please let me know what days and times work best')
  })
})

describe('formatDurationForSms', () => {
  it('formats common appointment lengths naturally', () => {
    expect(formatDurationForSms(15)).toBe('15-minute')
    expect(formatDurationForSms(45)).toBe('45-minute')
    expect(formatDurationForSms(60)).toBe('1-hour')
    expect(formatDurationForSms(90)).toBe('1-hour 30-minute')
    expect(formatDurationForSms(120)).toBe('2-hour')
  })
})

describe('toValidStartRange', () => {
  it('calculates earliest/latest starts from free windows and duration', () => {
    expect(
      toValidStartRange({ start: 8 * 60, end: 9 * 60 + 30 }, 45)?.label,
    ).toBe('8:00–8:45 AM')
    expect(
      toValidStartRange({ start: 8 * 60, end: 18 * 60 }, 120)?.label,
    ).toBe('8:00 AM–4:00 PM')
    expect(
      toValidStartRange({ start: 11 * 60, end: 12 * 60 }, 60)?.label,
    ).toBe('11:00 AM')
    expect(toValidStartRange({ start: 9 * 60, end: 9 * 60 + 30 }, 45)).toBeNull()
  })

  it('rounds to 15-minute increments', () => {
    const range = toValidStartRange({ start: 8 * 60 + 7, end: 10 * 60 + 8 }, 45)
    expect(range.earliestStartMinutes).toBe(8 * 60 + 15)
    expect(range.latestStartMinutes).toBe(9 * 60 + 15)
    expect(range.label).toBe('8:15–9:15 AM')
  })
})

describe('formatWindowRange', () => {
  it('compacts same-period ranges and keeps AM/PM when crossing', () => {
    expect(formatWindowRange(8 * 60, 8 * 60 + 45)).toBe('8:00–8:45 AM')
    expect(formatWindowRange(15 * 60, 16 * 60)).toBe('3:00–4:00 PM')
    expect(formatWindowRange(8 * 60, 16 * 60)).toBe('8:00 AM–4:00 PM')
    expect(formatWindowRange(11 * 60, 11 * 60)).toBe('11:00 AM')
  })
})

describe('findRescheduleSuggestions start ranges', () => {
  it('returns valid start ranges across the next two working days', () => {
    const appointments = [
      {
        id: 'morning',
        date: '2026-11-10',
        startTime: '09:00',
        durationMinutes: 120,
        status: 'confirmed',
        type: 'appointment',
      },
      {
        id: 'lunch',
        date: '2026-11-10',
        startTime: '12:00',
        durationMinutes: 60,
        status: 'blocked',
        type: 'blocked',
        service: 'Lunch',
      },
      {
        id: 'self',
        date: '2026-11-09',
        startTime: '14:00',
        durationMinutes: 60,
        status: 'reschedule_requested',
        type: 'appointment',
      },
    ]

    const suggestions = findRescheduleSuggestions({
      durationMinutes: 60,
      appointments,
      now: new Date('2026-11-09T15:00:00.000Z'), // Mon 10 AM ET
      settings,
      workingDayLimit: 2,
      searchDays: 14,
    })

    expect(suggestions).toHaveLength(2)
    expect(suggestions[0].date).toBe('2026-11-09')
    // Free 10:15–2:00 and 3:00–5:00 → start ranges end 60 min before window end.
    expect(suggestions[0].windows.map((w) => w.label)).toEqual([
      '10:15 AM–1:00 PM',
      '3:00–4:00 PM',
    ])
    expect(suggestions[1].date).toBe('2026-11-10')
    expect(suggestions[1].windows.map((w) => w.label)).toEqual([
      '11:00 AM',
      '1:00–4:00 PM',
    ])
  })

  it('handles 15, 45, 90, and 120 minute appointments', () => {
    const openDay = []
    const cases = [
      {
        duration: 15,
        label: '9:00 AM–4:45 PM',
      },
      {
        duration: 45,
        label: '9:00 AM–4:15 PM',
      },
      {
        duration: 90,
        label: '9:00 AM–3:30 PM',
      },
      {
        duration: 120,
        label: '9:00 AM–3:00 PM',
      },
    ]

    for (const { duration, label } of cases) {
      const windows = findDayAvailabilityWindows({
        dateKey: '2026-11-10',
        durationMinutes: duration,
        appointments: openDay,
        now: new Date('2026-11-09T15:00:00.000Z'),
        settings,
      })
      expect(windows.map((w) => w.label)).toEqual([label])
      expect(
        windows[0].latestStartMinutes + duration,
      ).toBeLessThanOrEqual(17 * 60)
    }
  })

  it('skips openings shorter than the appointment duration', () => {
    const appointments = [
      {
        id: 'a',
        date: '2026-11-10',
        startTime: '09:00',
        durationMinutes: 45,
        status: 'confirmed',
        type: 'appointment',
      },
      {
        id: 'b',
        date: '2026-11-10',
        startTime: '10:00',
        durationMinutes: 420,
        status: 'confirmed',
        type: 'appointment',
      },
    ]
    expect(
      findDayAvailabilityWindows({
        dateKey: '2026-11-10',
        durationMinutes: 45,
        appointments,
        now: new Date('2026-11-09T15:00:00.000Z'),
        settings,
      }),
    ).toEqual([])

    expect(
      findDayAvailabilityWindows({
        dateKey: '2026-11-10',
        durationMinutes: 15,
        appointments,
        now: new Date('2026-11-09T15:00:00.000Z'),
        settings,
      }).map((w) => w.label),
    ).toEqual(['9:45 AM'])
  })

  it('supports longer durations and skips closed / fully blocked days', () => {
    const appointments = [
      {
        id: 'full-tue',
        date: '2026-11-10',
        startTime: '09:00',
        durationMinutes: 480,
        status: 'confirmed',
        type: 'appointment',
      },
    ]
    const suggestions = findRescheduleSuggestions({
      durationMinutes: 150,
      appointments,
      now: new Date('2026-11-09T15:00:00.000Z'),
      settings,
      workingDayLimit: 2,
    })
    expect(suggestions.map((d) => d.date)).toEqual([
      '2026-11-09',
      '2026-11-11',
    ])
    expect(
      suggestions.every((day) =>
        day.windows.every(
          (w) =>
            w.latestStartMinutes >= w.earliestStartMinutes &&
            w.latestStartMinutes + 150 <= 17 * 60,
        ),
      ),
    ).toBe(true)
  })

  it('keeps held canceled appointments unavailable and ignores empty days', () => {
    const appointments = [
      {
        id: 'held-cancel',
        date: '2026-11-10',
        startTime: '09:00',
        durationMinutes: 480,
        status: 'canceled',
        slotReleasedAt: null,
        type: 'appointment',
      },
    ]
    const suggestions = findRescheduleSuggestions({
      durationMinutes: 60,
      appointments,
      now: new Date('2026-11-09T15:00:00.000Z'),
      settings,
      workingDayLimit: 2,
    })
    expect(suggestions.every((s) => s.date !== '2026-11-10')).toBe(true)
    expect(suggestions.every((s) => s.windows.length > 0)).toBe(true)
  })

  it('clips today and converts remaining hours into start ranges', () => {
    const windows = findDayAvailabilityWindows({
      dateKey: '2026-11-09',
      durationMinutes: 60,
      appointments: [],
      now: new Date('2026-11-09T20:30:00.000Z'), // 3:30 PM ET
      settings,
    })
    expect(windows).toHaveLength(1)
    // Free 3:45–5:00 → latest start 4:00
    expect(windows[0].label).toBe('3:45–4:00 PM')
  })

  it('shows a single day when only one working day has openings', () => {
    const closedAfterMonday = {
      ...settings,
      weeklyHours: {
        sunday: { closed: true },
        monday: { closed: false, start: '09:00', end: '17:00' },
        tuesday: { closed: true },
        wednesday: { closed: true },
        thursday: { closed: true },
        friday: { closed: true },
        saturday: { closed: true },
      },
    }
    const suggestions = findRescheduleSuggestions({
      durationMinutes: 90,
      appointments: [],
      now: new Date('2026-11-09T15:00:00.000Z'),
      settings: closedAfterMonday,
      workingDayLimit: 2,
      searchDays: 5,
    })
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].date).toBe('2026-11-09')
  })

  it('respects America/New_York around a DST spring-forward morning', () => {
    // 2026-03-08 is DST start in US; 14:00 UTC is 10:00 EDT on Monday Mar 9.
    const windows = findDayAvailabilityWindows({
      dateKey: '2026-03-09',
      durationMinutes: 60,
      appointments: [],
      now: new Date('2026-03-09T14:00:00.000Z'),
      settings,
    })
    expect(windows[0].earliestStartMinutes).toBe(10 * 60 + 15)
    expect(windows[0].latestStartMinutes).toBe(16 * 60)
    expect(windows[0].label).toBe('10:15 AM–4:00 PM')
  })
})
