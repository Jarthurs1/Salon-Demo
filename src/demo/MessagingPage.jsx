import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppointments } from '../hooks/useAppointments.js'
import { useClients } from '../hooks/useClients.js'
import { useReminderSettings, useScheduleSettings } from '../hooks/useScheduleSettings.js'
import { confirmDemoAppointment } from './customerFlow.js'
import { focusCustomerAppointment } from './focus.js'
import { formatVisit } from './formatVisit.js'
import {
  buildDayBriefing,
  buildFollowUpDigest,
  findEmilyPayment,
  linesOrNone,
} from './inboxStories.js'
import { previewPaymentReminder } from './payments.js'
import {
  REMINDER_INTERVAL_OPTIONS,
  reminderSettingsAreValid,
  toggleReminderInterval,
} from '../reminders/reminderSettings.js'
import { updateReminderSettings } from '../services/settingsRepository.js'
import { money } from './showcase.js'
import {
  SMS_YES,
  conversationFor,
  reminderPhrase,
} from './smsPreview.js'
import { formatTimeDisplay } from '../utils/dateUtils.js'
import DemoIntro from './DemoIntro.jsx'
import { MESSAGING_PANELS } from './sections.js'

const METHODS = [
  ['sms', 'SMS'],
  ['email', 'Email'],
  ['both', 'Both'],
  ['none', 'None'],
]

const TIMING_LABELS = {
  1: '1 day before',
  2: '2 days before',
  7: '7 days before',
}

function visitTime(appointment) {
  return formatTimeDisplay(appointment?.startTime || '09:00')
}

function MailPreview({ from, to, subject, date, children, actions }) {
  return (
    <article className="mail">
      <header className="mail__head">
        <p><span>From</span> {from}</p>
        <p><span>To</span> {to}</p>
        <p><span>Date</span> {date}</p>
        <h3>{subject}</h3>
      </header>
      <div className="mail__body">{children}</div>
      {actions ? <div className="mail__actions">{actions}</div> : null}
    </article>
  )
}

function SwitchRow({ label, value, options, onChange }) {
  return (
    <div className="mail-switch" role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id} type="button" className={value === id ? 'is-active' : ''} onClick={() => onChange(id)}>
          {text}
        </button>
      ))}
    </div>
  )
}

function ReminderOff({ children }) {
  return <p className="demo-page__notice">{children}</p>
}

