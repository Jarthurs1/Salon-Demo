/**
 * Confirmation token generate / hash (SHA-256).
 * Raw token is never persisted — only tokenHash (+ optional tokenNonce for HMAC recovery).
 *
 * When CONFIRMATION_SIGNING_SECRET is set, raw = HMAC(secret, appointmentId:nonce)
 * so the same confirmation URL can be rebuilt for 7/3/1-day emails.
 */

import { createHash, createHmac, randomBytes } from 'node:crypto'

const TOKEN_BYTES = 32
const NONCE_BYTES = 16

export function generateConfirmationToken() {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

export function generateTokenNonce() {
  return randomBytes(NONCE_BYTES).toString('base64url')
}

export function deriveConfirmationToken(appointmentId, nonce, signingSecret) {
  if (!signingSecret || !appointmentId || !nonce) return null
  return createHmac('sha256', signingSecret)
    .update(`${appointmentId}:${nonce}`, 'utf8')
    .digest('base64url')
}

export function hashConfirmationToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null
  return createHash('sha256').update(rawToken, 'utf8').digest('hex')
}

export function normalizeConfirmationUrlAction(action = 'confirm') {
  const raw = String(action || 'confirm').trim().toLowerCase()
  if (raw === 'reschedule' || raw === 'request_reschedule') return 'reschedule'
  if (raw === 'cancel') return 'cancel'
  if (raw === 'cancel_confirm' || raw === 'confirm_cancel') return 'cancel_confirm'
  if (raw === 'keep') return 'keep'
  return 'confirm'
}

export function buildConfirmationUrl(baseUrl, rawToken, action = 'confirm') {
  const base = String(baseUrl || '').replace(/\/$/, '')
  if (!base || !rawToken) return null
  const normalizedAction = normalizeConfirmationUrlAction(action)
  return `${base}/confirm?token=${encodeURIComponent(rawToken)}&action=${normalizedAction}`
}

export function tokensMatch(rawToken, storedHash) {
  const hashed = hashConfirmationToken(rawToken)
  if (!hashed || !storedHash) return false
  return hashed === storedHash
}
