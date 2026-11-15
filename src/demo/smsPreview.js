export const SMS_REMINDER = 'Hi Emily! This is Lumen & Co. reminding you about your haircut tomorrow at 9:00 AM. Reply YES to confirm, or use the link to manage your appointment.'

export const SMS_YES = 'YES'

export const SMS_CONFIRMED = 'Thanks Emily! Your appointment is confirmed. We look forward to seeing you!'

export const SMS_RESCHEDULE_ASK = 'Could I move my haircut to a later time tomorrow?'

export const SMS_RESCHEDULE_REPLY = "We've notified your stylist. Your original appointment remains scheduled until your stylist approves a new time."

const REMINDER = { from: 'salon', text: SMS_REMINDER }
const YES = { from: 'customer', text: SMS_YES }
const CONFIRMED = { from: 'salon', text: SMS_CONFIRMED }
const ASK = { from: 'customer', text: SMS_RESCHEDULE_ASK }
const REPLY = { from: 'salon', text: SMS_RESCHEDULE_REPLY }

export function messagesFor(phase) {
  if (phase === 'yes-wait') return [REMINDER, YES]
  if (phase === 'yes-done') return [REMINDER, YES, CONFIRMED]
  if (phase === 'reschedule') return [REMINDER, ASK, REPLY]
  return [REMINDER]
}

export function statusFor(phase) {
  if (phase === 'yes-done') return 'confirmed'
  if (phase === 'reschedule') return 'reschedule_requested'
  return 'pending'
}

export const SMS_STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  reschedule_requested: 'Reschedule Requested',
}
