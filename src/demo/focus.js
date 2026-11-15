let focus = null

export function focusCustomerAppointment(appointmentId, mode = 'manage') {
  focus = { appointmentId, mode }
}

export function takeCustomerFocus() {
  const current = focus
  focus = null
  return current
}
