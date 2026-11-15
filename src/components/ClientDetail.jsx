import { useMemo, useState } from 'react'
import { ChevronLeft, Pencil, Trash2, CalendarPlus } from 'lucide-react'
import {
  getClientDisplayName,
  getClientInitials,
  formatPhoneDisplay,
  buildTelUrl,
} from '../utils/clientUtils.js'
import ContactQuickActions from './ContactQuickActions.jsx'
import { deleteClient } from '../services/clientRepository.js'
import { useAppointments } from '../hooks/useAppointments.js'
import {
  toDateKey,
  parseDateKey,
  formatTimeDisplay,
  formatDuration,
  startOfDay,
} from '../utils/dateUtils.js'
import { getAppointmentStatusLabel } from '../utils/appointmentStatus.js'
import './ClientDetail.css'

function formatShortDate(dateKey) {
  const date = parseDateKey(dateKey)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatLongMonthDay(dateKey) {
  const date = parseDateKey(dateKey)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  })
}

export default function ClientDetail({
  client,
  onBack,
  onEdit,
  onBook,
  onOpenAppointment,
  onDeleted,
}) {
  const allAppointments = useAppointments()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const related = useMemo(() => {
    return allAppointments.filter(
      (a) =>
        a.clientId === client.id &&
        a.type !== 'blocked' &&
        a.status !== 'blocked',
    )
  }, [client.id, allAppointments])

  const today = startOfDay(new Date())
  const todayKey = toDateKey(today)
  // Held canceled appointments stay in upcoming; released ones move to history.
  const upcoming = related
    .filter((a) => {
      if (a.date < todayKey) return false
      if (String(a.status || '').toLowerCase() === 'canceled' ||
          String(a.status || '').toLowerCase() === 'cancelled') {
        return a.slotReleasedAt == null
      }
      return true
    })
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date)
      if (byDate !== 0) return byDate
      return a.startTime.localeCompare(b.startTime)
    })

  const history = related
    .filter((a) => {
      if (a.date < todayKey) return true
      if (String(a.status || '').toLowerCase() === 'canceled' ||
          String(a.status || '').toLowerCase() === 'cancelled') {
        return a.slotReleasedAt != null
      }
      return false
    })
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date)
      if (byDate !== 0) return byDate
      return b.startTime.localeCompare(a.startTime)
    })

  const lastVisit = history[0]?.date ?? null
  const nextVisit = upcoming[0]?.date ?? null
  const telHref = buildTelUrl(client.phone)

  async function handleDelete() {
    setDeleteError(null)
    try {
      await deleteClient(client.id)
      onDeleted?.()
    } catch (err) {
      setDeleteError(err.message || "Couldn't delete this client.")
      setConfirmDelete(false)
    }
  }

  return (
    <div className="client-detail">
      <button type="button" className="client-detail__back" onClick={onBack}>
        <ChevronLeft size={20} strokeWidth={2.25} />
        Clients
      </button>

      <header className="client-detail__header">
        <div className="client-detail__avatar" aria-hidden="true">
          {getClientInitials(client)}
        </div>
        <div>
          <h2 className="client-detail__name">{getClientDisplayName(client)}</h2>
          <div className="client-detail__summary">
            <span>{related.length} appointments</span>
            {lastVisit ? <span>Last: {formatLongMonthDay(lastVisit)}</span> : null}
            {nextVisit ? <span>Next: {formatLongMonthDay(nextVisit)}</span> : null}
          </div>
        </div>
      </header>

      <dl className="client-detail__meta">
        <div>
          <dt>Email</dt>
          <dd>
            {client.email ? (
              <a href={`mailto:${client.email}`}>{client.email}</a>
            ) : (
              <span className="client-detail__muted">No email on file</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>
            {telHref ? (
              <a href={telHref}>{formatPhoneDisplay(client.phone)}</a>
            ) : client.phone ? (
              <span>{formatPhoneDisplay(client.phone)}</span>
            ) : (
              <span className="client-detail__muted">No phone on file</span>
            )}
          </dd>
        </div>
        {client.notes ? (
          <div>
            <dt>Notes</dt>
            <dd>{client.notes}</dd>
          </div>
        ) : null}
      </dl>

      <div className="client-detail__actions">
        <ContactQuickActions phone={client.phone} />
        <button type="button" className="client-detail__book" onClick={onBook}>
          <CalendarPlus size={18} strokeWidth={2.25} />
          Book Appointment
        </button>
        <button type="button" className="client-detail__edit" onClick={onEdit}>
          <Pencil size={16} strokeWidth={2.25} />
          Edit Client
        </button>
      </div>

      <section className="client-detail__section">
        <h3>Upcoming Appointments</h3>
        {upcoming.length === 0 ? (
          <p className="client-detail__empty">No upcoming appointments.</p>
        ) : (
          <ul className="client-detail__appt-list">
            {upcoming.map((appt) => (
              <li key={appt.id}>
                <button
                  type="button"
                  className={`client-detail__appt client-detail__appt--${appt.status}`}
                  onClick={() => onOpenAppointment?.(appt)}
                >
                  <div>
                    <strong>{formatShortDate(appt.date)}</strong>
                    <span>
                      {formatTimeDisplay(appt.startTime)} · {appt.service}
                    </span>
                    <span>{formatDuration(appt.durationMinutes)}</span>
                  </div>
                  <span className={`client-detail__status client-detail__status--${appt.status}`}>
                    {getAppointmentStatusLabel(appt.status)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="client-detail__section">
        <h3>Appointment History</h3>
        {history.length === 0 ? (
          <p className="client-detail__empty">No previous appointments.</p>
        ) : (
          <ul className="client-detail__appt-list">
            {history.map((appt) => (
              <li key={appt.id}>
                <div className="client-detail__history-row">
                  <strong>{formatLongMonthDay(appt.date)}</strong>
                  <span>
                    {appt.service} · {formatDuration(appt.durationMinutes)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="client-detail__danger">
        {deleteError && (
          <p className="client-detail__delete-error" role="alert">
            {deleteError}
          </p>
        )}
        {!confirmDelete ? (
          <button
            type="button"
            className="client-detail__delete"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={16} />
            Delete Client
          </button>
        ) : (
          <div className="client-detail__confirm">
            <p>Delete this client?</p>
            <button type="button" className="form-btn form-btn--danger" onClick={handleDelete}>
              Delete
            </button>
            <button
              type="button"
              className="form-btn form-btn--ghost"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
