import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppointments } from '../hooks/useAppointments.js'
import { useClients } from '../hooks/useClients.js'
import { confirmDemoAppointment } from './customerFlow.js'
import { focusCustomerAppointment } from './focus.js'
import { formatVisit } from './formatVisit.js'
import {
  buildDayBriefing,
  buildFollowUpDigest,
  EMILY_PAYMENT_APPOINTMENT_ID,
  findEmilyPayment,
  linesOrNone,
} from './inboxStories.js'
import { previewPaymentReminder } from './payments.js'
import { money } from './showcase.js'
import {
  SMS_CONFIRMED,
  SMS_REMINDER,
  SMS_YES,
  conversationFor,
} from './smsPreview.js'
import DemoIntro from './DemoIntro.jsx'
import { MESSAGING_PANELS } from './sections.js'

const SETTINGS_KEY = 'salon-demo.messaging-settings.v1'

function readSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '')
    if (parsed && ['sms', 'email', 'both', 'none'].includes(parsed.channel)) return parsed
  } catch {
    /* use the default */
  }
  return { channel: 'both', timing: '1' }
}

export default function MessagingPage() {
  const appointments = useAppointments()
  const clients = useClients()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const panel = MESSAGING_PANELS.some(([id]) => id === params.get('panel')) ? params.get('panel') : 'sms'
  const emily = findEmilyPayment(appointments)
  const [settings, setSettings] = useState(readSettings)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const messages = conversationFor(emily?.status)
  const briefing = buildDayBriefing(appointments, clients)
  const digest = buildFollowUpDigest(appointments, clients)
  const approved = appointments.filter((item) => item.rescheduleRequest?.status === 'approved')

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  function openCustomer(mode) {
    if (!emily) return
    focusCustomerAppointment(emily.id, mode)
    navigate(mode === 'pay' ? '/customer?step=pay' : '/customer?step=manage')
  }

  async function confirmFromMessage() {
    setError('')
    if (!emily) return
    if (emily.status === 'confirmed') {
      setNotice('Emily’s appointment is already confirmed.')
      return
    }
    const result = await confirmDemoAppointment(emily.id)
    if (result?.ok === false) {
      setError(result.message || 'This appointment cannot be confirmed right now.')
      return
    }
    setNotice('Emily’s appointment is confirmed on the stylist calendar.')
  }

  async function previewReminder(which) {
    setError('')
    const result = await previewPaymentReminder(EMILY_PAYMENT_APPOINTMENT_ID, which)
    setNotice(result.ok ? `A simulated ${which === '72h' ? '72-hour' : '24-hour'} reminder was added for this visit.` : result.message)
  }

  return (
    <section className="demo-page messaging-page">
      <DemoIntro title="Automated Messaging" subtitle="Less chasing confirmations. More time styling." />
      <p className="demo-page__support">Simple Salon automatically handles appointment reminders, confirmations, payment follow-ups, and daily stylist updates.</p>
      <div className="demo-steps" role="tablist" aria-label="Message examples">
        {MESSAGING_PANELS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={panel === id} className={panel === id ? 'is-active' : ''} onClick={() => setParams({ panel: id })}>
            {label}
          </button>
        ))}
      </div>
      {notice ? <p className="demo-page__status" role="status">{notice}</p> : null}
      {error ? <p className="demo-page__status" role="alert">{error}</p> : null}

      {panel === 'sms' ? (
        <div className="message-layout">
          <div className="sms-phone">
            <header className="sms-phone__top">
              <p>Lumen & Co.</p>
              <span>Emily Carter</span>
            </header>
            <div className="sms-thread" aria-live="polite">
              {messages.map((message) => (
                <p key={`${message.from}-${message.text}`} className={`sms-bubble sms-bubble--${message.from}`}>{message.text}</p>
              ))}
            </div>
            <div className="sms-actions">
              <button type="button" onClick={confirmFromMessage}>Confirm Appointment</button>
              <button type="button" onClick={() => { setNotice(''); openCustomer('manage') }}>Manage Appointment</button>
              <button type="button" onClick={confirmFromMessage}>{SMS_YES}</button>
            </div>
          </div>
          <aside>
            <p>Emily can confirm by tapping the button or replying YES. Mara sees Confirmed on her calendar without making a call.</p>
            <p className="feature-card__note">These are simulated messages. Nothing is sent to a phone.</p>
          </aside>
        </div>
      ) : null}

      {panel === 'email' && emily ? (
        <article className="letter">
          <p className="letter__to">To Emily Carter</p>
          <h3>Please Confirm Your Appointment — Lumen & Co.</h3>
          <p>Hi Emily,</p>
          <p>Please confirm your {emily.service} on {formatVisit(emily.date, emily.startTime)}.</p>
          <p>Automated reminders let customers confirm appointments without requiring the stylist to contact each person.</p>
          <div className="letter__actions">
            <button type="button" onClick={confirmFromMessage}>Confirm Appointment</button>
            <button type="button" onClick={() => openCustomer('manage')}>Manage Appointment</button>
          </div>
        </article>
      ) : null}

      {panel === 'payments' ? (
        <div className="message-stack">
          <article className="letter">
            <p className="letter__to">To Emily Carter</p>
            <h3>Thank You for Visiting Lumen & Co.</h3>
            <p>Hi Emily,</p>
            <p>Thank you for visiting Lumen & Co.!</p>
            <p>Please review your final service amount, add an optional tip, and approve your payment.</p>
            {emily?.payment?.status === 'requested' ? <p>{emily.service}: {money(emily.payment.amountCents)}</p> : <p>This email is created when Mara marks the visit completed.</p>}
            <div className="letter__actions">
              <button type="button" onClick={() => openCustomer('pay')} disabled={emily?.payment?.status !== 'requested' && emily?.payment?.status !== 'paid'}>Review & Pay</button>
            </div>
          </article>
          <article className="letter">
            <h3>Payment reminder</h3>
            <p>Customers receive a friendly reminder after 24 hours and a final reminder after 72 hours if payment is still outstanding.</p>
            <div className="letter__actions">
              <button type="button" onClick={() => previewReminder('24h')}>Preview 24-hour reminder</button>
              <button type="button" onClick={() => previewReminder('72h')}>Preview 72-hour reminder</button>
            </div>
          </article>
          {emily?.payment?.status === 'paid' ? (
            <article className="letter">
              <h3>Payment receipt</h3>
              <p>Customer: Emily Carter</p>
              <p>Service: {emily.service}</p>
              <p>Service amount: {money(emily.payment.amountCents)}</p>
              <p>Tip: {money(emily.payment.tipCents)}</p>
              <p>Total paid: {money((emily.payment.amountCents || 0) + (emily.payment.tipCents || 0))}</p>
              <p>Status: Paid</p>
            </article>
          ) : null}
        </div>
      ) : null}

      {panel === 'daily' ? (
        <article className="letter">
          <p className="letter__to">To Mara · Lumen & Co.</p>
          <h3>Your Day at a Glance</h3>
          <p>Delivered at 8 AM to help the stylist prepare for the day and identify anything requiring attention. This is a sample of that briefing, not a change to a live email schedule.</p>
          <h4>Today’s appointments · {briefing.dateLabel}</h4>
          <ul>{linesOrNone(briefing.appointments).map((line) => <li key={line}>{line}</li>)}</ul>
          <h4>Needs your attention</h4>
          <ul>
            {linesOrNone([...briefing.reschedules, ...briefing.unpaid, ...briefing.withoutCard]).map((line) => <li key={line}>{line}</li>)}
          </ul>
          <h4>Yesterday’s changes</h4>
          <ul>
            {linesOrNone([
              ...digest.cancellations.map((line) => `Canceled: ${line}`),
              ...digest.bookings.map((line) => `New booking: ${line}`),
              ...digest.confirmations.map((line) => `Confirmed: ${line}`),
              ...approved.map((item) => `Approved reschedule: ${item.clientName}`),
            ]).map((line) => <li key={line}>{line}</li>)}
          </ul>
          <div className="letter__actions">
            <button type="button" onClick={() => navigate('/stylist')}>Open Stylist Calendar</button>
          </div>
        </article>
      ) : null}

      <form className="settings-preview" onSubmit={(event) => event.preventDefault()}>
        <h3>Reminder preferences</h3>
        <p>Mara can choose how customers are reminded. This choice stays in the browser and does not send a message.</p>
        <label>
          Channel
          <select value={settings.channel} onChange={(event) => setSettings((current) => ({ ...current, channel: event.target.value }))}>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="both">Both</option>
            <option value="none">None</option>
          </select>
        </label>
        <label>
          Reminder timing
          <select value={settings.timing} onChange={(event) => setSettings((current) => ({ ...current, timing: event.target.value }))}>
            <option value="1">1 day</option>
            <option value="2">2 days</option>
            <option value="7">7 days</option>
          </select>
        </label>
      </form>
      <p className="feature-card__note">Sample reminder: {SMS_REMINDER.split('\n')[0]} {emily?.status === 'confirmed' ? SMS_CONFIRMED : ''}</p>
    </section>
  )
}
