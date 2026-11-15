import { addDays, parseDateKey, toDateKey } from '../utils/dateUtils.js'

export const SERVICE_PRICES = {
  Haircut: 6500,
  'Haircut & Style': 8500,
  Blowout: 5500,
  Color: 14500,
  'Color & Cut': 18500,
  Highlights: 18500,
  'Bridal / Wedding': 35000,
  Consultation: 4000,
  Other: 7500,
}

const SAVED_CARDS = {
  'demo-client-emily': { brand: 'Visa', last4: '4242' },
  'demo-client-lauren': { brand: 'Mastercard', last4: '4444' },
  'demo-client-amanda': { brand: 'Visa', last4: '1881' },
  'demo-client-rachel': { brand: 'Visa', last4: '5100' },
}

export function decorateShowcaseClients(clients) {
  return clients.map((client) => ({
    ...client,
    savedCard: SAVED_CARDS[client.id] || null,
  }))
}

export function decorateShowcaseAppointments(appointments) {
  return appointments.map((appointment) => {
    if (appointment.id === 'demo-appt-01') {
      return {
        ...appointment,
        payment: {
          status: 'paid',
          amountCents: 6500,
          tipCents: 1000,
          requestedAt: '2026-11-01T14:00:00.000Z',
          paidAt: '2026-11-01T15:00:00.000Z',
          brand: 'Visa',
          last4: '4242',
        },
      }
    }
    if (appointment.id === 'demo-appt-02') {
      return {
        ...appointment,
        payment: {
          status: 'requested',
          amountCents: 8500,
          tipCents: 0,
          requestedAt: '2026-11-02T16:00:00.000Z',
          paidAt: null,
          brand: 'Mastercard',
          last4: '4444',
        },
      }
    }
    if (appointment.id === 'demo-appt-05' && appointment.date) {
      return {
        ...appointment,
        status: 'reschedule_requested',
        rescheduleRequest: {
          status: 'pending',
          date: toDateKey(addDays(parseDateKey(appointment.date), 7)),
          startTime: '11:00',
          requestedAt: '2026-11-10T15:00:00.000Z',
          resolvedAt: null,
          source: 'customer_website',
          priorStatus: 'confirmed',
        },
      }
    }
    if (appointment.id === 'demo-appt-06') {
      return {
        ...appointment,
        status: 'canceled',
        canceledAt: '2026-11-09T18:00:00.000Z',
        slotReleasedAt: '2026-11-09T18:00:00.000Z',
        cancellationSource: 'customer_website',
      }
    }
    return appointment
  })
}

export function money(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`
}
