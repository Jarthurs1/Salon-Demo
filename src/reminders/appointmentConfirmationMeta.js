/**
 * Appointment confirmation / reminder / SMS metadata helpers (browser-safe).
 * Token generation lives in ensureConfirmationToken.js (Node/Lambda only).
 */

export function emptyConfirmation() {
  return {
    tokenHash: null,
    tokenNonce: null,
    confirmedAt: null,
    rescheduleRequestedAt: null,
    canceledAt: null,
  }
}

/** Per-interval, per-channel delivery stamps (email / sms). */
export function emptyReminderChannelMap() {
  return {
    '1': { email: null, sms: null },
    '2': { email: null, sms: null },
    '7': { email: null, sms: null },
  }
}

/**
 * Per-interval delivery timestamps. Legacy threeDaySentAt kept for old records.
 * byChannel tracks email/sms independently so retries do not duplicate a channel.
 */
export function emptyReminders() {
  return {
    sevenDaySentAt: null,
    threeDaySentAt: null,
    twoDaySentAt: null,
    oneDaySentAt: null,
    byChannel: emptyReminderChannelMap(),
  }
}

export function emptySmsMeta() {
  return {
    conversationId: null,
    outboundMessageId: null,
    outboundSentAt: null,
    phoneE164: null,
    confirmedVia: null,
    lastInboundAt: null,
    lastInboundBody: null,
    acknowledgmentSentAt: null,
  }
}

export function normalizeConfirmationMeta(appointment) {
  const confirmation = {
    ...emptyConfirmation(),
    ...(appointment?.confirmation && typeof appointment.confirmation === 'object'
      ? appointment.confirmation
      : {}),
  }
  const rawReminders =
    appointment?.reminders && typeof appointment.reminders === 'object'
      ? appointment.reminders
      : {}
  const reminders = {
    ...emptyReminders(),
    ...rawReminders,
    byChannel: {
      ...emptyReminderChannelMap(),
      ...(rawReminders.byChannel && typeof rawReminders.byChannel === 'object'
        ? rawReminders.byChannel
        : {}),
    },
  }
  const sms = {
    ...emptySmsMeta(),
    ...(appointment?.sms && typeof appointment.sms === 'object' ? appointment.sms : {}),
  }
  return { confirmation, reminders, sms }
}

/** True when reserved slot timing changed. */
export function didScheduleChange(previous, next) {
  if (!previous || !next) return false
  return (
    previous.date !== next.date ||
    previous.startTime !== next.startTime ||
    Number(previous.durationMinutes) !== Number(next.durationMinutes)
  )
}

/**
 * Fields that invalidate confirmation when changed after confirm/reschedule request:
 * date, startTime, durationMinutes.
 */
export function shouldInvalidateConfirmation(previous, next) {
  if (!previous) return false
  const wasActive =
    previous.status === 'confirmed' ||
    previous.status === 'reschedule_requested' ||
    Boolean(previous.confirmation?.confirmedAt) ||
    Boolean(previous.confirmation?.rescheduleRequestedAt)
  if (!wasActive) return false
  return didScheduleChange(previous, next)
}

/**
 * After Rozie changes the appointment time (or clears a reschedule request via
 * time edit), reset confirmation/reminder state so a fresh reminder can be sent.
 */
export function resetConfirmationForReschedule(appointment) {
  return {
    ...appointment,
    status: 'pending',
    confirmation: emptyConfirmation(),
    reminders: emptyReminders(),
    sms: emptySmsMeta(),
  }
}

export function applyManualConfirm(appointment, atIso = new Date().toISOString()) {
  const { confirmation, reminders, sms } = normalizeConfirmationMeta(appointment)
  return {
    ...appointment,
    status: 'confirmed',
    confirmation: {
      ...confirmation,
      confirmedAt: confirmation.confirmedAt || atIso,
      rescheduleRequestedAt: null,
    },
    reminders,
    sms: {
      ...sms,
      confirmedVia: sms.confirmedVia || 'manual',
    },
  }
}

