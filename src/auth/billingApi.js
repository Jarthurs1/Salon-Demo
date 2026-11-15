function blocked() {
  throw new Error('Salon Demo does not contact Stripe or a live billing service.')
}

export const getMyBillingRequest = blocked
export const createMyBillingPortalRequest = blocked
