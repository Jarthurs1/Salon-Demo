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
  methodWantsEmail,
  methodWantsSms,
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
  const panel = MESSAGING_PANELS.some(([id]) => id === params.get('panel')) ? params.get('panel') : 'sms'
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
  const messages = conversationFor(emily?.status, phrase)
  const showSms = methodWantsSms(reminders?.method)
  const showEmail = methodWantsEmail(reminders?.method)
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
    : `This preview follows Mara’s schedule: ${scheduleLabel}.`

  return (
    <section className="demo-page messaging-page">
      <DemoIntro
        title="Automated Confirmations & Reminders"
        subtitle="Your customers get timely reminders, and your calendar stays up to date — without you having to chase anyone."
      />
      <div className="demo-steps" role="tablist" aria-label="Message examples">
        {MESSAGING_PANELS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={panel === id} className={panel === id ? 'is-active' : ''} onClick={() => setParams({ panel: id })}>
            {label}
          </button>
        ))}
      </div>
      {notice ? <p className="demo-page__status" role="status">{notice}</p> : null}
      {error ? <p className="demo-page__status" role="alert">{error}</p> : null}

      <form className="settings-preview" onSubmit={(event) => event.preventDefault()}>
        <h3>Stylist Reminder Settings</h3>
        <p>Mara chooses how and when Simple Salon reminds her customers. Once set, reminders happen automatically.</p>
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
        <p className="feature-card__note">{timingNote} The same choices are in the stylist app’s Settings. Nothing is sent.</p>
      </form>

      {panel === 'sms' ? (
        showSms ? (
          <div className="message-layout">
            <div className="sms-phone">
              <header className="sms-phone__top">
                <span className="sms-phone__avatar" aria-hidden="true">L</span>
                <div>
                  <p>Lumen & Co.</p>
                  <span>Text Message</span>
                </div>
              </header>
              <div className="sms-thread" aria-live="polite">
                <p className="sms-time">{phrase}</p>
                {messages.map((message) => (
                  <p key={`${message.from}-${message.text}`} className={`sms-bubble sms-bubble--${message.from}`}>
                    {message.text}
                    {message.manage ? (
                      <button type="button" className="sms-link" onClick={() => openCustomer('manage')}>
                        Manage appointment
                      </button>
                    ) : null}
                  </p>
                ))}
              </div>
              <form className="sms-composer" onSubmit={sendDraft}>
                <button type="button" className="sms-chip" onClick={confirmFromMessage} disabled={!canConfirm}>
                  YES
                </button>
                <input
                  aria-label="Text Message"
                  placeholder="Text Message"
                  value={draft}
                  disabled={!canConfirm}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <button type="submit" aria-label="Send" disabled={!canConfirm}>Send</button>
              </form>
            </div>
            <aside>
              <p>Emily can reply YES or tap YES. Mara sees Confirmed on her calendar. Manage appointment opens Emily’s appointment, where she can cancel or ask for a different time.</p>
              <p className="feature-card__note">These are simulated messages. Nothing is sent to a phone.</p>
            </aside>
          </div>
        ) : (
          <ReminderOff>
            {reminders?.method === 'none'
              ? 'Text reminders are off. Mara can turn SMS or Both back on above.'
              : 'Mara sends appointment reminders by email. Text reminders are off.'}
          </ReminderOff>
        )
      ) : null}

      {panel === 'email' ? (
        showEmail && emily ? (
          <div className="message-stack">
            <SwitchRow
              label="Email examples"
              value={emailKind}
              onChange={setEmailKind}
              options={[['confirm', 'Confirmation'], ['reminder', 'Reminder']]}
            />
            <p className="feature-card__note">Customers confirm from the email, so Mara does not have to text each person.</p>
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
          </div>
        ) : (
          <ReminderOff>
            {reminders?.method === 'none'
              ? 'Email reminders are off. Mara can turn Email or Both back on above.'
              : 'Mara sends appointment reminders by text. Email reminders are off.'}
          </ReminderOff>
        )
      ) : null}

      {panel === 'payments' && payable ? (
        <div className="message-stack">
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
          <p className="feature-card__note">Delivered at 8 AM so Mara can prepare for the day. This is a sample of that briefing.</p>
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
