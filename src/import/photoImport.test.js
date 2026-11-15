import { describe, it, expect } from 'vitest'
import {
  normalizeExtractedImport,
  resolveAppointmentDuration,
} from './normalizeExtractedImport.js'
import {
  matchImportedClient,
  enrichClientsWithMatches,
} from './matchImportedClients.js'
import {
  enrichAppointmentsForReview,
  appointmentCanImport,
} from './enrichImportedAppointments.js'
import { dedupeExtractedClients } from './dedupeExtractedClients.js'
import { savePhotoImport } from './savePhotoImport.js'
import { emptySmsConsent } from '../reminders/smsConsent.js'

const existing = [
  {
    id: 'c-amy',
    firstName: 'Amy',
    lastName: 'Nguyen',
    displayName: 'Amy Nguyen',
    email: 'amy@example.com',
    phone: '(404) 555-0100',
    notes: 'color notes',
    smsConsent: {
      optedIn: true,
      optedInAt: '2026-01-01T00:00:00.000Z',
      optedOutAt: null,
      source: 'stylist_app',
      disclosureVersion: '1',
      phoneE164AtConsent: '+14045550100',
    },
  },
  {
    id: 'c-sam',
    firstName: 'Sam',
    lastName: 'Lee',
    displayName: 'Sam Lee',
    email: '',
    phone: '',
    notes: '',
    smsConsent: emptySmsConsent(),
  },
]

describe('normalizeExtractedImport', () => {
  it('keeps clients and appointments without inventing fields', () => {
    const result = normalizeExtractedImport({
      clients: [
        {
          firstName: 'Amy',
          lastName: 'Nguyen',
          phone: '404-555-0100',
          email: '',
          notes: '',
          confidence: 'high',
        },
      ],
      appointments: [
        {
          date: '2026-11-12',
          startTime: '2:00 PM',
          clientName: 'Amy Nguyen',
          service: 'Haircut',
          durationMinutes: null,
          confidence: 'medium',
        },
      ],
      warnings: ['Bottom corner blurry'],
    })

    expect(result.clients).toHaveLength(1)
    expect(result.clients[0].email).toBe('')
    expect(result.appointments[0].startTime).toBe('14:00')
    // Haircut + start only → inferred service default, flagged for review
    expect(result.appointments[0].durationMinutes).toBe(45)
    expect(result.appointments[0].durationInferred).toBe(true)
    expect(result.appointments[0].needsDuration).toBe(true)
    expect(result.warnings).toContain('Bottom corner blurry')
  })

  it('flags unreadable dates instead of inventing them', () => {
    const result = normalizeExtractedImport({
      appointments: [{ date: 'next Tuesday', startTime: '10:00', clientName: 'Pat' }],
    })
    expect(result.appointments[0].date).toBe('')
    expect(result.appointments[0].uncertainFields).toContain('date')
    expect(result.appointments[0].needsDate).toBe(true)
  })

  it('calculates duration from start and end without inventing', () => {
    const result = normalizeExtractedImport({
      appointments: [
        {
          date: '2026-11-12',
          startTime: '10:00',
          endTime: '11:30',
          clientName: 'Pat Lee',
          service: '',
          durationMinutes: null,
          confidence: 'high',
        },
      ],
    })
    expect(result.appointments[0].durationMinutes).toBe(90)
    expect(result.appointments[0].durationInferred).toBe(false)
    expect(result.appointments[0].durationSource).toBe('visible')
  })

  it('requires duration when service is unknown and end time missing', () => {
    const result = normalizeExtractedImport({
      appointments: [
        {
          date: '2026-11-12',
          startTime: '09:00',
          clientName: 'Unknown',
          service: 'Mystery Style',
          durationMinutes: null,
          confidence: 'low',
        },
      ],
    })
    expect(result.appointments[0].durationMinutes).toBeNull()
    expect(result.appointments[0].needsDuration).toBe(true)
  })
})

describe('resolveAppointmentDuration', () => {
  it('never invents an arbitrary duration', () => {
    const result = resolveAppointmentDuration({
      startTime: '10:00',
      service: '',
      confidence: 'low',
    })
    expect(result.durationMinutes).toBeNull()
    expect(result.needsDuration).toBe(true)
  })
})

