import {
  parseTimeToMinutes,
  minutesToTime,
} from '../utils/dateUtils.js'
import './TimePicker.css'

const STEP_MINUTES = 15

/** Snap total minutes since midnight to the nearest 15-minute increment. */
export function snapToQuarterHour(totalMinutes) {
  if (!Number.isFinite(totalMinutes)) return null
  const day = 24 * 60
  const clamped = Math.min(Math.max(0, totalMinutes), day - STEP_MINUTES)
  return Math.round(clamped / STEP_MINUTES) * STEP_MINUTES
}

function normalizeValue(value) {
  const minutes = parseTimeToMinutes(value)
  if (minutes == null) return ''
  const snapped = snapToQuarterHour(minutes)
  return snapped == null ? '' : minutesToTime(snapped)
}

/**
 * Single full-width native time field (15-minute steps).
 * value / onChange use 24h "HH:MM".
 */
export default function TimePicker({
  value,
  onChange,
  disabled = false,
  id = 'time-picker',
  className = '',
  'aria-label': ariaLabel = 'Appointment time',
}) {
  const inputValue = normalizeValue(value)

  function handleChange(event) {
    const raw = event.target.value
    if (!raw) {
      onChange?.('')
      return
    }
    // Some browsers append seconds (HH:MM:SS).
    const hhmm = raw.length >= 5 ? raw.slice(0, 5) : raw
    const minutes = parseTimeToMinutes(hhmm)
    if (minutes == null) return
    const snapped = snapToQuarterHour(minutes)
    const next = minutesToTime(snapped)
    if (next) onChange?.(next)
  }

  return (
    <input
      id={id}
      type="time"
      className={`time-picker-input ${className}`.trim()}
      step={STEP_MINUTES * 60}
      value={inputValue}
      onChange={handleChange}
      disabled={disabled}
      aria-label={ariaLabel}
    />
  )
}
