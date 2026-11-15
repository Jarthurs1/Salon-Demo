/**
 * Normalize / sanitize AI vision extraction. Never invent missing fields.
 */

import {
  collapseWhitespace,
  splitFullName,
  normalizeEmail,
  isValidEmail,
  digitsOnly,
} from '../utils/clientUtils.js'
import {
  normalizeTimeTo24h,
  isValidTimeString,
  parseTimeToMinutes,
} from '../utils/dateUtils.js'
import {
  SERVICE_OPTIONS,
  getDefaultDurationForService,
  getServiceByLabel,
} from '../data/services.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function cleanUncertain(fields) {
  return asArray(fields)
    .map((f) => String(f || '').trim())
    .filter(Boolean)
}

function normalizeConfidence(value) {
  const raw = String(value || '').toLowerCase()
  if (raw === 'high' || raw === 'medium' || raw === 'low') return raw
  return 'medium'
}

function normalizePhone(value) {
  const raw = collapseWhitespace(value)
  if (!raw) return ''
  const digits = digitsOnly(raw)
  if (digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))) {
    return raw
  }
  // Keep partial handwritten numbers for the stylist to fix — do not invent digits
  return raw
}

function normalizeDate(value) {
  const raw = collapseWhitespace(value)
  if (!raw) return ''
  if (DATE_RE.test(raw)) return raw
  return ''
}

function normalizeDurationValue(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  const rounded = Math.round(n)
  if (rounded < 15 || rounded > 480) return null
  return rounded
}

function resolveServiceLabel(service) {
  const raw = collapseWhitespace(service)
  if (!raw) return ''
  const exact = getServiceByLabel(raw)
  if (exact) return exact.label
  const lower = raw.toLowerCase()
  const ci = SERVICE_OPTIONS.find((s) => s.label.toLowerCase() === lower)
  return ci ? ci.label : raw
}

function makeTempId(prefix, index) {
  return `${prefix}-${index + 1}`
}

/**
 * Resolve duration without inventing when uncertain.
 * @returns {{
 *   durationMinutes: number|null,
 *   durationSource: 'visible'|'inferred_service'|null,
 *   durationInferred: boolean,
 *   needsDuration: boolean,
 * }}
 */
export function resolveAppointmentDuration({
  durationMinutes,
  endTime,
  startTime,
  service,
  confidence,
} = {}) {
  const start = isValidTimeString(startTime) ? startTime : ''
  const endRaw = normalizeTimeTo24h(endTime) ?? collapseWhitespace(endTime)
  const end = isValidTimeString(endRaw) ? endRaw : ''

  const fromField = normalizeDurationValue(durationMinutes)
  if (fromField != null) {
    return {
      durationMinutes: fromField,
      durationSource: 'visible',
      durationInferred: false,
      needsDuration: false,
    }
  }

  if (start && end) {
    const startM = parseTimeToMinutes(start)
    const endM = parseTimeToMinutes(end)
    if (startM != null && endM != null && endM > startM) {
      const diff = endM - startM
      if (diff >= 15 && diff <= 480) {
        return {
          durationMinutes: diff,
          durationSource: 'visible',
          durationInferred: false,
          needsDuration: false,
        }
      }
    }
  }

  const serviceLabel = collapseWhitespace(service)
  const known = getServiceByLabel(serviceLabel)
  const conf = normalizeConfidence(confidence)
  if (start && known && (conf === 'high' || conf === 'medium')) {
    return {
      durationMinutes: getDefaultDurationForService(known.label),
      durationSource: 'inferred_service',
      durationInferred: true,
      needsDuration: true,
    }
  }

  return {
    durationMinutes: null,
    durationSource: null,
    durationInferred: false,
    needsDuration: true,
  }
}

/**
 * @param {unknown} payload
 * @returns {{
 *   clients: object[],
 *   appointments: object[],
 *   warnings: string[],
 * }}
 */
