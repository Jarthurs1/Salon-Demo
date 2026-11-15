/**
 * Realistic fictional demo seed for Rozie's Salon (Phase 6.5).
 * Emails use @example.com only — never real/deliverable addresses.
 */

import { addDays, toDateKey, startOfDay, parseDateKey, parseTimeToMinutes } from '../utils/dateUtils.js'
import { isClosedDay, getHoursForDate, getScheduleSettings } from './schedule.js'
import { getWorkingDayDurationMinutes } from '../utils/conflictUtils.js'

/** Last calendar day included in generated example appointments. */
export const DEMO_DATA_END = '2027-12-31'

export const DEMO_CLIENTS = [
  {
    id: 'demo-client-emily',
    firstName: 'Emily',
    lastName: 'Carter',
    email: 'emily.carter@example.com',
    phone: '',
    notes: '',
  },
  {
    id: 'demo-client-lauren',
    firstName: 'Lauren',
    lastName: 'Mitchell',
    email: 'lauren.mitchell@example.com',
    phone: '',
    notes: '',
  },
  {
    id: 'demo-client-sarah',
    firstName: 'Sarah',
    lastName: 'Bennett',
    email: 'sarah.bennett@example.com',
    phone: '',
    notes: '',
  },
  {
    id: 'demo-client-nicole',
    firstName: 'Nicole',
    lastName: 'Harris',
    email: 'nicole.harris@example.com',
    phone: '',
    notes: '',
  },
  {
    id: 'demo-client-amanda',
    firstName: 'Amanda',
    lastName: 'Brooks',
    email: 'amanda.brooks@example.com',
    phone: '',
    notes: '',
  },
  {
    id: 'demo-client-jessica',
    firstName: 'Jessica',
    lastName: 'Coleman',
    email: 'jessica.coleman@example.com',
    phone: '',
    notes: '',
  },
  {
    id: 'demo-client-megan',
    firstName: 'Megan',
    lastName: 'Foster',
    email: 'megan.foster@example.com',
    phone: '',
    notes: '',
  },
  {
    id: 'demo-client-rachel',
    firstName: 'Rachel',
    lastName: 'Nguyen',
    email: 'rachel.nguyen@example.com',
    phone: '',
    notes: '',
  },
  {
    id: 'demo-client-olivia',
    firstName: 'Olivia',
    lastName: 'Parker',
    email: 'olivia.parker@example.com',
    phone: '',
    notes: '',
  },
  {
    id: 'demo-client-hannah',
    firstName: 'Hannah',
    lastName: 'Sullivan',
    email: 'hannah.sullivan@example.com',
    phone: '',
    notes: '',
  },
]

function nextOpenDays(fromDate, count) {
  const days = []
  let cursor = startOfDay(fromDate)
  let guard = 0
  while (days.length < count && guard < 90) {
    if (!isClosedDay(cursor)) days.push(startOfDay(cursor))
    cursor = addDays(cursor, 1)
    guard += 1
  }
  return days
}

function appt({
  id,
  client,
  date,
  startTime,
  durationMinutes,
  service,
  status,
  notes = '',
}) {
  return {
    id,
    type: 'appointment',
    clientId: client.id,
    clientName: `${client.firstName} ${client.lastName}`,
    date: typeof date === 'string' ? date : toDateKey(date),
    startTime,
    durationMinutes,
    service,
    status,
    notes,
    confirmation:
      status === 'confirmed'
        ? { tokenHash: null, tokenNonce: null, confirmedAt: new Date().toISOString() }
        : { tokenHash: null, tokenNonce: null, confirmedAt: null },
    reminders: {
      sevenDaySentAt: null,
      threeDaySentAt: null,
      oneDaySentAt: null,
    },
  }
}

function openDaysThrough(fromDate, endKey) {
  const end = startOfDay(parseDateKey(endKey))
  const days = []
  let cursor = startOfDay(fromDate)
  while (cursor.getTime() <= end.getTime()) {
    if (!isClosedDay(cursor)) days.push(startOfDay(cursor))
    cursor = addDays(cursor, 1)
  }
  return days
}

function slotFitsDay(date, startTime, durationMinutes, settings) {
  const hours = getHoursForDate(date, settings)
  if (!hours || hours.closed) return false
  const start = parseTimeToMinutes(startTime)
  const open = parseTimeToMinutes(hours.start)
  const close = parseTimeToMinutes(hours.end)
  if (start == null || open == null || close == null) return false
  return start >= open && start + durationMinutes <= close
}

