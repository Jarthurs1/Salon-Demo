import { useEffect, useMemo, useRef, useState } from 'react'
import DateSelector from './DateSelector.jsx'
import SalonFrame from './SalonFrame.jsx'
import TimeSelector from './TimeSelector.jsx'
import { useClients } from '../hooks/useClients.js'
import { useAppointments } from '../hooks/useAppointments.js'
import { useScheduleSettings } from '../hooks/useScheduleSettings.js'
import { isClosedDay } from '../data/schedule.js'
import { SERVICE_OPTIONS } from '../data/services.js'
import { getAvailableStartTimes } from '../utils/conflictUtils.js'
import {
  addDays,
  formatSelectedDate,
  formatTimeDisplay,
  parseDateKey,
  startOfDay,
  toDateKey,
} from '../utils/dateUtils.js'
import {
  bookDemoAppointment,
  cancelDemoAppointment,
  confirmDemoAppointment,
  requestDemoReschedule,
} from '../demo/customerFlow.js'
import { approveDemoPayment, tipCentsFor } from '../demo/payments.js'
import { money } from '../demo/showcase.js'
import { peekCustomerFocus, subscribeCustomerFocus, takeCustomerFocus } from '../demo/focus.js'
import { EMILY_CLIENT_ID, EMILY_PAYMENT_APPOINTMENT_ID, findPayableAppointment } from '../demo/inboxStories.js'
import './theme.css'
import './BookingPage.css'

const TIP_CHOICES = [
  { id: '0', label: 'No Tip' },
  { id: '15', label: '15%' },
  { id: '20', label: '20%' },
  { id: '25', label: '25%' },
  { id: 'custom', label: 'Custom Amount' },
]

function sanitizeTipInput(value) {
  const cleaned = String(value).replace(/[^\d.]/g, '')
  const [whole, ...rest] = cleaned.split('.')
  if (!rest.length) return whole.slice(0, 4)
  return `${whole.slice(0, 4)}.${rest.join('').slice(0, 2)}`
}

