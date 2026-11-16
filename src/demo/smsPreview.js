export const SMS_REMINDER = 'Hi Emily! This is Lumen & Co. reminding you about your haircut tomorrow at 9:00 AM.\n\nPlease confirm your appointment or manage it using the link below.'

export const SMS_YES = 'YES'

export const SMS_CONFIRMED = 'Thanks Emily! Your appointment is confirmed. We look forward to seeing you!'

export const SMS_RESCHEDULE_REPLY = "We've notified your stylist. Your original appointment remains scheduled until your stylist approves a new time."

const REMINDER = { from: 'salon', text: SMS_REMINDER }
const YES = { from: 'customer', text: SMS_YES }
const CONFIRMED = { from: 'salon', text: SMS_CONFIRMED }

export function messagesFor(phase) {
  if (phase === 'yes-wait') return [REMINDER, YES]
  if (phase === 'yes-done' || phase === 'confirmed') return [REMINDER, YES, CONFIRMED]
  return [REMINDER]
}

export function conversationFor(status) {
  if (status === 'reschedule_requested') {
    return [REMINDER, { from: 'salon', text: SMS_RESCHEDULE_REPLY }]
  }
  if (status === 'confirmed' || status === 'paid') return messagesFor('confirmed')
  return messagesFor('start')
}

export function statusFor(phase) {
  if (phase === 'yes-done' || phase === 'confirmed') return 'confirmed'
  return 'pending'
}

export const SMS_STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  reschedule_requested: 'Reschedule Requested',
}
