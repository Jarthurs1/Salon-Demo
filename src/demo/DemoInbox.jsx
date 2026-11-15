import { useState, useSyncExternalStore } from 'react'
import { useAppointments } from '../hooks/useAppointments.js'
import { useClients } from '../hooks/useClients.js'
import { focusCustomerAppointment, focusStylistView } from './focus.js'
import {
  buildDayBriefing,
  buildFollowUpDigest,
  emilyPaymentCopy,
  findEmilyPayment,
  linesOrNone,
} from './inboxStories.js'
import { listMessages, subscribeMailbox } from './mailbox.js'
import { previewPaymentReminder } from './payments.js'
import './demo.css'

function Story({ eyebrow, title, trigger, audience, why, children, prominent = false }) {
  return (
    <article className={prominent ? 'demo-story demo-story--prominent' : 'demo-story'}>
      <p className="demo-story__eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
      <dl className="demo-story__facts">
        <div>
          <dt>What triggers it</dt>
          <dd>{trigger}</dd>
        </div>
        <div>
          <dt>Who receives it</dt>
          <dd>{audience}</dd>
        </div>
        <div>
          <dt>Why it helps</dt>
          <dd>{why}</dd>
        </div>
      </dl>
      {children}
    </article>
  )
}

function Letter({ to, subject, children, actions }) {
  return (
    <div className="demo-letter">
      <p className="demo-letter__to">To {to}</p>
      <h4>{subject}</h4>
      <div className="demo-letter__body">{children}</div>
      {actions ? <div className="demo-inbox__actions">{actions}</div> : null}
    </div>
  )
}