describe('enrichAppointmentsForReview', () => {
  it('flags conflicts with existing appointments and blocked times', () => {
    const existingAppointments = [
      {
        id: 'a1',
        type: 'appointment',
        status: 'pending',
        date: '2026-11-12',
        startTime: '14:00',
        durationMinutes: 60,
        clientName: 'Existing Client',
        clientId: 'c-x',
      },
      {
        id: 'b1',
        type: 'blocked',
        status: 'blocked',
        date: '2026-11-12',
        startTime: '16:00',
        durationMinutes: 60,
        service: 'Lunch',
      },
    ]

    const { appointments } = enrichAppointmentsForReview(
      [
        {
          tempId: 'appt-1',
          date: '2026-11-12',
          startTime: '14:30',
          durationMinutes: 45,
          durationInferred: false,
          needsDuration: false,
          needsDate: false,
          clientName: 'Amy Nguyen',
          phone: '4045550100',
          service: 'Haircut',
          notes: '',
          uncertainFields: [],
          confidence: 'high',
          selected: true,
        },
        {
          tempId: 'appt-2',
          date: '2026-11-12',
          startTime: '16:15',
          durationMinutes: 30,
          durationInferred: false,
          needsDuration: false,
          needsDate: false,
          clientName: 'Sam Lee',
          phone: '',
          service: 'Blowout',
          notes: '',
          uncertainFields: [],
          confidence: 'high',
          selected: true,
        },
      ],
      existing,
      existingAppointments,
    )

    expect(appointments[0].blocking).toBe(true)
    expect(appointments[0].conflictMessage).toMatch(/Existing Client/i)
    expect(appointmentCanImport(appointments[0])).toBe(false)
    expect(appointments[1].blocking).toBe(true)
    expect(appointments[1].conflictMessage).toMatch(/Lunch|Blocked/i)
  })

  it('matches existing clients by name and requires date selection', () => {
    const { appointments } = enrichAppointmentsForReview(
      [
        {
          tempId: 'appt-1',
          date: '',
          startTime: '10:00',
          durationMinutes: 45,
          needsDate: true,
          needsDuration: false,
          clientName: 'Amy Nguyen',
          phone: '',
          service: 'Haircut',
          notes: '',
          uncertainFields: ['date'],
          confidence: 'medium',
          selected: true,
        },
      ],
      existing,
      [],
    )

    expect(appointments[0].linkedClientId).toBe('c-amy')
    expect(appointments[0].blocking).toBe(true)
    expect(appointmentCanImport(appointments[0])).toBe(false)
  })

  it('detects duplicates within the same import batch', () => {
    const { appointments } = enrichAppointmentsForReview(
      [
        {
          tempId: 'appt-1',
          date: '2026-11-12',
          startTime: '11:00',
          durationMinutes: 45,
          needsDate: false,
          needsDuration: false,
          clientName: 'Jordan Blake',
          service: 'Haircut',
          notes: '',
          uncertainFields: [],
          confidence: 'high',
          selected: true,
        },
        {
          tempId: 'appt-2',
          date: '2026-11-12',
          startTime: '11:00',
          durationMinutes: 45,
          needsDate: false,
          needsDuration: false,
          clientName: 'Jordan Blake',
          service: 'Haircut',
          notes: '',
          uncertainFields: [],
          confidence: 'high',
          selected: true,
        },
      ],
      [],
      [],
    )

    expect(appointments[1].duplicateOf).toBe('appt-1')
    expect(appointmentCanImport(appointments[1])).toBe(false)
  })
})

describe('dedupeExtractedClients', () => {
  it('merges overlapping screenshot duplicates by phone', () => {
    const rows = dedupeExtractedClients([
      {
        tempId: 'client-1',
        firstName: 'Amy',
        lastName: '',
        phone: '4045550100',
        email: '',
        confidence: 'medium',
        uncertainFields: ['lastName'],
      },
      {
        tempId: 'client-2',
        firstName: 'Amy',
        lastName: 'Nguyen',
        phone: '(404) 555-0100',
        email: 'amy@example.com',
        confidence: 'high',
        uncertainFields: [],
      },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].lastName).toBe('Nguyen')
    expect(rows[0].email).toBe('amy@example.com')
    expect(rows[0].confidence).toBe('high')
  })
})

