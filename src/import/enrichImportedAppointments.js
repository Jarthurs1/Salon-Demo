/**
 * Enrich calendar photo-import drafts with client matches, conflicts, and duplicates.
 */

import {
  matchImportedClient,
  enrichClientsWithMatches,
  matchLabel,
} from './matchImportedClients.js'
import {
  collapseWhitespace,
  splitFullName,
  buildDisplayName,
  getClientDisplayName,
} from '../utils/clientUtils.js'
import {
  findConflicts,
  validateAppointmentSlot,
  describeConflict,
} from '../utils/conflictUtils.js'
import { isOutsideNormalHours } from '../data/schedule.js'
import { parseTimeToMinutes } from '../utils/dateUtils.js'

function draftAsClient(appt) {
  const name = collapseWhitespace(appt?.clientName)
  const split = name ? splitFullName(name) : { firstName: '', lastName: '' }
  return {
    firstName: split.firstName,
    lastName: split.lastName,
    clientName: name,
    phone: appt?.phone || '',
    email: appt?.email || '',
  }
}

function isLikelyDuplicate(a, b) {
  if (!a || !b) return false
  if (a.date !== b.date) return false
  if (a.startTime !== b.startTime) return false
  if (Number(a.durationMinutes) !== Number(b.durationMinutes)) return false
  const nameA = collapseWhitespace(a.clientName || a.clientId || '').toLowerCase()
  const nameB = collapseWhitespace(b.clientName || b.clientId || '').toLowerCase()
  if (nameA && nameB && nameA === nameB) return true
  if (a.clientId && b.clientId && a.clientId === b.clientId) return true
  if (a.linkedClientId && b.linkedClientId && a.linkedClientId === b.linkedClientId) {
    return true
  }
  return false
}

/**
 * @param {object[]} appointments
 * @param {object[]} existingClients
 * @param {object[]} existingAppointments
 * @param {object[]} [clientDrafts]
 */
