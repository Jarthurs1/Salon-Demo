/**
 * Centralized salon service catalog (small, realistic).
 */

export const SERVICE_OPTIONS = [
  { id: 'haircut', label: 'Haircut', defaultDurationMinutes: 45 },
  { id: 'haircut-style', label: 'Haircut & Style', defaultDurationMinutes: 60 },
  { id: 'color', label: 'Color', defaultDurationMinutes: 120 },
  { id: 'color-cut', label: 'Color & Cut', defaultDurationMinutes: 150 },
  { id: 'highlights', label: 'Highlights', defaultDurationMinutes: 150 },
  { id: 'blowout', label: 'Blowout', defaultDurationMinutes: 45 },
  { id: 'bridal-wedding', label: 'Bridal / Wedding', defaultDurationMinutes: 240 },
  { id: 'consultation', label: 'Consultation', defaultDurationMinutes: 30 },
  { id: 'other', label: 'Other', defaultDurationMinutes: 60 },
]

export const SERVICE_LABELS = SERVICE_OPTIONS.map((s) => s.label)

export function getServiceByLabel(label) {
  return SERVICE_OPTIONS.find((s) => s.label === label) ?? null
}

export function getDefaultDurationForService(label, fallback = 60) {
  return getServiceByLabel(label)?.defaultDurationMinutes ?? fallback
}
