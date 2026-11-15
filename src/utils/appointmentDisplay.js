/**
 * Resolve display names for appointments via live client records.
 */

import { getClientById } from '../services/clientRepository.js'
import { getClientDisplayName } from './clientUtils.js'

export function resolveAppointmentClientName(appointment) {
  if (!appointment || appointment.type === 'blocked') {
    return appointment?.service || 'Blocked'
  }
  if (appointment.clientId) {
    const client = getClientById(appointment.clientId)
    if (client) return getClientDisplayName(client)
  }
  return appointment.clientName || 'Client'
}