export default function CustomerDemo({ step = 'book' }) {
  const clients = useClients()
  const appointments = useAppointments()
  const settings = useScheduleSettings()
  const [clientId, setClientId] = useState(EMILY_CLIENT_ID)
  const [appointmentId, setAppointmentId] = useState(EMILY_PAYMENT_APPOINTMENT_ID)
  const [mode, setMode] = useState(step === 'pay' ? 'pay' : step === 'manage' ? 'manage' : 'book-service')
  const [service, setService] = useState(SERVICE_OPTIONS[0])
  const [dateKey, setDateKey] = useState('')
  const [startTime, setStartTime] = useState('')
  const [tipChoice, setTipChoice] = useState('15')
  const [customTip, setCustomTip] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const started = useRef('')
  const focused = useRef(false)
  const today = useMemo(() => startOfDay(new Date()), [])
  const tomorrow = useMemo(() => addDays(today, 1), [today])
  const horizon = useMemo(() => addDays(today, 90), [today])
  const client = clients.find((item) => item.id === clientId) || null
  const todayKey = toDateKey(today)
  const mine = appointments
    .filter((item) => item.clientId === clientId && item.type !== 'blocked')
    .filter((item) => item.date >= todayKey || item.payment?.status === 'requested' || item.status === 'reschedule_requested' || item.status === 'canceled')
    .slice(0, 8)
  const selected = mine.find((item) => item.id === appointmentId) || null

  useEffect(() => {
    function apply(focus) {
      if (!focus?.appointmentId) return
      const match = appointments.find((item) => item.id === focus.appointmentId)
      if (!match) return
      setClientId(match.clientId)
      setAppointmentId(match.id)
      setMode(focus.mode === 'pay' ? 'pay' : 'manage')
      focused.current = true
      takeCustomerFocus()
    }
    apply(peekCustomerFocus())
    return subscribeCustomerFocus(apply)
  }, [appointments])

  useEffect(() => {
    if (focused.current || started.current === step || peekCustomerFocus()?.appointmentId) return
    if (!appointments.length || !clients.length) return
    started.current = step
    if (step === 'pay') {
      const payable = findPayableAppointment(appointments)
      if (!payable) return
      setClientId(payable.clientId)
      setAppointmentId(payable.id)
      setMode('pay')
      return
    }
    const emily = clients.find((item) => item.id === EMILY_CLIENT_ID)
    if (!emily) return
    setClientId(emily.id)
    const featured = appointments.find((item) => item.id === EMILY_PAYMENT_APPOINTMENT_ID)
    if (featured) setAppointmentId(featured.id)
  }, [appointmentId, appointments, clients, step])

  function timesFor(day, excludeId) {
    return getAvailableStartTimes(day, service.defaultDurationMinutes, appointments, { excludeId })
  }

  function openTimes(day) {
    if (day < startOfDay(tomorrow) || isClosedDay(day)) return false
    return timesFor(day, mode.startsWith('reschedule') ? appointmentId : '').length > 0
  }

  async function run(action, nextMode) {
    setError('')
    try {
      const result = await action()
      if (result && result.ok === false) {
        setError(result.message || 'That change is not available.')
        return
      }
      setMode(nextMode)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    }
  }

  const tipCents = selected?.payment
    ? tipCentsFor(selected.payment.amountCents, tipChoice, customTip)
    : 0

  return (
    <div className="customer-demo">
      <SalonFrame salonName={settings.salonName || 'Lumen & Co.'}>
        <section className="book-page__card">
          {notice ? <p role="status">{notice}</p> : null}
          {error ? <p className="book-page__error" role="alert">{error}</p> : null}
          {mode === 'pick' ? (
            <>
              <h2>Choose a customer</h2>
              <div className="customer-choices">
                {clients.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="customer-choice"
                    onClick={() => {
                      setClientId(item.id)
                      setMode('home')
                      setNotice('')
                    }}
                  >
                    <strong>{item.displayName}</strong>
                    <small>{item.savedCard ? `${item.savedCard.brand} ···· ${item.savedCard.last4}` : 'No card on file'}</small>
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {client && mode === 'home' ? (
            <>
              <h2>{client.firstName}&rsquo;s appointments</h2>
              <p>{client.savedCard ? `Saved card ${client.savedCard.brand} ···· ${client.savedCard.last4}` : 'No saved card. Payment approval stays simulated.'}</p>
              <div className="customer-appointments">
                {mine.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="customer-appointment"
                    onClick={() => {
                      setAppointmentId(item.id)
                      setMode(item.payment?.status === 'requested' ? 'pay' : 'manage')
                    }}
                  >
                    <strong>{item.service}</strong>
                    <span>{formatSelectedDate(parseDateKey(item.date))} at {formatTimeDisplay(item.startTime)}</span>
                    <span>{item.status.replaceAll('_', ' ')}{item.payment?.status === 'paid' ? ' · paid' : ''}{item.payment?.status === 'requested' ? ' · payment due' : ''}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="btn" onClick={() => setMode('book-service')}>Book an appointment</button>
            </>
          ) : null}
          {mode === 'book-service' || mode === 'reschedule-service' ? (
            <>
              <h2>Select a service</h2>
              <div className="customer-choices">
                {SERVICE_OPTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="customer-choice"
                    onClick={() => {
                      setService(item)
                      setDateKey('')
                      setStartTime('')
                      setMode(mode === 'reschedule-service' ? 'reschedule-date' : 'book-date')
                    }}
                  >
                    <strong>{item.label}</strong>
                    <small>{item.defaultDurationMinutes} min</small>
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {mode === 'book-date' || mode === 'reschedule-date' ? (
            <>
              <h2>Choose a date</h2>
              <DateSelector
                selectedKey={dateKey}
                today={today}
                minDate={tomorrow}
                maxDate={horizon}
                isDateEnabled={(day) => openTimes(day)}
                onSelect={(key) => {
                  setDateKey(key)
                  setStartTime('')
                  setMode(mode === 'reschedule-date' ? 'reschedule-time' : 'book-time')
                }}
              />
            </>
          ) : null}
          {mode === 'book-time' || mode === 'reschedule-time' ? (
            <>
              <h2>Choose a time</h2>
              <p>{dateKey ? formatSelectedDate(parseDateKey(dateKey)) : ''}</p>
              <TimeSelector
                times={dateKey ? timesFor(parseDateKey(dateKey), mode === 'reschedule-time' ? appointmentId : '') : []}
                value={startTime}
                onChange={setStartTime}
              />
              <button
                type="button"
                className="btn"
                disabled={!startTime}
                onClick={() => setMode(mode === 'reschedule-time' ? 'reschedule-review' : 'book-review')}
              >
                Review
              </button>
            </>
          ) : null}
          {mode === 'book-review' ? (
            <>
              <h2>Review</h2>
              <p>{service.label} · {formatSelectedDate(parseDateKey(dateKey))} at {formatTimeDisplay(startTime)}</p>
              <button
                type="button"
                className="btn"
                onClick={() => run(async () => {
                  await bookDemoAppointment(client, {
                    service: service.label,
                    serviceId: service.id,
                    durationMinutes: service.defaultDurationMinutes,
                    date: dateKey,
                    startTime,
                  })
                  setNotice('Your appointment is on the stylist calendar and waiting for confirmation.')
                }, 'home')}
              >
                Book appointment
              </button>
            </>
          ) : null}
          {selected && mode === 'manage' ? (
            <>
              <h2>Your appointment</h2>
              <p className="book-page__status">{selected.status.replaceAll('_', ' ')}</p>
              <p><strong>{selected.service}</strong></p>
              <p>{formatSelectedDate(parseDateKey(selected.date))} at {formatTimeDisplay(selected.startTime)}</p>
              {selected.rescheduleRequest?.status === 'pending' ? (
                <p>Your request has been sent. Your original appointment stays on the calendar until your stylist approves the new time.</p>
              ) : null}
              {selected.status === 'canceled' ? <p>This appointment is canceled and the time is available again.</p> : null}
              {selected.status === 'pending' ? (
                <button type="button" className="btn" onClick={() => run(() => confirmDemoAppointment(selected.id), 'manage')}>Confirm Appointment</button>
              ) : null}
              {selected.status !== 'canceled' && selected.rescheduleRequest?.status !== 'pending' ? (
                <button type="button" className="btn" onClick={() => setMode('reschedule-date')}>Ask to change your appointment</button>
              ) : null}
              {selected.status !== 'canceled' ? (
                <button type="button" className="btn btn--ghost" onClick={() => run(async () => {
                  const result = await cancelDemoAppointment(selected.id)
                  if (result?.ok === false) return result
                  setNotice('The appointment is canceled and that time is open again.')
                  return result
                }, 'manage')}>Cancel Appointment</button>
              ) : null}
            </>
          ) : null}
          {selected && mode === 'reschedule-review' ? (
            <>
              <h2>Review your request</h2>
              <p>Current: {formatSelectedDate(parseDateKey(selected.date))} at {formatTimeDisplay(selected.startTime)}</p>
              <p>Requested: {formatSelectedDate(parseDateKey(dateKey))} at {formatTimeDisplay(startTime)}</p>
              <p>The original time stays reserved until the salon approves this request.</p>
              <button
                type="button"
                className="btn"
                onClick={() => run(async () => {
                  const result = await requestDemoReschedule(selected.id, dateKey, startTime)
                  if (result?.ok === false) return result
                  setNotice('Your request has been sent. Your original appointment stays on the calendar until your stylist approves the new time.')
                  return result
                }, 'manage')}
              >
                Send request
              </button>
            </>
          ) : null}
          {mode === 'pay' && selected && selected.payment?.status !== 'requested' && selected.payment?.status !== 'paid' && selected.payment?.status !== 'paid_outside' ? (
            <>
              <h2>Thank you for visiting Lumen & Co.!</h2>
              <p>Please review your final service amount, add an optional tip, and confirm your payment.</p>
              <p>This opens after Mara marks {selected.service} completed. The payment email is created automatically.</p>
            </>
          ) : null}
          {selected?.payment?.status === 'paid_outside' && mode === 'pay' ? (
            <>
              <h2>Paid outside the app</h2>
              <p>{selected.service} was marked paid outside Simple Salon. No further reminder is sent.</p>
            </>
          ) : null}
          {selected?.payment?.status === 'paid' && mode === 'pay' ? (
            <>
              <h2>Payment complete</h2>
              <p>{`${selected.service} is paid. Total ${money((selected.payment.amountCents || 0) + (selected.payment.tipCents || 0))}. A sample receipt is with the messages.`}</p>
            </>
          ) : null}
          {selected?.payment?.status === 'requested' && mode === 'pay' ? (
            <>
              <h2>Thank you for visiting Lumen & Co.!</h2>
              <p>Please review your final service amount, add an optional tip, and confirm your payment.</p>
              <p>{selected.service} · {money(selected.payment.amountCents)}</p>
              <p>{client?.savedCard ? `Fictional saved card ${client.savedCard.brand} ···· ${client.savedCard.last4}` : 'No payment method is saved. Save one, or collect this payment in person. Approval here stays simulated.'}</p>
              <div className="tip-row">
                {TIP_CHOICES.map((choice) => (
                  <button key={choice.id} type="button" className={choice.id === tipChoice ? 'is-selected' : ''} onClick={() => setTipChoice(choice.id)}>
                    {choice.label}
                  </button>
                ))}
              </div>
              {tipChoice === 'custom' ? (
                <label className="tip-custom">
                  Custom tip
                  <input
                    inputMode="decimal"
                    value={customTip}
                    placeholder="0.00"
                    aria-label="Custom tip amount"
                    onChange={(event) => setCustomTip(sanitizeTipInput(event.target.value))}
                  />
                </label>
              ) : null}
              <p>Total {money(selected.payment.amountCents + tipCents)}</p>
              <button
                type="button"
                className="btn"
                onClick={() => run(async () => {
                  await approveDemoPayment(selected.id, tipCents)
                  setNotice('Payment approved. The stylist calendar shows Paid, and reminders stop.')
                }, 'pay')}
              >
                Approve & Pay
              </button>
            </>
          ) : null}
          {mode !== 'book-service' && mode !== 'manage' && mode !== 'pay' && mode !== 'pick' ? (
            <button type="button" className="btn btn--ghost" onClick={() => setMode(mode.startsWith('reschedule') ? 'manage' : 'book-service')}>Back</button>
          ) : null}
        </section>
      </SalonFrame>
    </div>
  )
}
