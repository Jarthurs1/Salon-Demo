/**
 * Persist reviewed photo-import drafts through existing repositories.
 * Never opts clients into SMS. Preserves existing smsConsent on link/update.
 * Never sends confirmation email/SMS. Imports appointments as pending by default.
 */

import {
  createClient,
  updateClient,
  getClientById,
} from '../services/clientRepository.js'
import {
  createAppointment,
  getAppointments,
} from '../services/appointmentRepository.js'
import { emptySmsConsent } from '../reminders/smsConsent.js'
import { collapseWhitespace, buildDisplayName } from '../utils/clientUtils.js'
import { isValidTimeString } from '../utils/dateUtils.js'
import {
  findConflicts,
  validateAppointmentSlot,
  describeConflict,
} from '../utils/conflictUtils.js'

function defaultSmsConsent() {
  return emptySmsConsent()
}

function fillIfEmpty(current, incoming) {
  const cur = collapseWhitespace(current)
  const next = collapseWhitespace(incoming)
  if (cur) return cur
  return next || ''
}

/**
 * @returns {Promise<{
 *   clientsCreated: number,
 *   clientsLinked: number,
 *   clientsUpdated: number,
 *   appointmentsCreated: number,
 *   skipped: number,
 *   errors: string[],
 * }>}
 */
