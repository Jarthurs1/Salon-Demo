/**
 * Conversation routing for SMS ↔ email bridge (S3-backed, no DynamoDB).
 *
 * Conversations are stored at data/sms-conversations.json:
 * {
 *   version: 1,
 *   updatedAt,
 *   conversations: [{ id, phoneE164, appointmentId, clientId, outboundMessageId,
 *                     bridgeLocalPart, lastActivityAt, createdAt }]
 * }
 */

import { normalizeUsE164 } from './smsConsent.js'
import { normalizeConfirmationMeta } from './appointmentConfirmationMeta.js'

export function createConversationId() {
  const bytes = new Uint8Array(8)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  return `smsconv-${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

/** Local-part for reply routing: sms+{conversationId}@{domain} */
export function bridgeLocalPart(conversationId) {
  return `sms+${String(conversationId).replace(/[^a-zA-Z0-9_-]/g, '')}`
}

export function parseBridgeLocalPart(localPart) {
  const raw = String(localPart || '').trim()
  const match = /^sms\+([a-zA-Z0-9_-]+)$/i.exec(raw)
  return match ? match[1] : null
}

export function buildBridgeAddress(conversationId, emailDomain) {
  const domain = String(emailDomain || '').replace(/^@/, '').trim()
  if (!domain || !conversationId) return null
  return `${bridgeLocalPart(conversationId)}@${domain}`
}

export function emptyConversationStore() {
  return { version: 1, updatedAt: null, conversations: [] }
}

export function upsertConversation(store, entry) {
  const base = store && Array.isArray(store.conversations)
    ? store
    : emptyConversationStore()
  const conversations = [...base.conversations]
  const idx = conversations.findIndex((c) => c.id === entry.id)
  if (idx === -1) conversations.push(entry)
  else conversations[idx] = { ...conversations[idx], ...entry }
  return {
    ...base,
    updatedAt: new Date().toISOString(),
    conversations,
  }
}

export function findConversationById(store, conversationId) {
  return (store?.conversations || []).find((c) => c.id === conversationId) || null
}

export function findConversationByOutboundMessageId(store, messageId) {
  if (!messageId) return null
  return (store?.conversations || []).find((c) => c.outboundMessageId === messageId) || null
}

export function findConversationByPhone(store, phoneE164) {
  const phone = normalizeUsE164(phoneE164)
  if (!phone) return null
  const matches = (store?.conversations || [])
    .filter((c) => normalizeUsE164(c.phoneE164) === phone)
    .sort((a, b) => String(b.lastActivityAt || '').localeCompare(String(a.lastActivityAt || '')))
  return matches[0] || null
}

/**
 * Attach outbound SMS tracking onto an appointment after a successful (or dry-run) send.
 */
export function attachOutboundSmsMeta(appointment, {
  conversationId,
  outboundMessageId,
  phoneE164,
  atIso,
  automatedSendCount,
}) {
  const { confirmation, reminders, sms } = normalizeConfirmationMeta(appointment)
  return {
    ...appointment,
    confirmation,
    reminders,
    sms: {
      ...sms,
      conversationId: conversationId || sms.conversationId,
      outboundMessageId: outboundMessageId || sms.outboundMessageId,
      outboundSentAt: atIso != null ? atIso : sms.outboundSentAt,
      phoneE164: normalizeUsE164(phoneE164) || sms.phoneE164,
      automatedSendCount:
        automatedSendCount != null
          ? Number(automatedSendCount) || 0
          : sms.automatedSendCount || 0,
    },
  }
}

export function isAuthorizedRozieSender(fromEmail, allowedEmails) {
  const from = String(fromEmail || '').trim().toLowerCase()
  if (!from) return false
  const allowed = (Array.isArray(allowedEmails) ? allowedEmails : [allowedEmails])
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(from)
}
