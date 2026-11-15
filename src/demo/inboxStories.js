import { startOfDay, toDateKey } from '../utils/dateUtils.js'
import { formatVisit } from './formatVisit.js'
import { money } from './showcase.js'

export const EMILY_CLIENT_ID = 'demo-client-emily'
export const EMILY_PAYMENT_APPOINTMENT_ID = 'demo-appt-01'

function isVisit(item) {
  return item && item.type !== 'blocked' && item.status !== 'blocked'
}

function isCurated(item) {
  return /^demo-appt-\d{2}$/.test(String(item?.id || ''))
}

function byTime(a, b) {
  return String(a.startTime).localeCompare(String(b.startTime))
}

export function nextSalonDateKey(appointments, now = new Date()) {
  const todayKey = toDateKey(startOfDay(now))
  const dates = (appointments || [])
    .filter((item) => isVisit(item) && item.status !== 'canceled' && item.date >= todayKey)
    .map((item) => item.date)
    .sort()
  return dates[0] || todayKey
}

function clientMap(clients) {
  return new Map((clients || []).map((client) => [client.id, client]))
}

function visitLine(item) {
  const name = item.clientName || 'Customer'
  return `${formatVisit(item.date, item.startTime)} — ${name}, ${item.service || 'Appointment'}`
}

export function buildDayBriefing(appointments = [], clients = [], now = new Date()) {
  const dateKey = nextSalonDateKey(appointments, now)
  const known = clientMap(clients)
  const dayVisits = appointments
    .filter((item) => isVisit(item) && item.date === dateKey && item.status !== 'canceled')
    .sort(byTime)
  return {
    dateKey,
    dateLabel: formatVisit(dateKey),
    appointments: dayVisits.map(visitLine),
    reschedules: appointments
      .filter((item) => item.status === 'reschedule_requested')
      .map((item) => {
        const requested = formatVisit(item.rescheduleRequest?.date, item.rescheduleRequest?.startTime)
        return `${item.clientName || 'A customer'} asked to move ${item.service} from ${formatVisit(item.date, item.startTime)} to ${requested}`
      }),
    withoutCard: dayVisits
      .filter((item) => !known.get(item.clientId)?.savedCard)
      .map((item) => `${item.clientName || 'Customer'} has no saved payment method`),
    unpaid: dayVisits
      .filter((item) => item.payment?.status === 'requested')
      .map((item) => `${item.clientName || 'Customer'} — ${item.service}, ${money(item.payment.amountCents)} due`),
  }
}

export function findEmilyPayment(appointments = []) {
  return appointments.find((item) => item.id === EMILY_PAYMENT_APPOINTMENT_ID) || null
}

export function emilyPaymentCopy(appointment) {
  const amount = money(appointment?.payment?.amountCents || 6500)
  const service = appointment?.service || 'Haircut'
  return {
    service,
    amount,
    paid: appointment?.payment?.status === 'paid',
  }
}

function curated(appointments) {
  return (appointments || []).filter((item) => isVisit(item) && isCurated(item))
}

export function buildFollowUpDigest(appointments = [], clients = []) {
  const known = clientMap(clients)
  const rows = curated(appointments)
  const line = (item) => visitLine(item)
  return {
    reschedules: rows.filter((item) => item.status === 'reschedule_requested').map(line),
    overdue: rows
      .filter((item) => item.payment?.status === 'requested')
      .map((item) => `${item.clientName || 'Customer'} — ${item.service}, ${money(item.payment.amountCents)} still open`),
    followUp: rows
      .filter((item) => item.status !== 'canceled' && item.payment?.status !== 'paid' && !known.get(item.clientId)?.savedCard)
      .slice(0, 3)
      .map((item) => `${item.clientName || 'Customer'} has no saved card for ${item.service}`),
    cancellations: rows.filter((item) => item.status === 'canceled').slice(0, 3).map(line),
    bookings: rows.filter((item) => item.status === 'pending').slice(0, 3).map(line),
    confirmations: rows.filter((item) => item.status === 'confirmed' && item.payment?.status !== 'requested').slice(0, 3).map(line),
    completedReschedules: [],
  }
}

export function linesOrNone(lines) {
  return lines.length ? lines : ['None right now.']
}