describe('matchImportedClient', () => {
  it('matches by phone and does not treat as new', () => {
    const match = matchImportedClient(
      { firstName: 'Amy', lastName: 'Nguyen', phone: '4045550100' },
      existing,
    )
    expect(match.status).toBe('matched')
    expect(match.matchedClientId).toBe('c-amy')
    expect(match.reason).toBe('phone')
  })

  it('flags same-name records as possible duplicates', () => {
    const match = matchImportedClient(
      { firstName: 'Sam', lastName: 'Lee', phone: '' },
      existing,
    )
    expect(match.status).toBe('possible_duplicate')
    expect(match.reason).toBe('name')
  })

  it('returns new when no overlap', () => {
    const match = matchImportedClient(
      { firstName: 'Pat', lastName: 'Rivera', phone: '4045550999' },
      existing,
    )
    expect(match.status).toBe('new')
  })
})

describe('enrichClientsWithMatches', () => {
  it('defaults matched phone rows to link', () => {
    const rows = enrichClientsWithMatches(
      [{ tempId: 'client-1', firstName: 'Amy', lastName: 'Nguyen', phone: '4045550100' }],
      existing,
    )
    expect(rows[0].action).toBe('link')
    expect(rows[0].linkedClientId).toBe('c-amy')
  })
})