const HORIZON_PATTERNS = [
  [
    { startTime: '09:00', durationMinutes: 45, service: 'Haircut' },
    { startTime: '10:00', durationMinutes: 60, service: 'Haircut & Style' },
    { startTime: '13:00', durationMinutes: 120, service: 'Color' },
  ],
  [
    { startTime: '09:30', durationMinutes: 150, service: 'Highlights' },
    { kind: 'lunch' },
    { startTime: '14:00', durationMinutes: 60, service: 'Haircut & Style' },
  ],
  [
    { startTime: '11:00', durationMinutes: 30, service: 'Consultation' },
    { startTime: '14:30', durationMinutes: 45, service: 'Haircut' },
  ],
  [{ startTime: '10:00', durationMinutes: 150, service: 'Color & Cut' }],
  [
    { startTime: '09:00', durationMinutes: 45, service: 'Blowout' },
    { startTime: '15:00', durationMinutes: 45, service: 'Haircut' },
  ],
  [
    { startTime: '09:00', durationMinutes: 45, service: 'Blowout' },
    { startTime: '11:00', durationMinutes: 120, service: 'Color' },
  ],
]

function emptyReminderFields() {
  return {
    confirmation: { tokenHash: null, tokenNonce: null, confirmedAt: null },
    reminders: {
      sevenDaySentAt: null,
      threeDaySentAt: null,
      oneDaySentAt: null,
    },
  }
}

/**
 * Repeating example appointments from the first open day after the curated
 * sample through DEMO_DATA_END. Occasional full-day blocks keep the mix realistic.
 */
function buildHorizonAppointments(referenceDate, settings, clients, skipCount) {
  const open = openDaysThrough(referenceDate, DEMO_DATA_END)
  const days = open.slice(skipCount)
  const list = []

  days.forEach((date, index) => {
    const dateKey = toDateKey(date).replace(/-/g, '')
    if (index % 24 === 23) {
      const hours = getHoursForDate(date, settings)
      const fullDuration = getWorkingDayDurationMinutes(date, settings)
      if (!hours.closed && fullDuration) {
        list.push({
          id: `demo-block-${dateKey}-fullday`,
          type: 'blocked',
          clientId: null,
          clientName: null,
          date: toDateKey(date),
          startTime: hours.start,
          durationMinutes: fullDuration,
          service: 'Blocked — Full Day',
          status: 'blocked',
          notes: '',
          ...emptyReminderFields(),
        })
      }
      return
    }

    const pattern = HORIZON_PATTERNS[index % HORIZON_PATTERNS.length]
    let slotIndex = 0
    for (const slot of pattern) {
      if (slot.kind === 'lunch') {
        if (slotFitsDay(date, '12:00', 60, settings)) {
          list.push({
            id: `demo-block-${dateKey}-lunch`,
            type: 'blocked',
            clientId: null,
            clientName: null,
            date: toDateKey(date),
            startTime: '12:00',
            durationMinutes: 60,
            service: 'Lunch',
            status: 'blocked',
            notes: '',
            ...emptyReminderFields(),
          })
        }
        continue
      }
      if (!slotFitsDay(date, slot.startTime, slot.durationMinutes, settings)) continue
      const client = clients[(index + slotIndex) % clients.length]
      slotIndex += 1
      list.push(
        appt({
          id: `demo-appt-${dateKey}-${slot.startTime.replace(':', '')}`,
          client,
          date,
          startTime: slot.startTime,
          durationMinutes: slot.durationMinutes,
          service: slot.service,
          status: (index + slotIndex) % 3 === 0 ? 'pending' : 'confirmed',
        }),
      )
    }
  })

  return list
}

/**
 * Build demo appointments around `referenceDate` (defaults to today).
 * Includes a near-term sample plus example appointments through DEMO_DATA_END.
 */
