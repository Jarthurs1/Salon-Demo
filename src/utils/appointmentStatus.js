/**
 * Appointment status labels and helpers shared across calendar views.
 */

export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  RESCHEDULE_REQUESTED: 'reschedule_requested',
  CANCELED: 'canceled',
  BLOCKED: 'blocked',
}

export const APPOINTMENT_STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  reschedule_requested: 'Reschedule requested',
  canceled: 'Canceled',
  cancelled: 'Canceled',
  blocked: 'Blocked',
}

/** Calendar badge text — canceled uses all-caps for visibility. */
export function getAppointmentStatusBadgeLabel(status) {
  const key = String(status || '').toLowerCase()
  if (key === 'canceled' || key === 'cancelled') return 'CANCELED'
  return getAppointmentStatusLabel(status)
}

export function getAppointmentStatusLabel(status) {
  return APPOINTMENT_STATUS_LABELS[status] || String(status || 'Pending')
}

export function isRescheduleRequested(appointment) {
  return appointment?.status === APPOINTMENT_STATUS.RESCHEDULE_REQUESTED
}
