/**
 * Duration picker helpers — hours + quarter-hour minutes, max 12 hours.
 */

export const DURATION_MAX_MINUTES = 12 * 60
export const DURATION_MINUTE_STEPS = [0, 15, 30, 45]

export function splitDurationMinutes(totalMinutes) {
  const raw = Number(totalMinutes)
  if (!Number.isFinite(raw) || raw <= 0) {
    return { hours: 0, minutes: 30 }
  }
  const clamped = Math.min(DURATION_MAX_MINUTES, Math.max(15, Math.round(raw)))
  const hours = Math.floor(clamped / 60)
  let minutes = clamped % 60
  if (![0, 15, 30, 45].includes(minutes)) {
    minutes = DURATION_MINUTE_STEPS.reduce((best, step) =>
      Math.abs(step - minutes) < Math.abs(best - minutes) ? step : best,
    )
  }
  // 12 hr must be exact; snap overflow minutes down.
  if (hours >= 12) {
    return { hours: 12, minutes: 0 }
  }
  if (hours === 0 && minutes === 0) {
    return { hours: 0, minutes: 15 }
  }
  return { hours, minutes }
}

export function combineDurationParts(hours, minutes) {
  let h = Math.min(12, Math.max(0, Number(hours) || 0))
  let m = Number(minutes) || 0
  if (![0, 15, 30, 45].includes(m)) m = 0
  if (h === 12) m = 0
  if (h === 0 && m === 0) m = 15
  return h * 60 + m
}

/** Closed-field label: "30 min", "1 hr", "1 hr 15 min", "4 hr". */
export function formatDurationPickerLabel(totalMinutes) {
  const { hours, minutes } = splitDurationMinutes(totalMinutes)
  const total = hours * 60 + minutes
  if (total < 60) return `${total} min`
  if (minutes === 0) return hours === 1 ? '1 hr' : `${hours} hr`
  const hourPart = hours === 1 ? '1 hr' : `${hours} hr`
  return `${hourPart} ${minutes} min`
}
