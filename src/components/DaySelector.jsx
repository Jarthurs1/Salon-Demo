import { useEffect, useRef } from 'react'
import {
  formatDayLabel,
  formatDayNumber,
  isSameDay,
  isPastDay,
  toDateKey,
} from '../utils/dateUtils.js'
import { isClosedDay } from '../data/schedule.js'
import './DaySelector.css'

export default function DaySelector({
  days,
  selectedDate,
  today,
  onSelectDay,
  dayIndicators = {},
}) {
  const scrollerRef = useRef(null)
  const selectedRef = useRef(null)

  useEffect(() => {
    selectedRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }, [selectedDate, days])

  return (
    <div
      className="day-selector"
      role="tablist"
      aria-label="Calendar days"
      ref={scrollerRef}
    >
      {days.map((day) => {
        const key = toDateKey(day)
        const selected = isSameDay(day, selectedDate)
        const isToday = isSameDay(day, today)
        const past = isPastDay(day, today)
        const closed = isClosedDay(day)
        const indicator = dayIndicators[key]

        return (
          <button
            key={key}
            type="button"
            role="tab"
            ref={selected ? selectedRef : null}
            aria-selected={selected}
            aria-label={`${formatDayLabel(day)} ${formatDayNumber(day)}${past ? ', past day' : ''}${closed ? ', closed' : ''}${indicator ? ', has appointments' : ''}`}
            className={[
              'day-selector__day',
              selected ? 'is-selected' : '',
              isToday ? 'is-today' : '',
              past ? 'is-past' : '',
              closed ? 'is-closed' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelectDay(day)}
          >
            <span className="day-selector__label">{formatDayLabel(day)}</span>
            <span className="day-selector__number">{formatDayNumber(day)}</span>
            {closed && !past ? (
              <span className="day-selector__closed">Closed</span>
            ) : null}
            {/* Status dots still show on closed days when appointments exist. */}
            {!(closed && !past && !indicator) ? (
              <span
                className={`day-selector__dot${indicator ? ` day-selector__dot--${indicator}` : ' is-empty'}`}
                aria-hidden="true"
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
