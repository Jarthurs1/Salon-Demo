import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  toDateKey,
  isSameDay,
  formatMonthYear,
  formatDayNumber,
  formatSelectedDate,
  getMonthStart,
  addMonths,
  getMonthGridDays,
  startOfDay,
} from '../utils/dateUtils.js'
import { isClosedDay } from '../data/schedule.js'
import { useHorizontalSwipe } from '../hooks/useHorizontalSwipe.js'
import './BookDateCalendar.css'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function BookDateCalendar({
  selectedDate,
  visibleMonth,
  onVisibleMonthChange,
  onSelectDate,
  isDateEnabled,
  minMonth,
  maxMonth,
  dayIndicators = {},
}) {
  const rootRef = useRef(null)
  const monthStart = getMonthStart(visibleMonth)
  const cells = getMonthGridDays(monthStart)
  const selected = startOfDay(selectedDate)

  const canGoBack =
    !minMonth ||
    getMonthStart(minMonth).getTime() < monthStart.getTime()
  const canGoForward =
    !maxMonth ||
    getMonthStart(maxMonth).getTime() > monthStart.getTime()

  function goPrevious() {
    if (!canGoBack) return
    onVisibleMonthChange(addMonths(monthStart, -1))
  }

  function goNext() {
    if (!canGoForward) return
    onVisibleMonthChange(addMonths(monthStart, 1))
  }

  useHorizontalSwipe(rootRef, {
    enabled: true,
    onSwipeLeft: goNext,
    onSwipeRight: goPrevious,
  })

  return (
    <div
      className="book-date-calendar"
      aria-label="Choose appointment date"
      ref={rootRef}
      data-swipe-isolate
    >
      <div className="book-date-calendar__header">
        <button
          type="button"
          className="book-date-calendar__arrow"
          onClick={goPrevious}
          disabled={!canGoBack}
          aria-label="Previous month"
        >
          <ChevronLeft size={20} strokeWidth={2} />
        </button>
        <p className="book-date-calendar__month">{formatMonthYear(monthStart)}</p>
        <button
          type="button"
          className="book-date-calendar__arrow"
          onClick={goNext}
          disabled={!canGoForward}
          aria-label="Next month"
        >
          <ChevronRight size={20} strokeWidth={2} />
        </button>
      </div>

      <div className="book-date-calendar__weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="book-date-calendar__weekday">
            {label}
          </span>
        ))}
      </div>

      <div className="book-date-calendar__grid" role="grid">
        {cells.map(({ date, inMonth }) => {
          const key = toDateKey(date)
          const enabled = inMonth && isDateEnabled(date)
          const isSelected = isSameDay(date, selected)
          const closed = inMonth && isClosedDay(date)
          const indicator = dayIndicators[key] || null
          const label = formatSelectedDate(date)

          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              className={[
                'book-date-calendar__day',
                inMonth ? '' : 'is-outside',
                enabled ? '' : 'is-unavailable',
                closed && enabled ? 'is-closed' : '',
                isSelected ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={!enabled}
              aria-label={[
                label,
                enabled ? null : 'unavailable',
                closed ? 'closed' : null,
                indicator ? 'has appointments' : null,
              ]
                .filter(Boolean)
                .join(', ')}
              aria-selected={isSelected}
              onClick={() => {
                if (!enabled) return
                onSelectDate(date)
              }}
            >
              <span className="book-date-calendar__day-number">
                {formatDayNumber(date)}
              </span>
              {closed && enabled ? (
                <span className="book-date-calendar__closed">Closed</span>
              ) : null}
              {indicator ? (
                <span
                  className={`book-date-calendar__dot book-date-calendar__dot--${indicator}`}
                  aria-hidden="true"
                />
              ) : (
                <span
                  className="book-date-calendar__dot is-empty"
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