export default function MessagingPage() {
  const appointments = useAppointments()
  const clients = useClients()
  const reminders = useReminderSettings()
  const schedule = useScheduleSettings()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const requested = params.get('panel')
  const panel = requested === 'sms' || requested === 'email'
    ? 'confirmations'
    : MESSAGING_PANELS.some(([id]) => id === requested)
      ? requested
      : 'confirmations'
  const [channel, setChannel] = useState(requested === 'email' ? 'email' : 'text')
  const emily = findEmilyPayment(appointments)
  const payable = appointments.find((item) => item.payment?.status === 'requested')
    || appointments.find((item) => item.payment?.status === 'paid' || item.payment?.status === 'paid_outside')
    || emily
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [emailKind, setEmailKind] = useState('confirm')
  const [paymentKind, setPaymentKind] = useState('request')
  const [reminderHours, setReminderHours] = useState('24 hours')
  const stylist = schedule?.stylistName || 'Mara'
  const phrase = reminderPhrase(reminders?.intervalsDays, emily ? visitTime(emily) : '9:00 AM')
  const messageKind = emailKind === 'reminder' ? 'reminder' : 'confirm'
  const messages = conversationFor(emily?.status, phrase, messageKind)
  const canConfirm = emily?.status === 'pending'
  const visitDate = emily ? formatVisit(emily.date, '').replace(/ at $/, '') : 'the appointment day'
  const visitWhen = emily ? formatVisit(emily.date, emily.startTime) : 'the scheduled time'
  const payName = payable?.clientName || 'Emily Carter'
  const payFirst = payName.split(' ')[0]
  const payDate = payable ? formatVisit(payable.date, '').replace(/ at $/, '') : visitDate
  const payWhen = payable ? formatVisit(payable.date, payable.startTime) : visitWhen
  const payReady = payable?.payment?.status === 'requested' || payable?.payment?.status === 'paid'
  const payAmount = payReady ? money(payable.payment.amountCents) : 'Added when Mara marks the visit completed'
  const briefing = buildDayBriefing(appointments, clients)
  const digest = buildFollowUpDigest(appointments, clients)
  const approved = appointments.filter((item) => item.rescheduleRequest?.status === 'approved')
  const scheduleLabel = (reminders?.intervalsDays || [1]).map((day) => TIMING_LABELS[day] || `${day} days before`).join(', ')

  function openCustomer(mode) {
    openAppointment(emily, mode)
  }

  function openAppointment(appointment, mode) {
    if (!appointment) return
    focusCustomerAppointment(appointment.id, mode)
    navigate(mode === 'pay' ? '/customer?step=pay' : '/customer?step=manage')
  }

  async function confirmFromMessage() {
    setError('')
    if (!emily) return
    if (!canConfirm) {
      setNotice('Emily’s appointment is already confirmed.')
      return
    }
    const result = await confirmDemoAppointment(emily.id)
    if (result?.ok === false) {
      setError(result.message || 'This appointment cannot be confirmed right now.')
      return
    }
    setDraft('')
    setNotice(result?.code === 'already_confirmed'
      ? 'Emily’s appointment is already confirmed.'
      : 'Emily’s appointment is confirmed on the stylist calendar.')
  }

  async function sendDraft(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    if (text.toUpperCase() === SMS_YES) {
      await confirmFromMessage()
      return
    }
    setError('Reply YES to confirm this appointment.')
  }

  async function changeMethod(method) {
    setError('')
    const next = { method, intervalsDays: reminders?.intervalsDays || [1] }
    if (!reminderSettingsAreValid(next)) {
      setError('Choose at least one reminder day when reminders are on.')
      return
    }
    await updateReminderSettings(next)
  }

  async function changeTiming(day, checked) {
    setError('')
    const next = toggleReminderInterval(reminders, day, checked)
    if (!reminderSettingsAreValid(next)) {
      setError('Choose at least one reminder day when reminders are on.')
      return
    }
    await updateReminderSettings(next)
  }

  async function showPaymentReminder(hours) {
    setError('')
    setReminderHours(hours)
    setPaymentKind('reminder')
    const result = await previewPaymentReminder(payable?.id, hours === '72 hours' ? '72h' : '24h')
    const label = hours.replace(' hours', '-hour')
    setNotice(result.ok ? `A simulated ${label} payment reminder was added for this visit.` : result.message)
  }

  const timingNote = reminders?.method === 'none'
    ? 'Appointment reminders are turned off.'
    : `Showing the ${scheduleLabel} reminder.`
  const visibleChannel = channel === 'email' ? 'email' : 'text'

  return (
    <section className="demo-page messaging-page">
      <DemoIntro
        title="Messages"
        subtitle="Customers confirm and pay from their messages. You choose how reminders work."
      />
      <div className="demo-steps demo-steps--three" role="tablist" aria-label="Message examples">
        {MESSAGING_PANELS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={panel === id} className={panel === id ? 'is-active' : ''} onClick={() => setParams({ panel: id })}>
            {label}
          </button>
        ))}
      </div>
      {notice ? <p className="demo-page__status" role="status">{notice}</p> : null}
      {error ? <p className="demo-page__status" role="alert">{error}</p> : null}

      {panel === 'confirmations' ? (
        <div className="message-stack">
          {reminders?.method === 'none' ? (
            <ReminderOff>Appointment reminders are off. Turn SMS, Email, or Both back on below.</ReminderOff>
          ) : (
            <>
              <SwitchRow
                label="Message examples"
                value={visibleChannel}
                onChange={setChannel}
                options={[['text', 'Text'], ['email', 'Email']]}
              />
              {visibleChannel === 'text' ? (
                <>
                  <p className="try-it"><strong>Try it:</strong> Tap Confirm Appointment, or reply YES.</p>
                  <SwitchRow
                    label="Text examples"
                    value={emailKind}
                    onChange={setEmailKind}
                    options={[['confirm', 'Confirmation'], ['reminder', 'Reminder']]}
                  />
                  <p className="sms-auto">Sent automatically. The stylist does not write or send this text.</p>
                  <div className="sms-phone">
                    <header className="sms-phone__top">
                      <span className="sms-back" aria-hidden="true">‹</span>
                      <div className="sms-phone__identity">
                        <span className="sms-phone__avatar" aria-hidden="true">L</span>
                        <p>Lumen & Co.</p>
                        <span className="sms-phone__kind">SMS</span>
                      </div>
                    </header>
                    <div className="sms-thread" aria-live="polite">
                      <p className="sms-time">Today</p>
                      {messages.map((message) => (
                        <p key={`${message.from}-${message.text}`} className={`sms-bubble sms-bubble--${message.from}`}>
                          {message.text}
                          {message.actions ? (
                            <span className="sms-links">
                              {canConfirm ? (
                                <button type="button" onClick={confirmFromMessage}>Confirm Appointment</button>
                              ) : null}
                              <button type="button" onClick={() => openCustomer('manage')}>Manage Appointment</button>
                            </span>
                          ) : null}
                        </p>
                      ))}
                    </div>
                    <form className="sms-composer" onSubmit={sendDraft}>
                      <input
                        aria-label="Text Message"
                        placeholder="Text Message"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                      />
                      <button type="submit" aria-label="Send" disabled={!draft.trim()}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 19V6M6 12l6-6 6 6" />
                        </svg>
                      </button>
                    </form>
                  </div>
                </>
              ) : emily ? (
                <>
                  <p className="try-it"><strong>Try it:</strong> Confirm the appointment or open Manage Appointment.</p>
                  <SwitchRow
                    label="Email examples"
                    value={emailKind}
                    onChange={setEmailKind}
                    options={[['confirm', 'Confirmation'], ['reminder', 'Reminder']]}
                  />
                  <MailPreview
                    from="Lumen & Co."
                    to="Emily Carter"
                    subject={emailKind === 'reminder' ? 'Appointment Reminder — Lumen & Co.' : 'Please Confirm Your Appointment — Lumen & Co.'}
                    date={visitDate}
                    actions={(
                      <>
                        <button type="button" onClick={confirmFromMessage}>Confirm Appointment</button>
                        <button type="button" className="is-quiet" onClick={() => openCustomer('manage')}>Manage Appointment</button>
                      </>
                    )}
                  >
                    <p>Hi Emily,</p>
                    <p>This is a reminder about your upcoming appointment.</p>
                    <p><strong>Service:</strong> {emily.service}</p>
                    <p><strong>Date:</strong> {visitDate}</p>
                    <p><strong>Time:</strong> {visitTime(emily)}</p>
                    <p><strong>Stylist:</strong> {stylist}</p>
                    <p>We look forward to seeing you!</p>
                  </MailPreview>
                </>
              ) : null}
            </>
          )}
          <form className="settings-preview" onSubmit={(event) => event.preventDefault()}>
            <p className="try-it"><strong>Try it:</strong> Change when and how customers receive reminders.</p>
            <h3>Stylist Reminder Settings</h3>
            <p>Choose how and when your customers receive automatic reminders.</p>
            <fieldset>
              <legend>Notification Method</legend>
              <div className="settings-preview__choices">
                {METHODS.map(([id, label]) => (
                  <label key={id}>
                    <input type="radio" name="reminder-method" value={id} checked={reminders?.method === id} onChange={() => changeMethod(id)} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset disabled={reminders?.method === 'none'}>
              <legend>Reminder Timing</legend>
              <div className="settings-preview__choices">
                {REMINDER_INTERVAL_OPTIONS.map((day) => (
                  <label key={day}>
                    <input
                      type="checkbox"
                      checked={(reminders?.intervalsDays || []).includes(day)}
                      onChange={(event) => changeTiming(day, event.target.checked)}
                    />
                    {TIMING_LABELS[day]}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="feature-card__note">{timingNote} The stylist app’s Settings uses this same choice. Nothing is sent.</p>
          </form>
        </div>
      ) : null}

      {panel === 'payments' && payable ? (
        <div className="message-stack">
          <h3 className="message-heading">Get paid without chasing customers</h3>
          <p className="message-lead">After an appointment, your customer automatically receives a payment request and can add a tip.</p>
          <p className="try-it"><strong>Try it:</strong> Open Review & Pay, add a tip, and approve the payment.</p>
          <SwitchRow
            label="Payment emails"
            value={paymentKind}
            onChange={setPaymentKind}
            options={[['request', 'Payment request'], ['reminder', 'Payment reminder'], ['receipt', 'Receipt']]}
          />
          {paymentKind === 'request' ? (
            <MailPreview
              from="Lumen & Co."
              to={payName}
              subject="Thank You for Visiting Lumen & Co."
              date={payDate}
              actions={<button type="button" onClick={() => openAppointment(payable, 'pay')}>Review & Pay</button>}
            >
              <p>Hi {payFirst},</p>
              <p>Thank you for visiting Lumen & Co.!</p>
              <p>Please review your final service amount, add an optional tip, and approve your payment.</p>
              <p><strong>Service:</strong> {payable.service}</p>
              <p><strong>Visit:</strong> {payWhen}</p>
              <p><strong>Amount:</strong> {payAmount}</p>
            </MailPreview>
          ) : null}
          {paymentKind === 'reminder' ? (
            <MailPreview
              from="Lumen & Co."
              to={payName}
              subject="Payment reminder — Lumen & Co."
              date={payDate}
              actions={<button type="button" onClick={() => openAppointment(payable, 'pay')}>Review & Pay</button>}
            >
              <p>Hi {payFirst},</p>
              <p>Your {payable.service} on {payWhen} is still awaiting payment. This reminder is the one sent {reminderHours} after the visit.</p>
              <div className="mail-switch">
                <button type="button" onClick={() => showPaymentReminder('24 hours')}>24-hour reminder</button>
                <button type="button" onClick={() => showPaymentReminder('72 hours')}>72-hour reminder</button>
              </div>
            </MailPreview>
          ) : null}
          {paymentKind === 'receipt' ? (
            <MailPreview
              from="Lumen & Co."
              to={payName}
              subject="Payment receipt — Lumen & Co."
              date={payDate}
              actions={<button type="button" onClick={() => openAppointment(payable, 'pay')}>Review & Pay</button>}
            >
              {payable.payment?.status === 'paid' ? (
                <>
                  <p>Hi {payFirst},</p>
                  <p>Thank you. This receipt is for your visit.</p>
                  <p><strong>Customer:</strong> {payName}</p>
                  <p><strong>Service:</strong> {payable.service}</p>
                  <p><strong>Service amount:</strong> {money(payable.payment.amountCents)}</p>
                  <p><strong>Tip:</strong> {money(payable.payment.tipCents)}</p>
                  <p><strong>Total paid:</strong> {money((payable.payment.amountCents || 0) + (payable.payment.tipCents || 0))}</p>
                  <p><strong>Status:</strong> Paid</p>
                </>
              ) : (
                <>
                  <p>Hi {payFirst},</p>
                  <p>Your receipt appears here after you approve the payment.</p>
                </>
              )}
            </MailPreview>
          ) : null}
        </div>
      ) : null}

      {panel === 'daily' ? (
        <div className="message-stack">
          <p className="try-it"><strong>Try it:</strong> Open Mara’s calendar from her morning email.</p>
          <MailPreview
            from="Lumen & Co."
            to={`${stylist} · Lumen & Co.`}
            subject="Your Day at a Glance"
            date={briefing.dateLabel}
            actions={<button type="button" onClick={() => navigate('/stylist')}>Open Stylist Calendar</button>}
          >
            <p>Hi {stylist},</p>
            <p><strong>Today’s appointments · {briefing.dateLabel}</strong></p>
            <ul>{linesOrNone(briefing.appointments).map((line) => <li key={line}>{line}</li>)}</ul>
            <p><strong>Needs your attention</strong></p>
            <ul>{linesOrNone([...briefing.reschedules, ...briefing.unpaid, ...briefing.withoutCard]).map((line) => <li key={line}>{line}</li>)}</ul>
            <p><strong>Yesterday’s changes</strong></p>
            <ul>
              {linesOrNone([
                ...digest.cancellations.map((line) => `Canceled: ${line}`),
                ...digest.bookings.map((line) => `New booking: ${line}`),
                ...digest.confirmations.map((line) => `Confirmed: ${line}`),
                ...approved.map((item) => `Approved reschedule: ${item.clientName}`),
              ]).map((line) => <li key={line}>{line}</li>)}
            </ul>
          </MailPreview>
        </div>
      ) : null}
    </section>
  )
}
