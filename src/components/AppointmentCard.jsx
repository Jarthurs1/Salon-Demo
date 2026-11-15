import {
  formatTimeDisplay,
  formatDuration,
} from '../utils/dateUtils.js'
import { isFullDayBlock } from '../utils/conflictUtils.js'
import {
  getAppointmentStatusBadgeLabel,
  getAppointmentStatusLabel,
} from '../utils/appointmentStatus.js'
import './AppointmentCard.css'

export default function AppointmentCard({ appointment, onSelect }) {
  const { startTime, clientName, service, durationMinutes, status, type } = appointment
  const isBlocked = type === 'blocked' || status === 'blocked'
  const fullDay = isFullDayBlock(appointment)
  const durationLabel = fullDay
    ? 'Full working day'
    : formatDuration(durationMinutes)

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect?.(appointment)
    }
  }

  const title = isBlocked
    ? fullDay || service === 'Blocked — Full Day'
      ? 'Blocked — Full Day'
      : service
    : clientName

  return (
    <article
      className={`appointment-card appointment-card--${status}`}
      tabIndex={0}
      role="button"
      aria-label={`${formatTimeDisplay(startTime)} ${title}, ${getAppointmentStatusLabel(status)}`}
      onClick={() => onSelect?.(appointment)}
      onKeyDown={handleKeyDown}
    >
      <div className="appointment-card__time">
        <span>{formatTimeDisplay(startTime)}</span>
      </div>
      <div className="appointment-card__body">
        <h3 className="appointment-card__title">{title}</h3>
        {!isBlocked ? (
          <p className="appointment-card__service">{service}</p>
        ) : null}
      </div>
      <div className="appointment-card__meta">
        <span className={`appointment-card__badge appointment-card__badge--${status}`}>
          {getAppointmentStatusBadgeLabel(status)}
        </span>
        <span className="appointment-card__duration">{durationLabel}</span>
        {appointment.payment?.status === 'paid' ? (
          <span className="appointment-card__duration">Paid</span>
        ) : null}
        {appointment.payment?.status === 'requested' ? (
          <span className="appointment-card__duration">Payment due</span>
        ) : null}
      </div>
    </article>
  )
}
