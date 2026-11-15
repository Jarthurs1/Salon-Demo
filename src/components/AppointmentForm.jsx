import { useMemo, useState, useEffect } from 'react'
import Sheet from './Sheet.jsx'
import ClientForm from './ClientForm.jsx'
import { useClients } from '../hooks/useClients.js'
import {
  BLOCK_DURATION_OPTIONS,
  BLOCK_REASONS,
  SERVICE_OPTIONS,
  getScheduleSettings,
  getHoursForDate,
  getCalendarDisplayHours,
  isClosedDay,
  getClosedDayMessage,
  isOutsideNormalHours,
  getDefaultDurationForService,
} from '../data/schedule.js'
import {
  createAppointment,
  updateAppointment,
  getAppointments,
} from '../services/appointmentRepository.js'
import {
  validateAppointmentSlot,
  getAvailableStartTimes,
  getWorkingDayDurationMinutes,
  isFullDayBlock,
} from '../utils/conflictUtils.js'
import { parseDateKey, toDateKey, formatTimeDisplay } from '../utils/dateUtils.js'
import { getClientDisplayName } from '../utils/clientUtils.js'
import TimePicker from './TimePicker.jsx'
import DurationPicker from './DurationPicker.jsx'
import './AppointmentForm.css'

const FULL_DAY = 'full'