export async function savePhotoImport({
  clients = [],
  appointments = [],
  createClientFn = createClient,
  updateClientFn = updateClient,
  getClientByIdFn = getClientById,
  createAppointmentFn = createAppointment,
  getAppointmentsFn = getAppointments,
} = {}) {
  const summary = {
    clientsCreated: 0,
    clientsLinked: 0,
    clientsUpdated: 0,
    appointmentsCreated: 0,
    skipped: 0,
    errors: [],
  }

  /** Newly created appointments in this batch — used for intra-import conflict checks. */
  const createdInBatch = []
  const existingAppointments = (() => {
    try {
      return getAppointmentsFn() || []
    } catch {
      return []
    }
  })()

  /** @type {Map<string, string>} tempId → real client id */
  const tempToReal = new Map()

  for (const draft of clients) {
    if (!draft?.selected || draft.action === 'skip') {
      summary.skipped += 1
      continue
    }

    const firstName = collapseWhitespace(draft.firstName)
    const lastName = collapseWhitespace(draft.lastName)
    if (!firstName && draft.action === 'create') {
      summary.errors.push('Skipped a client with no first name.')
      summary.skipped += 1
      continue
    }

    try {
      if (draft.action === 'link' && draft.linkedClientId) {
        const existing = getClientByIdFn(draft.linkedClientId)
        if (!existing) {
          summary.errors.push(`Could not find linked client for ${firstName || 'import'}.`)
          summary.skipped += 1
          continue
        }

        const patch = {
          phone: fillIfEmpty(existing.phone, draft.phone),
          email: fillIfEmpty(existing.email, draft.email),
          notes: fillIfEmpty(existing.notes, draft.notes),
          // Explicitly preserve consent — do not pass smsConsent from import
        }
        const phoneChanged = patch.phone !== existing.phone
        const emailChanged = patch.email !== existing.email
        const notesChanged = patch.notes !== existing.notes
        if (phoneChanged || emailChanged || notesChanged) {
          await updateClientFn(existing.id, patch)
          summary.clientsUpdated += 1
        } else {
          summary.clientsLinked += 1
        }
        tempToReal.set(draft.tempId, existing.id)
      } else {
        const created = await createClientFn(
          {
            firstName: firstName || 'Client',
            lastName,
            phone: draft.phone || '',
            email: draft.email || '',
            notes: draft.notes || '',
            smsConsent: defaultSmsConsent(),
          },
          { allowDuplicate: true },
        )
        tempToReal.set(draft.tempId, created.id)
        summary.clientsCreated += 1
      }
    } catch (error) {
      summary.errors.push(error?.message || 'Could not save a client.')
      summary.skipped += 1
    }
  }

  for (const draft of appointments) {
    if (!draft?.selected) {
      summary.skipped += 1
      continue
    }

    const date = collapseWhitespace(draft.date)
    const startTime = collapseWhitespace(draft.startTime)
    if (!date || !isValidTimeString(startTime)) {
      summary.errors.push(
        `Skipped appointment for ${draft.clientName || 'client'} — needs a valid date and time.`,
      )
      summary.skipped += 1
      continue
    }

    let clientId = draft.linkedClientId || null
    if (!clientId && draft.clientTempId) {
      clientId = tempToReal.get(draft.clientTempId) || null
    }

    let clientName =
      collapseWhitespace(draft.clientName) ||
      buildDisplayName(draft.clientFirstName, draft.clientLastName)

    if (clientId) {
      const linked = getClientByIdFn(clientId)
      if (linked) {
        clientName = buildDisplayName(linked.firstName, linked.lastName) || clientName
      }
    }

    // Appointment without a known client: create a lightweight client if we have a name
    if (!clientId) {
      const nameParts = clientName
        ? {
            firstName: collapseWhitespace(draft.clientFirstName) || clientName.split(/\s+/)[0],
            lastName:
              collapseWhitespace(draft.clientLastName) ||
              clientName.split(/\s+/).slice(1).join(' '),
          }
        : null

      if (!nameParts?.firstName) {
        summary.errors.push(`Skipped appointment on ${date} — no client name.`)
        summary.skipped += 1
        continue
      }

      try {
        const created = await createClientFn(
          {
            ...nameParts,
            phone: draft.phone || '',
            email: '',
            notes: '',
            smsConsent: defaultSmsConsent(),
          },
          { allowDuplicate: true },
        )
        clientId = created.id
        clientName = buildDisplayName(created.firstName, created.lastName)
        summary.clientsCreated += 1
      } catch (error) {
        summary.errors.push(error?.message || 'Could not create client for appointment.')
        summary.skipped += 1
        continue
      }
    }

    const durationMinutes = Number(draft.durationMinutes)
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      summary.errors.push(
        `Skipped appointment for ${clientName} — choose a duration before saving.`,
      )
      summary.skipped += 1
      continue
    }

    if (draft.blocking && (draft.conflictMessage || draft.duplicateOf)) {
      summary.errors.push(
        `Skipped appointment for ${clientName} — resolve the conflict first.`,
      )
      summary.skipped += 1
      continue
    }

    const candidate = {
      date,
      startTime,
      durationMinutes,
      clientName,
      clientId,
    }

    const against = [...existingAppointments, ...createdInBatch]
    const duplicates = against.filter(
      (existing) =>
        existing.date === date &&
        existing.startTime === startTime &&
        Number(existing.durationMinutes) === durationMinutes &&
        (existing.clientId === clientId ||
          collapseWhitespace(existing.clientName).toLowerCase() ===
            clientName.toLowerCase()),
    )
    if (duplicates.length > 0) {
      summary.errors.push(
        `Skipped duplicate appointment for ${clientName} on ${date} at ${startTime}.`,
      )
      summary.skipped += 1
      continue
    }

    const conflicts = findConflicts(candidate, against)
    if (conflicts.length > 0) {
      summary.errors.push(
        `Skipped appointment for ${clientName} — ${describeConflict(conflicts[0])}`,
      )
      summary.skipped += 1
      continue
    }

    // Outside hours: require explicit approval on the review row (Book allows freely).
    if (draft.outsideHours && !draft.allowOutsideHours) {
      summary.errors.push(
        `Skipped appointment for ${clientName} — approve outside hours first.`,
      )
      summary.skipped += 1
      continue
    }

    const slot = validateAppointmentSlot(candidate, against, {
      ignoreWorkingHours: true,
    })
    if (!slot.ok && slot.code === 'conflict') {
      summary.errors.push(
        `Skipped appointment for ${clientName} — ${slot.detail || slot.message}`,
      )
      summary.skipped += 1
      continue
    }

    const statusRaw = String(draft.status || 'pending').toLowerCase()
    const status =
      statusRaw === 'confirmed' || statusRaw === 'pending' ? statusRaw : 'pending'

    try {
      const created = await createAppointmentFn({
        type: 'appointment',
        clientId,
        clientName,
        date,
        startTime,
        durationMinutes,
        service: collapseWhitespace(draft.service) || 'Appointment',
        status,
        notes: String(draft.notes ?? '').trim(),
        // Do not set confirmation / reminder / sms flags — preserve opt-in rules.
      })
      createdInBatch.push({
        ...candidate,
        id: created?.id || `batch-${createdInBatch.length + 1}`,
      })
      summary.appointmentsCreated += 1
    } catch (error) {
      summary.errors.push(error?.message || `Could not save appointment for ${clientName}.`)
      summary.skipped += 1
    }
  }

  return summary
}
