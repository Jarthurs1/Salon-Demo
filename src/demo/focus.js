let focus = null
let stylistFocus = null

export function focusCustomerAppointment(appointmentId, mode = 'manage') {
  focus = { appointmentId, mode }
}

export function takeCustomerFocus() {
  const current = focus
  focus = null
  return current
}

export function focusStylistView({ tab = 'calendar', dateKey = '', clientId = '' } = {}) {
  stylistFocus = { tab, dateKey, clientId }
}

export function takeStylistFocus() {
  const current = stylistFocus
  stylistFocus = null
  return current
}