export function enrichAppointmentsForReview(
  appointments,
  existingClients = [],
  existingAppointments = [],
  clientDrafts = [],
) {
  const enrichedClients =
    clientDrafts.length > 0
      ? clientDrafts
      : enrichClientsWithMatches(
          (appointments || [])
            .filter((a) => a.clientName || a.phone)
            .map((a, index) => {
              const draft = draftAsClient(a)
              return {
                tempId: a.clientTempId || `derived-client-${index + 1}`,
                ...draft,
                notes: '',
                uncertainFields: [],
                confidence: a.confidence || 'medium',
                selected: true,
              }
            }),
          existingClients,
        )

  const byTempId = new Map(enrichedClients.map((c) => [c.tempId, c]))

  const rows = (Array.isArray(appointments) ? appointments : []).map((appt) => {
    const linkedDraft = appt.clientTempId ? byTempId.get(appt.clientTempId) : null
    const match = linkedDraft?.match || matchImportedClient(draftAsClient(appt), existingClients)

    let linkedClientId =
      appt.linkedClientId ||
      linkedDraft?.linkedClientId ||
      match.matchedClientId ||
      null

    let clientAction = 'create'
    if (linkedClientId) clientAction = 'link'
    else if (linkedDraft?.action) clientAction = linkedDraft.action

    const warnings = []
    if (appt.needsDate || !appt.date) {
      warnings.push('Select the appointment date before importing.')
    }
    if (appt.needsDuration && appt.durationInferred) {
      warnings.push(
        `Duration inferred from ${appt.service || 'service'} default — confirm before importing.`,
      )
    } else if (appt.needsDuration || appt.durationMinutes == null) {
      warnings.push('Select a duration before importing.')
    }
    if (appt.uncertainFields?.length) {
      warnings.push(`Needs review: ${appt.uncertainFields.join(', ')}`)
    }
    if (match.status === 'possible_duplicate') {
      warnings.push(matchLabel(match))
    }

    const outsideHours =
      appt.date &&
      appt.startTime &&
      appt.durationMinutes != null &&
      isOutsideNormalHours(appt.date, appt.startTime, appt.durationMinutes)

    if (outsideHours) {
      warnings.push(
        'Outside regular salon hours — confirm to allow (same as Book).',
      )
    }

    return {
      ...appt,
      linkedClientId,
      clientAction,
      match,
      matchLabel: matchLabel(match),
      warnings,
      outsideHours: Boolean(outsideHours),
      allowOutsideHours: Boolean(appt.allowOutsideHours) || false,
      conflict: null,
      conflictMessage: null,
      duplicateOf: null,
      blocking: false,
    }
  })

  // Detect batch duplicates + conflicts against existing + other selected rows
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    if (!row.selected) continue

    if (row.needsDate || !row.date || row.durationMinutes == null || !row.startTime) {
      row.blocking = true
    }

    if (!row.date || !row.startTime || row.durationMinutes == null) continue

    // Existing calendar conflicts
    const existingHits = findConflicts(
      {
        date: row.date,
        startTime: row.startTime,
        durationMinutes: Number(row.durationMinutes),
      },
      existingAppointments,
    )

    // Exact-looking duplicates on existing calendar
    const existingDup = existingAppointments.find((existing) =>
      isLikelyDuplicate(
        {
          date: row.date,
          startTime: row.startTime,
          durationMinutes: row.durationMinutes,
          clientName: row.clientName,
          linkedClientId: row.linkedClientId,
          clientId: row.linkedClientId,
        },
        {
          date: existing.date,
          startTime: existing.startTime,
          durationMinutes: existing.durationMinutes,
          clientName: existing.clientName,
          clientId: existing.clientId,
        },
      ),
    )

    if (existingDup) {
      row.duplicateOf = existingDup.id
      row.conflictMessage = `Looks like a duplicate of an existing appointment (${describeConflict(existingDup)}).`
      row.blocking = true
      row.warnings = [...row.warnings, row.conflictMessage]
    } else if (existingHits.length > 0) {
      row.conflict = existingHits[0]
      row.conflictMessage = describeConflict(existingHits[0])
      row.blocking = true
      row.warnings = [
        ...row.warnings,
        `Conflicts with existing: ${row.conflictMessage}`,
      ]
    }

    // Conflicts / duplicates within the same import batch
    for (let j = 0; j < i; j += 1) {
      const other = rows[j]
      if (!other.selected) continue
      if (!other.date || !other.startTime || other.durationMinutes == null) continue

      if (
        isLikelyDuplicate(
          {
            date: row.date,
            startTime: row.startTime,
            durationMinutes: row.durationMinutes,
            clientName: row.clientName,
            linkedClientId: row.linkedClientId,
          },
          {
            date: other.date,
            startTime: other.startTime,
            durationMinutes: other.durationMinutes,
            clientName: other.clientName,
            linkedClientId: other.linkedClientId,
          },
        )
      ) {
        row.duplicateOf = other.tempId
        row.conflictMessage = 'Duplicate of another appointment in this import.'
        row.blocking = true
        row.warnings = [...row.warnings, row.conflictMessage]
        break
      }

      const startA = parseTimeToMinutes(row.startTime)
      const startB = parseTimeToMinutes(other.startTime)
      if (startA == null || startB == null) continue
      if (row.date !== other.date) continue
      const endA = startA + Number(row.durationMinutes)
      const endB = startB + Number(other.durationMinutes)
      if (startA < endB && startB < endA) {
        row.conflict = { tempId: other.tempId, clientName: other.clientName }
        row.conflictMessage = `Overlaps another appointment in this import (${other.clientName || 'unnamed'}).`
        row.blocking = true
        row.warnings = [...row.warnings, row.conflictMessage]
        break
      }
    }

    // Working-hours validation (informational unless stylist hasn't approved)
    if (row.outsideHours && !row.allowOutsideHours) {
      row.blocking = true
    }

    // Soft validate slot shape
    if (row.date && row.startTime && row.durationMinutes != null) {
      const slot = validateAppointmentSlot(
        {
          date: row.date,
          startTime: row.startTime,
          durationMinutes: Number(row.durationMinutes),
        },
        existingAppointments,
        { ignoreWorkingHours: true },
      )
      if (!slot.ok && slot.code === 'conflict' && !row.conflictMessage) {
        row.blocking = true
        row.conflictMessage = slot.detail || slot.message
        row.warnings = [...row.warnings, row.conflictMessage]
      }
    }
  }

  return {
    appointments: rows,
    clients: enrichedClients,
  }
}

export function appointmentCanImport(row) {
  if (!row?.selected) return false
  if (!row.date || !row.startTime) return false
  if (row.durationMinutes == null || !Number.isFinite(Number(row.durationMinutes))) {
    return false
  }
  if (row.blocking && (row.conflictMessage || row.duplicateOf)) return false
  if (row.outsideHours && !row.allowOutsideHours) return false
  if (!collapseWhitespace(row.clientName) && !row.linkedClientId) return false
  return true
}

export function displayClientForAppointment(row, existingClients = []) {
  if (row.linkedClientId) {
    const found = existingClients.find((c) => c.id === row.linkedClientId)
    if (found) return getClientDisplayName(found)
  }
  return (
    collapseWhitespace(row.clientName) ||
    buildDisplayName(row.clientFirstName, row.clientLastName) ||
    'New client'
  )
}
