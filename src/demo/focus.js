let focus = null
let stylistFocus = null
const customerListeners = new Set()
const stylistListeners = new Set()

function notify(listeners, value) {
  listeners.forEach((listener) => listener(value))
}

export function focusCustomerAppointment(appointmentId, mode = 'manage') {
  focus = { appointmentId, mode }
  notify(customerListeners, focus)
}

export function peekCustomerFocus() {
  return focus
}

export function takeCustomerFocus() {
  const current = focus
  focus = null
  return current
}

export function subscribeCustomerFocus(listener) {
  customerListeners.add(listener)
  return () => customerListeners.delete(listener)
}

export function focusStylistView({ tab = 'calendar', dateKey = '', clientId = '' } = {}) {
  stylistFocus = { tab, dateKey, clientId }
  notify(stylistListeners, stylistFocus)
}

export function peekStylistFocus() {
  return stylistFocus
}

export function takeStylistFocus() {
  const current = stylistFocus
  stylistFocus = null
  return current
}

export function subscribeStylistFocus(listener) {
  stylistListeners.add(listener)
  return () => stylistListeners.delete(listener)
}