describe('savePhotoImport', () => {
  it('creates clients without SMS opt-in and preserves consent on link', async () => {
    const created = []
    const updated = []
    const appointments = []
    const clientsById = new Map(existing.map((c) => [c.id, structuredClone(c)]))

    const summary = await savePhotoImport({
      clients: [
        {
          tempId: 'client-1',
          selected: true,
          action: 'link',
          linkedClientId: 'c-amy',
          firstName: 'Amy',
          lastName: 'Nguyen',
          phone: '4045550100',
          email: 'amy@example.com',
          notes: '',
        },
        {
          tempId: 'client-3',
          selected: true,
          action: 'link',
          linkedClientId: 'c-sam',
          firstName: 'Sam',
          lastName: 'Lee',
          phone: '4045550111',
          email: '',
          notes: '',
        },
        {
          tempId: 'client-2',
          selected: true,
          action: 'create',
          firstName: 'Jordan',
          lastName: 'Blake',
          phone: '4045550200',
          email: '',
          notes: '',
        },
      ],
      appointments: [
        {
          tempId: 'appt-1',
          selected: true,
          date: '2026-11-12',
          startTime: '14:00',
          clientTempId: 'client-2',
          clientName: 'Jordan Blake',
          service: 'Haircut',
          durationMinutes: 45,
          notes: '',
        },
      ],
      createClientFn: async (input) => {
        created.push(input)
        const record = {
          id: `new-${created.length}`,
          ...input,
          displayName: `${input.firstName} ${input.lastName}`.trim(),
        }
        clientsById.set(record.id, record)
        return record
      },
      updateClientFn: async (id, patch) => {
        updated.push({ id, patch })
        const current = clientsById.get(id)
        const next = { ...current, ...patch }
        clientsById.set(id, next)
        return next
      },
      getClientByIdFn: (id) => clientsById.get(id) ?? null,
      getAppointmentsFn: () => [],
      createAppointmentFn: async (input) => {
        appointments.push(input)
        return { id: `appt-${appointments.length}`, ...input }
      },
    })

    expect(summary.clientsCreated).toBe(1)
    expect(summary.clientsLinked).toBe(1)
    expect(summary.clientsUpdated).toBe(1)
    expect(summary.appointmentsCreated).toBe(1)
    expect(created[0].smsConsent.optedIn).toBe(false)
    expect(updated[0].id).toBe('c-sam')
    expect(updated[0].patch.phone).toBe('4045550111')
    expect(updated[0].patch.smsConsent).toBeUndefined()
    expect(clientsById.get('c-amy').smsConsent.optedIn).toBe(true)
    expect(clientsById.get('c-sam').smsConsent.optedIn).toBe(false)
    expect(appointments[0].clientId).toBe('new-1')
    expect(appointments[0].status).toBe('pending')
  })

  it('allows appointments without phone and clients without appointments', async () => {
    const created = []
    const appointments = []
    const summary = await savePhotoImport({
      clients: [
        {
          tempId: 'client-1',
          selected: true,
          action: 'create',
          firstName: 'Only',
          lastName: 'Contact',
          phone: '4045550300',
          email: 'only@example.com',
          notes: '',
        },
      ],
      appointments: [
        {
          tempId: 'appt-1',
          selected: true,
          date: '2026-11-13',
          startTime: '11:00',
          clientName: 'Walk In',
          phone: '',
          service: 'Blowout',
          durationMinutes: 45,
        },
      ],
      createClientFn: async (input) => {
        created.push(input)
        return {
          id: `new-${created.length}`,
          ...input,
          displayName: `${input.firstName} ${input.lastName}`.trim(),
        }
      },
      updateClientFn: async () => {
        throw new Error('should not update')
      },
      getClientByIdFn: () => null,
      getAppointmentsFn: () => [],
      createAppointmentFn: async (input) => {
        appointments.push(input)
        return input
      },
    })

    expect(summary.clientsCreated).toBe(2)
    expect(summary.appointmentsCreated).toBe(1)
    expect(created[0].firstName).toBe('Only')
    expect(created[1].firstName).toBe('Walk')
    expect(appointments[0].phone).toBeUndefined()
  })

  it('does not import conflicting or duplicate appointments', async () => {
    const created = []
    const summary = await savePhotoImport({
      clients: [],
      appointments: [
        {
          tempId: 'appt-1',
          selected: true,
          date: '2026-11-12',
          startTime: '14:00',
          clientName: 'Amy Nguyen',
          linkedClientId: 'c-amy',
          service: 'Haircut',
          durationMinutes: 45,
          blocking: true,
          conflictMessage: 'Conflicts with existing',
        },
        {
          tempId: 'appt-2',
          selected: true,
          date: '2026-11-12',
          startTime: '10:00',
          clientName: 'Amy Nguyen',
          linkedClientId: 'c-amy',
          service: 'Haircut',
          durationMinutes: 45,
        },
      ],
      createClientFn: async () => {
        throw new Error('should not create')
      },
      updateClientFn: async () => {
        throw new Error('should not update')
      },
      getClientByIdFn: (id) => existing.find((c) => c.id === id) ?? null,
      getAppointmentsFn: () => [
        {
          id: 'existing',
          date: '2026-11-12',
          startTime: '10:00',
          durationMinutes: 45,
          clientId: 'c-amy',
          clientName: 'Amy Nguyen',
          type: 'appointment',
          status: 'pending',
        },
      ],
      createAppointmentFn: async (input) => {
        created.push(input)
        return input
      },
    })

    expect(summary.appointmentsCreated).toBe(0)
    expect(summary.errors.length).toBeGreaterThanOrEqual(2)
    expect(created).toHaveLength(0)
  })

  it('imports approved calendar appointments as pending without notifications', async () => {
    const created = []
    const summary = await savePhotoImport({
      clients: [
        {
          tempId: 'client-1',
          selected: true,
          action: 'create',
          firstName: 'New',
          lastName: 'Guest',
          phone: '',
          email: '',
          notes: '',
        },
      ],
      appointments: [
        {
          tempId: 'appt-1',
          selected: true,
          date: '2026-11-20',
          startTime: '13:00',
          clientTempId: 'client-1',
          clientName: 'New Guest',
          service: 'Color',
          durationMinutes: 120,
          status: 'pending',
          notes: 'from photo',
        },
      ],
      createClientFn: async (input) => ({
        id: 'new-guest',
        ...input,
        displayName: 'New Guest',
      }),
      updateClientFn: async () => {
        throw new Error('should not update')
      },
      getClientByIdFn: () => null,
      getAppointmentsFn: () => [],
      createAppointmentFn: async (input) => {
        created.push(input)
        return { id: 'a-new', ...input }
      },
    })

    expect(summary.appointmentsCreated).toBe(1)
    expect(created[0].status).toBe('pending')
    expect(created[0].notes).toBe('from photo')
    expect(created[0].reminders).toBeUndefined()
    expect(created[0].confirmation).toBeUndefined()
    expect(created[0].sms).toBeUndefined()
  })
})
