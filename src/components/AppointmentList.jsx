import { Plus } from 'lucide-react'
import AppointmentCard from './AppointmentCard.jsx'
import {
  formatAvailableRange,
  buildDayTimeline,
  summarizeDay,
} from '../utils/timelineUtils.js'
import {
  formatDuration,
  isPastDay,
  toDateKey,
} from '../utils/dateUtils.js'
import { getDaySummaryPrefix } from '../utils/daySummaryLabel.js'
import { getScheduleSettings, isClosedDay, getClosedDayMessage } from '../data/schedule.js'
import './AppointmentList.css'

export default function AppointmentList({
  appointments,
  selectedDate,
  today,
  canBlock,
  onSelectAppointment,
  onBlockTime,
  onBookAvailableSlot = null,
  showDateHeading = false,
  selectedDateLabel = '',
}) {
  const settings = getScheduleSettings()
  const closed = isClosedDay(selectedDate, settings)
  const summary = summarizeDay(appointments)
  const dayPrefix = getDaySummaryPrefix(selectedDate, {
    timezone: settings.timezone,
  })
  const showDaySummary = summary.total > 0
  const canTapAvailable =
    Boolean(onBookAvailableSlot) &&
    !closed &&
    !isPastDay(selectedDate, today)

  const timeline = buildDayTimeline(appointments, selectedDate, settings)

  function handleAvailableActivate(slot) {
    if (!canTapAvailable) return
    onBookAvailableSlot({
      date: toDateKey(selectedDate),
      startTime: slot.startTime,
    })
  }

  return (
    <section
      className="appointment-list"
      aria-label={closed ? 'Closed day' : 'Appointments'}
    >
      {showDateHeading && selectedDateLabel ? (
        <h2 className="appointment-list__date">{selectedDateLabel}</h2>
      ) : null}

      {closed ? (
        <div className="appointment-list__closed appointment-list__closed--compact">
          <p className="appointment-list__closed-label">Closed</p>
          <p className="appointment-list__closed-text">
            {getClosedDayMessage(selectedDate, settings)}
          </p>
        </div>
      ) : null}

      {showDaySummary ? (
        <div className="appointment-list__heading">
          <p className="appointment-list__summary">
            {dayPrefix ? `${dayPrefix} — ` : null}
            {summary.total} appointment{summary.total === 1 ? '' : 's'}
            {summary.pending > 0 ? (
              <>
                {' · '}
                <span className="appointment-list__summary-pending">
                  {summary.pending} awaiting confirmation
                </span>
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {timeline.length === 0 ? (
        <div className="appointment-list__empty">
          <p className="appointment-list__empty-title">
            {closed ? 'No appointments' : 'No appointments'}
          </p>
          <p className="appointment-list__empty-text">
            {closed
              ? 'This day is closed. You can still book from the Book tab if needed.'
              : 'This day is open. Book from the Book tab, or block time here.'}
          </p>
        </div>
      ) : (
        <ul className="appointment-list__items">
          {timeline.map((item) => {
            if (item.type === 'available') {
              return (
                <li key={`gap-${item.startTime}-${item.endTime}`}>
                  <div
                    className="available-gap"
                    role={canTapAvailable ? 'button' : undefined}
                    tabIndex={canTapAvailable ? 0 : undefined}
                    aria-label={
                      canTapAvailable
                        ? `Book available time ${formatAvailableRange(item)}`
                        : undefined
                    }
                    onClick={
                      canTapAvailable
                        ? () => handleAvailableActivate(item)
                        : undefined
                    }
                    onKeyDown={
                      canTapAvailable
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              handleAvailableActivate(item)
                            }
                          }
                        : undefined
                    }
                  >
                    {canTapAvailable ? (
                      <Plus
                        className="available-gap__plus"
                        size={15}
                        strokeWidth={2.5}
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="available-gap__range">
                      {formatAvailableRange(item)}
                    </span>
                    <span className="available-gap__duration">
                      {formatDuration(item.durationMinutes)}
                    </span>
                  </div>
                </li>
              )
            }

            return (
              <li key={item.appointment.id}>
                <AppointmentCard
                  appointment={item.appointment}
                  onSelect={onSelectAppointment}
                />
              </li>
            )
          })}
        </ul>
      )}

      {canBlock ? (
        <div className="appointment-list__actions">
          <button
            type="button"
            className="appointment-list__block"
            onClick={onBlockTime}
          >
            Block Time
          </button>
        </div>
      ) : null}
    </section>
  )
}
