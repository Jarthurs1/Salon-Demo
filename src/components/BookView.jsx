import { useEffect, useMemo, useState } from 'react'
import { Camera } from 'lucide-react'
import ClientForm from './ClientForm.jsx'
import BookDateCalendar from './BookDateCalendar.jsx'
import AppHeader from './AppHeader.jsx'
import TimePicker, { snapToQuarterHour } from './TimePicker.jsx'
import DurationPicker from './DurationPicker.jsx'
import PhotoImport from './PhotoImport.jsx'
import { useClients } from '../hooks/useClients.js'
import { useAppointments } from '../hooks/useAppointments.js'
import { useScheduleSettings } from '../hooks/useScheduleSettings.js'
import {
  SERVICE_OPTIONS,
  getDefaultDurationForService,
  isClosedDay,
  getCalendarDisplayHours,
  isOutsideNormalHours,
} from '../data/schedule.js'
import { createAppointment } from '../services/appointmentRepository.js'
import { validateAppointmentSlot } from '../utils/conflictUtils.js'
import { getDayStatusIndicator } from '../utils/timelineUtils.js'
import {
  toDateKey,
  parseDateKey,
  formatSelectedDate,
  addDays,
  startOfDay,
  isPastDay,
  getMonthStart,
  parseTimeToMinutes,
  minutesToTime,
} from '../utils/dateUtils.js'
import {
  clientMatchesSearchQuery,
  getClientDisplayName,
  getClientSecondaryContact,
} from '../utils/clientUtils.js'
import './BookView.css'

