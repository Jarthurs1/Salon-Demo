function blocked() {
  throw new Error('Salon Demo does not contact the live account service.')
}

export const loginRequest = blocked
export const logoutRequest = blocked
export const fetchCurrentUser = blocked
export const changePasswordRequest = blocked
export const completeHelpGuideRequest = blocked