export function buildDemoAppointments(referenceDate = new Date()) {
  const settings = getScheduleSettings()
  const today = startOfDay(referenceDate)
  const open = nextOpenDays(today, 8)
  if (open.length < 5) return []

  const [
    day0,
    day1,
    day2,
    day3,
    day4,
    day5,
  ] = open

  const c = Object.fromEntries(
    DEMO_CLIENTS.map((client) => [client.id.replace('demo-client-', ''), client]),
  )

  const lunchBlock = {
    id: 'demo-block-lunch',
    type: 'blocked',
    clientId: null,
    clientName: null,
    date: toDateKey(day1),
    startTime: '12:00',
    durationMinutes: 60,
    service: 'Lunch',
    status: 'blocked',
    notes: '',
    confirmation: { tokenHash: null, tokenNonce: null, confirmedAt: null },
    reminders: {
      sevenDaySentAt: null,
      threeDaySentAt: null,
      oneDaySentAt: null,
    },
  }

  const fullDayDate = day4
  const hours = getHoursForDate(fullDayDate, settings)
  const fullDuration = getWorkingDayDurationMinutes(fullDayDate, settings)
  const fullDayBlock =
    !hours.closed && fullDuration
      ? {
          id: 'demo-block-fullday',
          type: 'blocked',
          clientId: null,
          clientName: null,
          date: toDateKey(fullDayDate),
          startTime: hours.start,
          durationMinutes: fullDuration,
          service: 'Blocked — Full Day',
          status: 'blocked',
          notes: '',
          confirmation: { tokenHash: null, tokenNonce: null, confirmedAt: null },
          reminders: {
            sevenDaySentAt: null,
            threeDaySentAt: null,
            oneDaySentAt: null,
          },
        }
      : null

  const list = [
    // Busy day 0
    appt({
      id: 'demo-appt-01',
      client: c.emily,
      date: day0,
      startTime: '09:00',
      durationMinutes: 45,
      service: 'Haircut',
      status: 'confirmed',
    }),
    appt({
      id: 'demo-appt-02',
      client: c.lauren,
      date: day0,
      startTime: '10:00',
      durationMinutes: 60,
      service: 'Haircut & Style',
      status: 'confirmed',
    }),
    appt({
      id: 'demo-appt-03',
      client: c.sarah,
      date: day0,
      startTime: '13:00',
      durationMinutes: 120,
      service: 'Color',
      status: 'pending',
    }),
    appt({
      id: 'demo-appt-04',
      client: c.nicole,
      date: day0,
      startTime: '15:30',
      durationMinutes: 45,
      service: 'Blowout',
      status: 'confirmed',
    }),
    // Day 1 with lunch block
    appt({
      id: 'demo-appt-05',
      client: c.amanda,
      date: day1,
      startTime: '09:30',
      durationMinutes: 150,
      service: 'Highlights',
      status: 'confirmed',
    }),
    lunchBlock,
    appt({
      id: 'demo-appt-06',
      client: c.jessica,
      date: day1,
      startTime: '14:00',
      durationMinutes: 60,
      service: 'Haircut & Style',
      status: 'pending',
    }),
    // Lighter day 2
    appt({
      id: 'demo-appt-07',
      client: c.megan,
      date: day2,
      startTime: '11:00',
      durationMinutes: 30,
      service: 'Consultation',
      status: 'confirmed',
    }),
    appt({
      id: 'demo-appt-08',
      client: c.rachel,
      date: day2,
      startTime: '14:30',
      durationMinutes: 45,
      service: 'Haircut',
      status: 'pending',
    }),
    // Day 3
    appt({
      id: 'demo-appt-09',
      client: c.olivia,
      date: day3,
      startTime: '10:00',
      durationMinutes: 150,
      service: 'Color & Cut',
      status: 'confirmed',
    }),
    appt({
      id: 'demo-appt-10',
      client: c.hannah,
      date: day3,
      startTime: '13:30',
      durationMinutes: 60,
      service: 'Haircut & Style',
      status: 'pending',
    }),
    // Day 4 full-day block + maybe nothing else
    ...(fullDayBlock ? [fullDayBlock] : []),
    // Further out
    appt({
      id: 'demo-appt-11',
      client: c.emily,
      date: day5,
      startTime: '09:00',
      durationMinutes: 45,
      service: 'Blowout',
      status: 'pending',
    }),
    appt({
      id: 'demo-appt-12',
      client: c.lauren,
      date: day5,
      startTime: '11:00',
      durationMinutes: 120,
      service: 'Color',
      status: 'confirmed',
    }),
  ]

  return [
    ...list.filter(Boolean),
    ...buildHorizonAppointments(today, settings, DEMO_CLIENTS, 6),
  ]
}

/** Known Phase 5/6 test client name patterns for cleanup. */
export function isObviousTestClient(client) {
  const name = `${client.firstName || ''} ${client.lastName || ''} ${client.displayName || ''} ${client.name || ''}`
    .toLowerCase()
    .trim()
  const email = String(client.email || '').toLowerCase()
  return (
    name.includes('aws test') ||
    name.includes('amplify test') ||
    name.includes('phase 6 email test') ||
    email.includes('aws-test-client@') ||
    email.includes('amplify-test-client@') ||
    (email.endsWith('@example.com') && name.includes('phase 6'))
  )
}

export function isDemoSeedClient(client) {
  return String(client.id || '').startsWith('demo-client-')
}

export function isDemoSeedAppointment(appointment) {
  return String(appointment.id || '').startsWith('demo-')
}