export default function BookView({
  onViewInCalendar,
  onBooked = null,
  onRefresh = null,
  onOpenHelp = null,
  onOpenSettings = null,
  prefillClientId = null,
  prefillDate = null,
  prefillStartTime = null,
}) {
  const clients = useClients()
  const appointments = useAppointments()
  const settings = useScheduleSettings()
  const [refreshing, setRefreshing] = useState(false)
  const [showPhotoImport, setShowPhotoImport] = useState(false)
  const today = useMemo(() => startOfDay(new Date()), [])
  const todayKey = toDateKey(today)

  async function handleRefresh() {
    if (!onRefresh || refreshing) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }
  const maxDate = useMemo(
    () => addDays(today, settings.maxFutureWeeks * 7),
    [today, settings.maxFutureWeeks],
  )

  const fromCalendarSlot = Boolean(prefillDate && prefillStartTime)

  const [clientId, setClientId] = useState(prefillClientId || '')
  const [clientQuery, setClientQuery] = useState('')
  const [showAddClient, setShowAddClient] = useState(false)
  const [service, setService] = useState(fromCalendarSlot ? '' : '')
  const [date, setDate] = useState(prefillDate || todayKey)
  const [visibleMonth, setVisibleMonth] = useState(() =>
    getMonthStart(parseDateKey(prefillDate || todayKey)),
  )
  const [durationMinutes, setDurationMinutes] = useState(
    settings.defaultAppointmentDurationMinutes,
  )
  const [durationCustomized, setDurationCustomized] = useState(false)
  const [startTime, setStartTime] = useState(() => {
    if (prefillStartTime) return prefillStartTime
    const hours = getCalendarDisplayHours(parseDateKey(prefillDate || todayKey), settings)
    return hours.closed ? '10:00' : hours.start || '08:00'
  })
  const [notes, setNotes] = useState('')
  const [error, setError] = useState(null)
  const [errorDetail, setErrorDetail] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (prefillClientId) setClientId(prefillClientId)
  }, [prefillClientId])

  useEffect(() => {
    if (prefillDate) {
      setDate(prefillDate)
      setVisibleMonth(getMonthStart(parseDateKey(prefillDate)))
    }
  }, [prefillDate])

  useEffect(() => {
    if (prefillStartTime) setStartTime(prefillStartTime)
  }, [prefillStartTime])

  const selectedClient = clients.find((c) => c.id === clientId) ?? null
  const selectedContact = selectedClient
    ? getClientSecondaryContact(selectedClient)
    : null
  const dateObj = parseDateKey(date)
  const closed = isClosedDay(dateObj, settings)
  const outsideHours = isOutsideNormalHours(
    dateObj,
    startTime,
    durationMinutes,
    settings,
  )

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim()
    if (!q) return []
    return clients
      .filter((client) => clientMatchesSearchQuery(client, q))
      .slice(0, 12)
  }, [clients, clientQuery])

  function handleServiceChange(nextService) {
    setService(nextService)
    if (nextService && !durationCustomized) {
      setDurationMinutes(
        getDefaultDurationForService(
          nextService,
          settings.defaultAppointmentDurationMinutes,
        ),
      )
    }
  }

  function handleDurationChange(nextMinutes) {
    setDurationCustomized(true)
    setDurationMinutes(Number(nextMinutes))
  }

  function handleDateSelect(day) {
    if (isPastDay(day, today)) return
    setDate(toDateKey(day))
  }

  function isCalendarDayEnabled(day) {
    return !isPastDay(day, today)
  }

  const dayIndicators = useMemo(() => {
    const map = {}
    for (const appointment of appointments) {
      const key = appointment?.date
      if (!key) continue
      if (!map[key]) map[key] = []
      map[key].push(appointment)
    }
    const indicators = {}
    for (const [key, dayAppts] of Object.entries(map)) {
      indicators[key] = getDayStatusIndicator(dayAppts)
    }
    return indicators
  }, [appointments])

  function focusField(selector) {
    const el = document.querySelector(selector)
    if (el && typeof el.focus === 'function') {
      el.focus({ preventScroll: false })
      el.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setErrorDetail(null)
    const nextErrors = {}

    if (!selectedClient) {
      nextErrors.client = 'Please select a client.'
    }
    if (!service.trim()) {
      nextErrors.service = 'Please select a service.'
    }
    if (isPastDay(dateObj, today)) {
      nextErrors.date = 'Please select a future appointment date.'
    }
    let bookingStart = startTime
    if (!bookingStart) {
      nextErrors.time = 'Please select an appointment time.'
    } else {
      const minutes = parseTimeToMinutes(bookingStart)
      if (minutes == null) {
        nextErrors.time = 'Please select a valid appointment time.'
      } else if (minutes % 15 !== 0) {
        bookingStart = minutesToTime(snapToQuarterHour(minutes))
        setStartTime(bookingStart)
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      const first =
        nextErrors.client ||
        nextErrors.date ||
        nextErrors.service ||
        nextErrors.time
      setError(first)
      if (nextErrors.client) focusField('.book-view__input[type="search"], .book-view__selected-client')
      else if (nextErrors.service) focusField('select.book-view__input')
      else if (nextErrors.time) focusField('#book-time-picker')
      return
    }

    const validation = validateAppointmentSlot(
      {
        date,
        startTime: bookingStart,
        durationMinutes: Number(durationMinutes),
      },
      appointments,
      {
        dateObj,
        settings,
        ignoreWorkingHours: true,
      },
    )
    if (!validation.ok) {
      const message =
        validation.code === 'conflict'
          ? 'This time conflicts with another appointment.'
          : validation.message
      setFieldErrors({ time: message })
      setError(message)
      setErrorDetail(validation.detail || null)
      focusField('#book-time-picker')
      return
    }

    setFieldErrors({})
    setSaving(true)
    try {
      await createAppointment({
        type: 'appointment',
        clientId: selectedClient.id,
        clientName: getClientDisplayName(selectedClient),
        date,
        startTime: bookingStart,
        durationMinutes: Number(durationMinutes),
        service: service.trim(),
        status: 'pending',
        notes: notes.trim(),
      })
      // Clear booking-specific state, then return to Calendar on the booked date.
      setClientId('')
      setClientQuery('')
      setService('')
      setDurationMinutes(settings.defaultAppointmentDurationMinutes)
      setDurationCustomized(false)
      setNotes('')
      const hours = getCalendarDisplayHours(dateObj, settings)
      setStartTime(hours.closed ? '10:00' : hours.start || '08:00')
      setError(null)
      setErrorDetail(null)
      if (onBooked) onBooked(date)
      else onViewInCalendar?.(date)
    } catch (err) {
      console.error('[BookView] save failed', err)
      setError(
        err?.message?.includes('overlap') || err?.code === 'conflict'
          ? 'This time conflicts with another appointment.'
          : "Couldn't book this appointment. Please try again.",
      )
      setErrorDetail(err?.detail || null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="book-view">
      <AppHeader
        subtitle="New Appointment"
        onOpenHelp={onOpenHelp}
        onRefresh={onRefresh ? handleRefresh : null}
        refreshing={refreshing}
        onOpenSettings={onOpenSettings}
      />

      <form className="book-view__form" onSubmit={handleSubmit} noValidate>
        <div
          className={`book-view__field${fieldErrors.date ? ' is-invalid' : ''}`}
        >
          <p className="book-view__date-summary" aria-live="polite">
            {formatSelectedDate(dateObj)}
          </p>
          <BookDateCalendar
            selectedDate={dateObj}
            visibleMonth={visibleMonth}
            onVisibleMonthChange={setVisibleMonth}
            onSelectDate={handleDateSelect}
            isDateEnabled={isCalendarDayEnabled}
            minMonth={today}
            maxMonth={maxDate}
            dayIndicators={dayIndicators}
          />
          {fieldErrors.date ? (
            <p className="book-view__field-error">{fieldErrors.date}</p>
          ) : null}
        </div>

        <fieldset
          className={`book-view__field${fieldErrors.client ? ' is-invalid' : ''}`}
        >
          <legend className="book-view__label">Client</legend>
          {selectedClient ? (
            <div className="book-view__selected-client">
              <div>
                <strong>{getClientDisplayName(selectedClient)}</strong>
                <span
                  className={
                    selectedContact?.type === 'none'
                      ? 'book-view__contact--muted'
                      : undefined
                  }
                >
                  {selectedContact?.text}
                </span>
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
                className="book-view__input"
                placeholder="Search name, phone or email..."
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
                aria-label="Search name, phone or email"
                autoComplete="off"
              />
              {filteredClients.length > 0 ? (
                <ul className="book-view__client-list">
                  {filteredClients.map((client) => {
                    const contact = getClientSecondaryContact(client)
                    return (
                      <li key={client.id}>
                        <button
                          type="button"
                          className="book-view__client-option"
                          onClick={() => setClientId(client.id)}
                        >
                          <strong>{getClientDisplayName(client)}</strong>
                          <span
                            className={
                              contact.type === 'none'
                                ? 'book-view__contact--muted'
                                : undefined
                            }
                          >
                            {contact.text}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
              <button
                type="button"
                className="book-view__add-client"
                onClick={() => setShowAddClient(true)}
              >
                + New Client
              </button>
            </>
          )}
          {fieldErrors.client ? (
            <p className="book-view__field-error">{fieldErrors.client}</p>
          ) : null}
        </fieldset>

        <label
          className={`book-view__field${fieldErrors.service ? ' is-invalid' : ''}`}
        >
          <span className="book-view__label">Service</span>
          <select
            className="book-view__input"
            value={service}
            onChange={(e) => {
              handleServiceChange(e.target.value)
              setFieldErrors((prev) => ({ ...prev, service: undefined }))
            }}
            required
          >
            <option value="" disabled>
              Select a service
            </option>
            {SERVICE_OPTIONS.map((option) => (
              <option key={option.id} value={option.label}>
                {option.label}
              </option>
            ))}
          </select>
          {fieldErrors.service ? (
            <p className="book-view__field-error">{fieldErrors.service}</p>
          ) : null}
        </label>

        <div className="book-view__field">
          <span className="book-view__label">Duration</span>
          <DurationPicker
            id="book-duration-picker"
            value={durationMinutes}
            onChange={handleDurationChange}
          />
        </div>

        <div
          className={`book-view__field${fieldErrors.time ? ' is-invalid' : ''}`}
        >
          <span className="book-view__label">Time</span>
          <TimePicker
            id="book-time-picker"
            value={startTime}
            onChange={(next) => {
              setStartTime(next)
              setFieldErrors((prev) => ({ ...prev, time: undefined }))
            }}
          />
          {closed ? (
            <p className="book-view__outside-note" role="status">
              This day is normally closed — booking is still allowed.
            </p>
          ) : outsideHours ? (
            <p className="book-view__outside-note" role="status">
              Outside normal salon hours
            </p>
          ) : null}
          {fieldErrors.time ? (
            <p className="book-view__field-error">{fieldErrors.time}</p>
          ) : null}
        </div>

        <label className="book-view__field">
          <span className="book-view__label">Notes (optional)</span>
          <textarea
            className="book-view__input book-view__textarea"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Preferences, allergies, etc."
          />
        </label>

        {error ? (
          <div className="book-view__error" role="alert">
            <p>{error}</p>
            {errorDetail ? (
              <p className="book-view__error-detail">{errorDetail}</p>
            ) : null}
          </div>
        ) : null}

        <div className="book-view__actions">
          <button
            type="submit"
            className="form-btn form-btn--primary book-view__submit"
            disabled={saving}
          >
            {saving ? 'Booking…' : 'Book Appointment'}
          </button>
          <button
            type="button"
            className="form-btn book-view__import"
            onClick={() => setShowPhotoImport(true)}
          >
            <Camera size={18} strokeWidth={2.25} aria-hidden="true" />
            <span>Import Calendar from Photo</span>
          </button>
        </div>
      </form>

      {showAddClient ? (
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
      ) : null}

      {showPhotoImport ? (
        <PhotoImport
          initialMode="calendar"
          onClose={() => setShowPhotoImport(false)}
        />
      ) : null}
    </div>
  )
}