export function normalizeExtractedImport(payload) {
  const source = payload && typeof payload === 'object' ? payload : {}
  const warnings = asArray(source.warnings)
    .map((w) => collapseWhitespace(w))
    .filter(Boolean)

  const clients = asArray(source.clients).map((raw, index) => {
    const row = raw && typeof raw === 'object' ? raw : {}
    let firstName = collapseWhitespace(row.firstName)
    let lastName = collapseWhitespace(row.lastName)
    if (!firstName && !lastName && row.name) {
      const split = splitFullName(row.name)
      firstName = split.firstName
      lastName = split.lastName
    }
    const emailRaw = collapseWhitespace(row.email)
    const email =
      emailRaw && isValidEmail(emailRaw)
        ? normalizeEmail(emailRaw)
        : emailRaw
          ? emailRaw
          : ''
    const uncertainFields = cleanUncertain(row.uncertainFields)
    if (emailRaw && !isValidEmail(emailRaw) && !uncertainFields.includes('email')) {
      uncertainFields.push('email')
    }

    return {
      tempId: collapseWhitespace(row.tempId) || makeTempId('client', index),
      firstName,
      lastName,
      phone: normalizePhone(row.phone),
      email,
      notes: String(row.notes ?? '').trim(),
      uncertainFields,
      confidence: normalizeConfidence(row.confidence),
      selected: true,
    }
  })

  const appointments = asArray(source.appointments).map((raw, index) => {
    const row = raw && typeof raw === 'object' ? raw : {}
    const serviceRaw = collapseWhitespace(row.service)
    const service = resolveServiceLabel(serviceRaw) || serviceRaw
    const startTimeRaw =
      normalizeTimeTo24h(row.startTime) ?? collapseWhitespace(row.startTime)
    const startTime = isValidTimeString(startTimeRaw) ? startTimeRaw : ''
    const endTimeRaw =
      normalizeTimeTo24h(row.endTime) ?? collapseWhitespace(row.endTime)
    const endTime = isValidTimeString(endTimeRaw) ? endTimeRaw : ''
    const date = normalizeDate(row.date)
    const uncertainFields = cleanUncertain(row.uncertainFields)
    if (row.date && !date && !uncertainFields.includes('date')) {
      uncertainFields.push('date')
    }
    if (row.startTime && !startTime && !uncertainFields.includes('startTime')) {
      uncertainFields.push('startTime')
    }

    const durationInfo = resolveAppointmentDuration({
      durationMinutes: row.durationMinutes,
      endTime,
      startTime,
      service,
      confidence: row.confidence,
    })

    if (durationInfo.durationInferred && !uncertainFields.includes('duration')) {
      uncertainFields.push('duration')
    }
    if (!date && !uncertainFields.includes('date')) {
      uncertainFields.push('date')
    }
    if (durationInfo.needsDuration && durationInfo.durationMinutes == null) {
      if (!uncertainFields.includes('duration')) uncertainFields.push('duration')
    }

    const clientName = collapseWhitespace(row.clientName)
    let clientTempId = collapseWhitespace(row.clientTempId)
    if (!clientTempId && clientName) {
      const match = clients.find((c) => {
        const display = collapseWhitespace(`${c.firstName} ${c.lastName}`)
        return display.toLowerCase() === clientName.toLowerCase()
      })
      if (match) clientTempId = match.tempId
    }

    return {
      tempId: collapseWhitespace(row.tempId) || makeTempId('appt', index),
      date,
      startTime,
      endTime,
      clientTempId,
      clientName,
      phone: normalizePhone(row.phone),
      service,
      durationMinutes: durationInfo.durationMinutes,
      durationSource: durationInfo.durationSource,
      durationInferred: durationInfo.durationInferred,
      needsDuration: durationInfo.needsDuration,
      needsDate: !date,
      notes: String(row.notes ?? '').trim(),
      uncertainFields,
      confidence: normalizeConfidence(row.confidence),
      selected: true,
      status: 'pending',
      allowOutsideHours: false,
    }
  })

  // Drop completely empty client rows (no name and no contact)
  const filteredClients = clients.filter(
    (c) => c.firstName || c.lastName || c.phone || c.email || c.notes,
  )

  // Appointments need at least a date or a name/time cue to keep for review
  const filteredAppointments = appointments.filter(
    (a) => a.date || a.startTime || a.clientName || a.service || a.phone,
  )

  if (filteredClients.length === 0 && filteredAppointments.length === 0) {
    warnings.push('No appointments or clients could be read from this photo.')
  }

  return {
    clients: filteredClients,
    appointments: filteredAppointments,
    warnings,
  }
}