export default function AppointmentForm({
  mode = 'create',
  initialDate,
  appointment = null,
  onClose,
  onSaved,
}) {
  const isBlock = mode === 'block' || appointment?.type === 'blocked'
  const isEdit = mode === 'edit'
  const clients = useClients()
  const settings = useMemo(() => getScheduleSettings(), [])
  const todayKey = toDateKey(new Date())

  const initialFullDay =
    isBlock && appointment ? isFullDayBlock(appointment, settings) : false

  const [clientId, setClientId] = useState(appointment?.clientId ?? '')
  const [clientQuery, setClientQuery] = useState('')
  const [showAddClient, setShowAddClient] = useState(false)
  const [service, setService] = useState(
    isBlock
      ? (appointment?.service ?? 'Unavailable')
      : (appointment?.service ?? SERVICE_OPTIONS[0].label),
  )
  const [date, setDate] = useState(appointment?.date ?? toDateKey(initialDate))
  const [blockDurationKey, setBlockDurationKey] = useState(
    initialFullDay ? FULL_DAY : String(appointment?.durationMinutes ?? 60),
  )
  const [durationMinutes, setDurationMinutes] = useState(
    appointment?.durationMinutes ?? settings.defaultAppointmentDurationMinutes,
  )
  const [durationCustomized, setDurationCustomized] = useState(
    Boolean(appointment?.durationMinutes),
  )
  const [startTime, setStartTime] = useState(() => {
    if (appointment?.startTime) return appointment.startTime
    const display = getCalendarDisplayHours(
      appointment?.date ? parseDateKey(appointment.date) : initialDate || new Date(),
      settings,
    )
    return display.closed ? '10:00' : display.start || '08:00'
  })
  const [status, setStatus] = useState(appointment?.status ?? 'pending')
  const [notes, setNotes] = useState(appointment?.notes ?? '')
  const [error, setError] = useState(null)
  const [errorDetail, setErrorDetail] = useState(null)

  const dateObj = parseDateKey(date)
  const hours = getHoursForDate(dateObj, settings)
  const closed = isClosedDay(dateObj, settings)
  const isFullDay = isBlock && blockDurationKey === FULL_DAY

  useEffect(() => {
    if (!isBlock || !isFullDay) return
    if (hours.closed) return
    const fullDuration = getWorkingDayDurationMinutes(dateObj, settings)
    if (fullDuration != null) {
      setDurationMinutes(fullDuration)
      setStartTime(hours.start)
    }
  }, [isBlock, isFullDay, date, hours, dateObj, settings])

  const resolvedDuration = isFullDay
    ? getWorkingDayDurationMinutes(dateObj, settings) ?? durationMinutes
    : Number(durationMinutes)

  const blockStartTimes = useMemo(() => {
    if (!isBlock) return []
    if (isFullDay) {
      return hours.closed ? [] : [hours.start]
    }
    return getAvailableStartTimes(dateObj, resolvedDuration, getAppointments(), {
      settings,
      excludeId: appointment?.id,
    })
  }, [
    isBlock,
    isFullDay,
    dateObj,
    resolvedDuration,
    settings,
    hours,
    appointment?.id,
  ])

  const effectiveStart = isBlock
    ? blockStartTimes.includes(startTime)
      ? startTime
      : (blockStartTimes[0] ?? '')
    : startTime

  const outsideHours =
    !isBlock &&
    isOutsideNormalHours(dateObj, effectiveStart, resolvedDuration, settings)

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase()
    if (!q) return clients.slice(0, 8)
    return clients
      .filter((client) => {
        const name = getClientDisplayName(client).toLowerCase()
        return (
          name.includes(q) ||
          String(client.email || '')
            .toLowerCase()
            .includes(q) ||
          String(client.phone || '').includes(q)
        )
      })
      .slice(0, 12)
  }, [clients, clientQuery])

  const selectedClient = clients.find((c) => c.id === clientId) ?? null

  const title = isBlock
    ? isEdit
      ? 'Edit Blocked Time'
      : 'Block Time'
    : isEdit
      ? 'Edit Appointment'
      : 'Add Appointment'

  function handleBlockDurationChange(value) {
    setBlockDurationKey(value)
    if (value === FULL_DAY) return
    setDurationMinutes(Number(value))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setErrorDetail(null)

    if (isBlock && closed) {
      setError(getClosedDayMessage(dateObj, settings))
      return
    }

    if (isFullDay && hours.closed) {
      setError('This day is normally closed, so a full-day block is not needed.')
      return
    }

    if (!effectiveStart) {
      setError('Choose a valid start time within working hours.')
      return
    }

    if (!isBlock && !selectedClient) {
      setError('Select a client.')
      return
    }

    if (!service.trim()) {
      setError(isBlock ? 'Choose a reason.' : 'Enter a service.')
      return
    }

    const duration = isFullDay
      ? getWorkingDayDurationMinutes(dateObj, settings)
      : Number(durationMinutes)

    if (duration == null || !Number.isFinite(duration)) {
      setError('Choose a valid duration.')
      return
    }

    const candidate = {
      date,
      startTime: effectiveStart,
      durationMinutes: duration,
    }

    const validation = validateAppointmentSlot(candidate, getAppointments(), {
      excludeId: appointment?.id,
      dateObj,
      settings,
      ignoreWorkingHours: !isBlock,
    })

    if (!validation.ok) {
      setError(validation.message)
      setErrorDetail(validation.detail ?? null)
      return
    }

    const blockService = isFullDay ? 'Blocked — Full Day' : service.trim()

    const payload = isBlock
      ? {
          type: 'blocked',
          clientId: null,
          clientName: null,
          date,
          startTime: effectiveStart,
          durationMinutes: duration,
          service: blockService,
          status: 'blocked',
          notes: notes.trim(),
        }
      : {
          type: 'appointment',
          clientId: selectedClient.id,
          clientName: getClientDisplayName(selectedClient),
          date,
          startTime: effectiveStart,
          durationMinutes: duration,
          service: service.trim(),
          status,
          notes: notes.trim(),
        }

    try {
      if (isEdit && appointment) {
        await updateAppointment(appointment.id, payload)
      } else {
        await createAppointment(payload)
      }
      onSaved?.()
      onClose()
    } catch (err) {
      console.error('[AppointmentForm] save failed', err)
      setError("Couldn't save your changes. Please try again.")
    }
  }

  const footer = (
    <>
      <button type="submit" form="appointment-form" className="form-btn form-btn--primary">
        {isEdit ? 'Save Changes' : isBlock ? 'Block Time' : 'Save Appointment'}
      </button>
      <button type="button" className="form-btn form-btn--ghost" onClick={onClose}>
        Cancel
      </button>
    </>
  )

  return (
    <>
      <Sheet title={title} onClose={onClose} footer={footer}>
        <form id="appointment-form" className="appointment-form" onSubmit={handleSubmit}>
          {!isBlock && (
            <fieldset className="appointment-form__field">
              <legend className="appointment-form__label">Client</legend>
              {selectedClient ? (
                <div className="appointment-form__selected-client">
                  <div>
                    <strong>{getClientDisplayName(selectedClient)}</strong>
                    <span>{selectedClient.email || 'No email on file'}</span>
                  </div>
                  <button
                    type="button"
                    className="form-btn form-btn--tiny"
                    onClick={() => {
                      setClientId('')
                      setClientQuery('')
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="search"
                    className="appointment-form__input"
                    placeholder="Search clients by name or email..."
                    value={clientQuery}
                    onChange={(e) => setClientQuery(e.target.value)}
                    aria-label="Search clients"
                  />
                  <ul className="appointment-form__client-list">
                    {filteredClients.map((client) => (
                      <li key={client.id}>
                        <button
                          type="button"
                          className="appointment-form__client-option"
                          onClick={() => setClientId(client.id)}
                        >
                          <strong>{getClientDisplayName(client)}</strong>
                          <span>{client.email || 'No email'}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="appointment-form__add-client"
                    onClick={() => setShowAddClient(true)}
                  >
                    + Add New Client
                  </button>
                </>
              )}
            </fieldset>
          )}

          <label className="appointment-form__field">
            <span className="appointment-form__label">
              {isBlock ? 'Reason' : 'Service'}
            </span>
            {isBlock ? (
              isFullDay ? (
                <p className="appointment-form__hint">Blocked — Full Day</p>
              ) : (
                <select
                  className="appointment-form__input"
                  value={BLOCK_REASONS.includes(service) ? service : 'Other'}
                  onChange={(e) => setService(e.target.value)}
                >
                  {BLOCK_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              )
            ) : (
              <select
                className="appointment-form__input"
                value={
                  SERVICE_OPTIONS.some((s) => s.label === service)
                    ? service
                    : SERVICE_OPTIONS[0].label
                }
                onChange={(e) => {
                  const next = e.target.value
                  setService(next)
                  if (!durationCustomized) {
                    setDurationMinutes(
                      getDefaultDurationForService(
                        next,
                        settings.defaultAppointmentDurationMinutes,
                      ),
                    )
                  }
                }}
                required
              >
                {SERVICE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.label}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </label>

          {isEdit && (
            <label className="appointment-form__field">
              <span className="appointment-form__label">Date</span>
              <input
                type="date"
                className="appointment-form__input"
                value={date}
                min={todayKey}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
          )}

          <div className="appointment-form__field">
            <span className="appointment-form__label">Duration</span>
            {isBlock ? (
              <select
                className="appointment-form__input"
                value={blockDurationKey}
                onChange={(e) => handleBlockDurationChange(e.target.value)}
                aria-label="Duration"
              >
                {BLOCK_DURATION_OPTIONS.map((option) => (
                  <option key={String(option.minutes)} value={String(option.minutes)}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <DurationPicker
                id="appointment-duration-picker"
                value={durationMinutes}
                onChange={(next) => {
                  setDurationCustomized(true)
                  setDurationMinutes(Number(next))
                }}
              />
            )}
          </div>

          {isFullDay ? (
            <p className="appointment-form__hint">
              {closed
                ? getClosedDayMessage(dateObj, settings)
                : `Covers working hours ${formatTimeDisplay(hours.start)} – ${formatTimeDisplay(hours.end)}.`}
            </p>
          ) : isBlock ? (
            <label className="appointment-form__field">
              <span className="appointment-form__label">Start Time</span>
              {blockStartTimes.length === 0 ? (
                <p className="appointment-form__hint">No available times for this day.</p>
              ) : (
                <select
                  className="appointment-form__input"
                  value={effectiveStart}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                >
                  {blockStartTimes.map((time) => (
                    <option key={time} value={time}>
                      {formatTimeDisplay(time)}
                    </option>
                  ))}
                </select>
              )}
            </label>
          ) : (
            <div className="appointment-form__field">
              <span className="appointment-form__label">Start Time</span>
              <TimePicker
                id="appointment-time-picker"
                value={effectiveStart}
                onChange={setStartTime}
              />
              {closed ? (
                <p className="appointment-form__hint">
                  This day is normally closed — booking is still allowed.
                </p>
              ) : outsideHours ? (
                <p className="appointment-form__hint">Outside normal salon hours</p>
              ) : null}
            </div>
          )}

          {!isBlock && isEdit && (
            <fieldset className="appointment-form__field">
              <legend className="appointment-form__label">Status</legend>
              <div className="appointment-form__status-row">
                <label className={`status-chip${status === 'pending' ? ' is-active is-pending' : ''}`}>
                  <input
                    type="radio"
                    name="status"
                    value="pending"
                    checked={status === 'pending'}
                    onChange={() => setStatus('pending')}
                  />
                  Pending
                </label>
                <label className={`status-chip${status === 'confirmed' ? ' is-active is-confirmed' : ''}`}>
                  <input
                    type="radio"
                    name="status"
                    value="confirmed"
                    checked={status === 'confirmed'}
                    onChange={() => setStatus('confirmed')}
                  />
                  Confirmed
                </label>
                {(status === 'reschedule_requested' || appointment?.status === 'reschedule_requested') && (
                  <label className={`status-chip${status === 'reschedule_requested' ? ' is-active is-reschedule' : ''}`}>
                    <input
                      type="radio"
                      name="status"
                      value="reschedule_requested"
                      checked={status === 'reschedule_requested'}
                      onChange={() => setStatus('reschedule_requested')}
                    />
                    Reschedule requested
                  </label>
                )}
              </div>
              {status === 'reschedule_requested' ? (
                <p className="appointment-form__hint">
                  Choose a new date/time and save to clear this request and reset reminders.
                  Or mark Pending / Confirmed after you contact the client.
                </p>
              ) : null}
            </fieldset>
          )}

          <label className="appointment-form__field">
            <span className="appointment-form__label">Notes (optional)</span>
            <textarea
              className="appointment-form__input appointment-form__textarea"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Preferences, allergies, etc."
            />
          </label>

          {error && (
            <div className="appointment-form__error" role="alert">
              <p>{error}</p>
              {errorDetail ? (
                <p className="appointment-form__error-detail">{errorDetail}</p>
              ) : null}
            </div>
          )}
        </form>
      </Sheet>

      {showAddClient && (
        <ClientForm
          mode="create"
          initialName={clientQuery}
          onClose={() => setShowAddClient(false)}
          onSaved={(saved) => {
            setClientId(saved.id)
            setClientQuery('')
            setShowAddClient(false)
          }}
          onViewExisting={(match) => {
            setClientId(match.id)
            setShowAddClient(false)
          }}
        />
      )}
    </>
  )
}
