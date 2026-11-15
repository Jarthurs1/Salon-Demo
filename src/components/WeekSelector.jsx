import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  formatWeekRange,
  canGoToPreviousWeek,
  canGoToNextWeek,
  addWeeks,
} from '../utils/dateUtils.js'
import { useScheduleSettings } from '../hooks/useScheduleSettings.js'
import './WeekSelector.css'

export default function WeekSelector({ weekStart, today, onWeekChange }) {
  const { maxFutureWeeks } = useScheduleSettings()
  const canGoBack = canGoToPreviousWeek(weekStart, today)
  const canGoForward = canGoToNextWeek(weekStart, today, maxFutureWeeks)

  function goPrevious() {
    if (!canGoBack) return
    onWeekChange(addWeeks(weekStart, -1))
  }

  function goNext() {
    if (!canGoForward) return
    onWeekChange(addWeeks(weekStart, 1))
  }

  return (
    <div className="week-selector">
      <button
        type="button"
        className="week-selector__arrow"
        onClick={goPrevious}
        disabled={!canGoBack}
        aria-label="Previous week"
      >
        <ChevronLeft size={22} strokeWidth={2} />
      </button>
      <p className="week-selector__range">{formatWeekRange(weekStart)}</p>
      <button
        type="button"
        className="week-selector__arrow"
        onClick={goNext}
        disabled={!canGoForward}
        aria-label="Next week"
      >
        <ChevronRight size={22} strokeWidth={2} />
      </button>
    </div>
  )
}
