export const SMS_YES = 'YES'

export const SMS_CONFIRMED = 'Thanks Emily! Your appointment is confirmed. See you tomorrow!'

export const SMS_RESCHEDULE_REPLY = "We've notified your stylist. Your original appointment remains scheduled until your stylist approves a new time."

export const SMS_MANAGE_LINE = 'Reply YES to confirm, or manage your appointment using the link below.'

export function salonOpening(kind = 'confirm', phrase = 'tomorrow at 9:00 AM') {
  const lead = kind === 'reminder'
    ? `Hi Emily! This is an automatic reminder that your haircut is ${phrase}.`
    : `Hi Emily! Just a reminder that your haircut is ${phrase}.`
  return `${lead} ${SMS_MANAGE_LINE}`
}

export function reminderPhrase(intervals, timeLabel = '9:00 AM') {
  const days = [...new Set(intervals || [])]
    .map((day) => Number(day))
    .filter((day) => day === 1 || day === 2 || day === 7)
    .sort((left, right) => left - right)
  const day = days[0] || 1
  return day === 1 ? `tomorrow at ${timeLabel}` : `in ${day} days at ${timeLabel}`
}

export function reminderBubbles(phrase = 'tomorrow at 9:00 AM', kind = 'confirm') {
  return [{ from: 'salon', text: salonOpening(kind, phrase), actions: true }]
}

const YES = { from: 'customer', text: SMS_YES }
const CONFIRMED = { from: 'salon', text: SMS_CONFIRMED }

export function messagesFor(phase, phrase, kind = 'confirm') {
  const reminder = reminderBubbles(phrase, kind)
  if (phase === 'yes-wait') return [...reminder, YES]
  if (phase === 'yes-done' || phase === 'confirmed') return [...reminder, YES, CONFIRMED]
  return reminder
}

export function conversationFor(status, phrase, kind = 'confirm') {
  const reminder = reminderBubbles(phrase, kind)
  if (status === 'reschedule_requested') {
    return [
      ...reminder,
      { from: 'customer', text: 'Can I come at a different time?' },
      { from: 'salon', text: SMS_RESCHEDULE_REPLY },
    ]
  }
  if (status === 'canceled') {
    return [
      ...reminder,
      { from: 'customer', text: 'Please cancel this appointment.' },
      { from: 'salon', text: 'Your appointment is canceled. The time is open on Mara’s calendar.' },
    ]
  }
  if (status === 'confirmed' || status === 'paid') return messagesFor('confirmed', phrase, kind)
  return messagesFor('start', phrase, kind)
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
