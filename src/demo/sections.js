export const DEMO_SECTIONS = [
  ['stylist', 'Stylist Experience'],
  ['customer', 'Customer Experience'],
  ['cards', 'Card Setup'],
  ['inbox', 'Emails & Payments'],
  ['sms', 'SMS Preview'],
]

export function scrollToDemoSection(id) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById(id)?.scrollIntoView({
    behavior: reduced ? 'auto' : 'smooth',
    block: 'start',
  })
}
