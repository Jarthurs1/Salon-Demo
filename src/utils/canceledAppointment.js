/**
 * Canceled appointments can still occupy their calendar slot until the stylist
 * explicitly releases them (slotReleasedAt).
 *
 * Legacy canceled records (no slotReleasedAt field) are treated as already
 * released so old calendars are not reblocked on migration.
 */

export function isCanceledAppointment(appointment) {
  const status = String(appointment?.status || '').toLowerCase()
  return status === 'canceled' || status === 'cancelled'
}

/**
 * Normalize slotReleasedAt for persistence/hydration.
 * - New cancels: null (slot held)
 * - Released: ISO timestamp
 * - Legacy canceled without the field: stamp as released
 */
export function normalizeSlotReleasedAt(record, status = record?.status) {
  const canceled =
    String(status || '').toLowerCase() === 'canceled' ||
    String(status || '').toLowerCase() === 'cancelled'

  if (Object.prototype.hasOwnProperty.call(record || {}, 'slotReleasedAt')) {
    const value = record.slotReleasedAt
    if (value == null || value === '') return null
    return String(value)
  }

  // Legacy canceled rows predate slotReleasedAt and already freed availability.
  if (canceled) {
    return (
      record?.canceledAt ||
      record?.confirmation?.canceledAt ||
      '1970-01-01T00:00:00.000Z'
    )
  }

  return null
}

/** True when a canceled appointment still blocks booking/calendar availability. */
export function isCanceledSlotHeld(appointment) {
  if (!isCanceledAppointment(appointment)) return false
  return appointment?.slotReleasedAt == null || appointment.slotReleasedAt === ''
}

/** True when a canceled appointment should appear on the active Calendar. */
export function isCanceledVisibleOnCalendar(appointment) {
  return isCanceledSlotHeld(appointment)
}

export function doesAppointmentBlockAvailability(appointment) {
  if (!appointment) return false
  if (isCanceledAppointment(appointment)) {
    return isCanceledSlotHeld(appointment)
  }
  return true
}

export function applyReleaseCanceledSlot(
  appointment,
  atIso = new Date().toISOString(),
) {
  if (!isCanceledAppointment(appointment)) return appointment
  if (!isCanceledSlotHeld(appointment)) return appointment
  return {
    ...appointment,
    slotReleasedAt: atIso,
  }
}