export function applySmsConfirm(appointment, atIso = new Date().toISOString(), extras = {}) {
  const { confirmation, reminders, sms } = normalizeConfirmationMeta(appointment)
  return {
    ...appointment,
    status: 'confirmed',
    confirmation: {
      ...confirmation,
      confirmedAt: confirmation.confirmedAt || atIso,
      rescheduleRequestedAt: null,
    },
    reminders,
    sms: {
      ...sms,
      confirmedVia: 'sms',
      lastInboundAt: extras.lastInboundAt || atIso,
      lastInboundBody: extras.lastInboundBody ?? sms.lastInboundBody,
    },
  }
}

export function applyLinkConfirm(appointment, atIso = new Date().toISOString()) {
  const { confirmation, reminders, sms } = normalizeConfirmationMeta(appointment)
  return {
    ...appointment,
    status: 'confirmed',
    confirmation: {
      ...confirmation,
      confirmedAt: confirmation.confirmedAt || atIso,
      rescheduleRequestedAt: null,
    },
    reminders,
    sms: {
      ...sms,
      confirmedVia: sms.confirmedVia || 'link',
    },
  }
}

export function applyRescheduleRequest(appointment, atIso = new Date().toISOString()) {
  const { confirmation, reminders, sms } = normalizeConfirmationMeta(appointment)
  return {
    ...appointment,
    status: 'reschedule_requested',
    confirmation: {
      ...confirmation,
      rescheduleRequestedAt: confirmation.rescheduleRequestedAt || atIso,
      // Keep confirmedAt null — this is not a confirmation
      confirmedAt: null,
    },
    reminders,
    sms,
  }
}

/**
 * Soft-cancel: keep the record and hold the original calendar slot until the
 * stylist explicitly releases it (slotReleasedAt).
 */
export function applyCancelAppointment(appointment, atIso = new Date().toISOString()) {
  const { confirmation, reminders, sms } = normalizeConfirmationMeta(appointment)
  return {
    ...appointment,
    status: 'canceled',
    canceledAt: appointment.canceledAt || atIso,
    // null = still occupies the calendar slot (not the same as missing/legacy).
    slotReleasedAt: null,
    confirmation: {
      ...confirmation,
      canceledAt: confirmation.canceledAt || atIso,
      // Preserve prior confirm/reschedule stamps for history; status drives behavior.
    },
    reminders,
    sms,
  }
}

/**
 * @param {number|string} reminderType 7 | 3 | 2 | 1 | '24h'
 * '24h' maps to oneDaySentAt for schema compatibility.
 */
export function reminderSentField(reminderType) {
  if (reminderType === 7) return 'sevenDaySentAt'
  if (reminderType === 3) return 'threeDaySentAt'
  if (reminderType === 2) return 'twoDaySentAt'
  if (reminderType === 1 || reminderType === '24h') return 'oneDaySentAt'
  return null
}

export function reminderIntervalKey(reminderType) {
  if (reminderType === '24h' || reminderType === 1) return '1'
  if (reminderType === 2) return '2'
  if (reminderType === 7) return '7'
  if (reminderType === 3) return '3'
  return null
}

/**
 * True when this channel already delivered for the interval.
 * A legacy interval stamp (without needing channel detail) closes the interval
 * for every channel so settings changes cannot re-fire old reminders.
 */
export function isIntervalChannelSent(reminders, reminderType, channel) {
  const field = reminderSentField(reminderType)
  if (field && reminders?.[field]) return true
  const key = reminderIntervalKey(reminderType)
  if (!key || (channel !== 'email' && channel !== 'sms')) return false
  return Boolean(reminders?.byChannel?.[key]?.[channel])
}

export function isIntervalFullySent(reminders, reminderType) {
  const field = reminderSentField(reminderType)
  return Boolean(field && reminders?.[field])
}
