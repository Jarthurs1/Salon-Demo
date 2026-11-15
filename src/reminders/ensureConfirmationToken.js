/**
 * Ensure a confirmation token hash exists (Node / Lambda only).
 *
 * With signingSecret: raw token is recoverable via HMAC(secret, id:nonce)
 * so 7/3/1-day emails can share one confirmation link without storing the raw token.
 */

import {
  generateConfirmationToken,
  generateTokenNonce,
  deriveConfirmationToken,
  hashConfirmationToken,
} from './confirmationTokens.js'
import {
  normalizeConfirmationMeta,
  emptyConfirmation,
} from './appointmentConfirmationMeta.js'

/**
 * @returns {{ appointment: object, rawToken: string | null, created: boolean }}
 */
export function ensureConfirmationToken(appointment, options = {}) {
  const signingSecret = options.signingSecret || process.env.CONFIRMATION_SIGNING_SECRET || ''
  const { confirmation, reminders } = normalizeConfirmationMeta(appointment)

  if (confirmation.tokenHash && confirmation.tokenNonce && signingSecret) {
    const rawToken = deriveConfirmationToken(
      appointment.id,
      confirmation.tokenNonce,
      signingSecret,
    )
    return {
      appointment: { ...appointment, confirmation, reminders },
      rawToken,
      created: false,
    }
  }

  if (confirmation.tokenHash && !signingSecret) {
    // Hash exists but we cannot rebuild raw without a signing secret.
    return {
      appointment: { ...appointment, confirmation, reminders },
      rawToken: null,
      created: false,
    }
  }

  if (signingSecret) {
    const tokenNonce = generateTokenNonce()
    const rawToken = deriveConfirmationToken(appointment.id, tokenNonce, signingSecret)
    return {
      appointment: {
        ...appointment,
        confirmation: {
          ...emptyConfirmation(),
          ...confirmation,
          tokenNonce,
          tokenHash: hashConfirmationToken(rawToken),
          confirmedAt: confirmation.confirmedAt ?? null,
        },
        reminders,
      },
      rawToken,
      created: true,
    }
  }

  const rawToken = generateConfirmationToken()
  return {
    appointment: {
      ...appointment,
      confirmation: {
        ...emptyConfirmation(),
        ...confirmation,
        tokenHash: hashConfirmationToken(rawToken),
        confirmedAt: confirmation.confirmedAt ?? null,
      },
      reminders,
    },
    rawToken,
    created: true,
  }
}
