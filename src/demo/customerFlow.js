import {
  cancelByCustomer,
  confirmByCustomer,
  requestCustomerReschedule,
} from '../appointments/customerManage.js'
import {
  createAppointment,
  getAppointmentById,
  updateAppointment,
} from '../services/appointmentRepository.js'
import { recordDemoMail } from './mailbox.js'

export async function bookDemoAppointment(client, selection) {
  const record = await createAppointment({
    clientId: client.id,
    clientName: client.displayName || `${client.firstName} ${client.lastName}`,
    date: selection.date,
    startTime: selection.startTime,
    durationMinutes: selection.durationMinutes,
    service: selection.service,
    serviceId: selection.serviceId,
    status: 'pending',
    source: 'online_booking',
    notes: '',
  })
  return record
}

export async function confirmDemoAppointment(id) {
  const current = getAppointmentById(id)
  const outcome = confirmByCustomer(current, new Date().toISOString())
  if (!outcome.mutates) return outcome
  const saved = await updateAppointment(id, outcome.appointment)
  recordDemoMail('confirmed', saved)
  return { ...outcome, appointment: saved }
}

export async function cancelDemoAppointment(id) {
  const current = getAppointmentById(id)
  const outcome = cancelByCustomer(current, new Date().toISOString())
  if (!outcome.mutates) return outcome
  const saved = await updateAppointment(id, outcome.appointment)
  recordDemoMail('cancellation', saved)
  return { ...outcome, appointment: saved }
}

export async function requestDemoReschedule(id, date, startTime) {
  const current = getAppointmentById(id)
  const outcome = requestCustomerReschedule(
    current,
    { date, startTime },
    new Date().toISOString(),
  )
  if (!outcome.mutates) return outcome
  const saved = await updateAppointment(id, outcome.appointment)
  recordDemoMail('rescheduleRequested', saved, { requestedDate: date, requestedTime: startTime })
  return { ...outcome, appointment: saved }
}