function BulletList({ items }) {
  return (
    <ul className="demo-letter__list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function Briefing({ briefing, onOpenCalendar }) {
  return (
    <Story
      eyebrow="To Stylist · Daily at 8 AM"
      title="Your Day at a Glance"
      trigger="A sample 8 AM briefing that helps the stylist prepare for the day. It is separate from the changes-and-attention summary."
      audience="Mara at Lumen & Co."
      why="The stylist sees the book, open reschedule requests, missing cards, and unpaid visits before the first client."
    >
      <Letter
        to="Mara"
        subject="Your Day at a Glance"
        actions={<button type="button" onClick={onOpenCalendar}>Open Stylist Calendar</button>}
      >
        <p>Good morning, Mara. Here is {briefing.dateLabel} at Lumen & Co. This sample briefing is separate from the daily changes email.</p>
        <h5>Today’s appointments</h5>
        <BulletList items={linesOrNone(briefing.appointments)} />
        <h5>Outstanding reschedule requests</h5>
        <BulletList items={linesOrNone(briefing.reschedules)} />
        <h5>Customers without saved payment methods</h5>
        <BulletList items={linesOrNone(briefing.withoutCard)} />
        <h5>Unpaid appointments</h5>
        <BulletList items={linesOrNone(briefing.unpaid)} />
      </Letter>
    </Story>
  )
}

function PaymentStory({ appointment, onPay }) {
  const copy = emilyPaymentCopy(appointment)
  const label = copy.paid ? 'View paid appointment' : 'Review & Pay'
  return (
    <Story
      eyebrow="To Customer · After Appointment"
      title="Customer Payment Request"
      trigger="The stylist marks the appointment Completed. The final price is sent automatically. There is no separate payment button."
      audience="Emily Carter"
      why="The stylist does not chase the payment. The customer reviews the total and adds a tip when ready."
      prominent
    >
      <Letter
        to="Emily Carter"
        subject="Thank You for Visiting Lumen & Co."
        actions={appointment ? <button type="button" onClick={onPay}>{label}</button> : null}
      >
        <p>Hi Emily,</p>
        <p>Thank you for visiting Lumen & Co.!</p>
        <p>Your appointment is complete. Please review your final service amount, add an optional tip, and confirm your payment.</p>
        <p className="demo-letter__amount"><span>{copy.service}</span><strong>{copy.amount}</strong></p>
      </Letter>
    </Story>
  )
}

function ReminderStory({ appointment }) {
  const [note, setNote] = useState('')

  async function preview(which) {
    if (!appointment) return
    const result = await previewPaymentReminder(appointment.id, which)
    setNote(result.ok
      ? 'The reminder was added under Messages from this visit. Nothing was emailed, and the demo did not wait.'
      : result.message)
  }

  return (
    <Story
      eyebrow="To Customer · After Appointment"
      title="Payment Reminder"
      trigger="Automatically reminds the customer after 24 hours and again after 72 hours if payment has not been completed."
      audience="The customer with an unpaid visit"
      why="The stylist does not have to remember who still owes, and reminders stop once the payment is approved."
    >
      <Letter
        to="Emily Carter"
        subject="Payment reminder — Lumen & Co."
        actions={(
          <>
            <button type="button" onClick={() => preview('24h')}>Preview 24-hour reminder</button>
            <button type="button" onClick={() => preview('72h')}>Preview 72-hour reminder</button>
          </>
        )}
      >
        <p>If the visit is still awaiting payment, Simple Salon can remind the customer the next day and again after three days.</p>
        <p>These buttons only preview the message. The demo does not wait 24 or 72 hours.</p>
        {note ? <p role="status">{note}</p> : null}
      </Letter>
    </Story>
  )
}

function FollowUp({ digest, withoutCard, onOpenCalendar }) {
  return (
    <Story
      eyebrow="To Stylist · Daily at 8 AM"
      title="Daily Changes & Follow-Ups"
      trigger="One daily email at 8 AM summarizes yesterday's appointment changes and outstanding items that need attention."
      audience="Mara at Lumen & Co."
      why="One note replaces a separate email for every booking, cancellation, and confirmation."
    >
      <Letter
        to="Mara"
        subject="Daily Changes & Follow-Ups"
        actions={<button type="button" onClick={onOpenCalendar}>Open Stylist Calendar</button>}
      >
        <p>Good morning, Mara. Here is what changed, and what still needs you, at Lumen & Co.</p>
        <h5>Needs your attention</h5>
        <p>Outstanding reschedule requests</p>
        <BulletList items={linesOrNone(digest.reschedules)} />
        <p>Overdue payments</p>
        <BulletList items={linesOrNone(digest.overdue)} />
        <p>Customers without a saved card for today's appointments</p>
        <BulletList items={linesOrNone(withoutCard)} />
        <h5>Yesterday’s changes</h5>
        <p>Cancellations</p>
        <BulletList items={linesOrNone(digest.cancellations)} />
        <p>New bookings</p>
        <BulletList items={linesOrNone(digest.bookings)} />
        <p>Appointment confirmations</p>
        <BulletList items={linesOrNone(digest.confirmations)} />
        <p>Completed reschedules</p>
        <BulletList items={linesOrNone(digest.completedReschedules)} />
      </Letter>
    </Story>
  )
}

function VisitMail({ messages, onAction }) {
  return (
    <section className="demo-story">
      <p className="demo-story__eyebrow">This browser</p>
      <h3>Messages from this visit</h3>
      <p>Actions you take in the demo add messages here. They stay in this browser, and nothing is emailed.</p>
      {messages.length === 0 ? <p>No new messages yet.</p> : null}
      <div className="demo-inbox__list">
        {messages.map((message) => (
          <Letter
            key={message.id}
            to={message.to}
            subject={message.subject}
            actions={(message.actions || []).length ? (message.actions || []).map((action) => (
              <button key={action.id} type="button" onClick={() => onAction(action)}>
                {action.label}
              </button>
            )) : null}
          >
            <p>{message.body}</p>
          </Letter>
        ))}
      </div>
    </section>
  )
}

export default function DemoInbox({ onOpenCustomer, onOpenStylist }) {
  const messages = useSyncExternalStore(subscribeMailbox, listMessages, listMessages)
  const appointments = useAppointments()
  const clients = useClients()
  const briefing = buildDayBriefing(appointments, clients)
  const digest = buildFollowUpDigest(appointments, clients)
  const emily = findEmilyPayment(appointments)

  function openCalendar(dateKey) {
    focusStylistView({ tab: 'calendar', dateKey })
    onOpenStylist()
  }

  function openPayment() {
    if (!emily) return
    focusCustomerAppointment(emily.id, 'pay')
    onOpenCustomer()
  }

  function openAction(action) {
    if (action.id === 'review') {
      openCalendar('')
      return
    }
    if (action.appointmentId) {
      focusCustomerAppointment(action.appointmentId, action.id === 'pay' ? 'pay' : 'manage')
    }
    onOpenCustomer()
  }

  return (
    <section className="demo-inbox">
      <header className="demo-inbox__intro">
        <h2>Automated Emails & Payments</h2>
        <p>See how Simple Salon automatically handles appointment communication, payment requests, reminders, and daily stylist updates.</p>
      </header>
      <Briefing briefing={briefing} onOpenCalendar={() => openCalendar(briefing.dateKey)} />
      <PaymentStory appointment={emily} onPay={openPayment} />
      <ReminderStory appointment={emily} />
      <FollowUp digest={digest} withoutCard={briefing.withoutCard} onOpenCalendar={() => openCalendar('')} />
      <VisitMail messages={messages} onAction={openAction} />
    </section>
  )
}
