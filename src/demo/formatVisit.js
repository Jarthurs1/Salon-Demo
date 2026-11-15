import { formatSelectedDate, formatTimeDisplay, parseDateKey } from '../utils/dateUtils.js'

export function formatVisit(date, time) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return [date, time].filter(Boolean).join(' at ')
  }
  const day = formatSelectedDate(parseDateKey(date))
  const clock = time ? formatTimeDisplay(time) : ''
  return clock ? `${day} at ${clock}` : day
}
