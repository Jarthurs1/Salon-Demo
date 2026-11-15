import { addDays, parseDateKey, toDateKey } from './dateUtils.js'
import { getSalonDate } from '../reminders/salonTime.js'

/**
 * Label for the selected-day appointment summary.
 * "Today" only when the selected date matches salon-timezone today.
 */
export function getDaySummaryPrefix(selectedDate, {
  now = new Date(),
  timezone,
} = {}) {
  if (!selectedDate || !timezone) return null
  const selectedKey = toDateKey(selectedDate)
  const salonTodayKey = getSalonDate(now, timezone)
  if (selectedKey === salonTodayKey) return 'Today'

  const salonTomorrowKey = toDateKey(addDays(parseDateKey(salonTodayKey), 1))
  if (selectedKey === salonTomorrowKey) return 'Tomorrow'

  return null
}
