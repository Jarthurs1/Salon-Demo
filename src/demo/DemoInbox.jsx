import { useSyncExternalStore } from 'react'
import { useAppointments } from '../hooks/useAppointments.js'
import { useClients } from '../hooks/useClients.js'
import { focusCustomerAppointment, focusStylistView } from './focus.js'
import {
  buildDayBriefing,
  buildFollowUpDigest,
  emilyPaymentCopy,
  EMILY_CLIENT_ID,
  findEmilyPayment,
  linesOrNone,
} from './inboxStories.js'
import { listMessages, subscribeMailbox } from './mailbox.js'
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

function CardSetupPreview({ onShowClient }) {
  return (
    <div className="card-preview-wrap">
      <figure className="card-preview" aria-label="Illustrated payment setup preview">
        <p className="card-preview__salon">Lumen & Co.</p>
        <h4>Secure payment setup</h4>
        <p className="card-preview__label">Demo Preview — No Real Card Information Collected</p>
        <div className="card-preview__field">
          <span>Card number</span>
          <strong>•••• •••• •••• ••••</strong>
        </div>
        <div className="card-preview__row">
          <div className="card-preview__field">
            <span>Expiration</span>
            <strong>MM / YY</strong>
          </div>
          <div className="card-preview__field">
            <span>Security code</span>
            <strong>•••</strong>
          </div>
        </div>
        <p className="card-preview__button">Save Payment Method</p>
        <figcaption>
          Illustrated preview only. This is not Stripe’s hosted page. Payment details would be handled by Stripe, and Simple Salon would not store the card number.
        </figcaption>
      </figure>
      <div className="card-preview__saved">
        <p>Card saved for this demo</p>
        <strong>Emily Carter · Visa ending in 4242</strong>
        <button type="button" onClick={onShowClient}>See saved card in the stylist client list</button>
      </div>
    </div>
  )
}

function Briefing({ briefing, onOpenCalendar }) {
  return (
    <Story
      eyebrow="To Stylist · Daily at 8 AM"
      title="Your Day at a Glance"
      trigger="Automatically sent at 8 AM to help the stylist prepare for the day's appointments."
      audience="Mara at Lumen & Co."
      why="The stylist starts the day knowing the book, open reschedule requests, missing cards, and unpaid visits."
    >
      <Letter
        to="Mara"
        subject="Your Day at a Glance"
        actions={<button type="button" onClick={onOpenCalendar}>Open Stylist Calendar</button>}
      >
        <p>Good morning, Mara. Here is {briefing.dateLabel} at Lumen & Co.</p>
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
      trigger="After an appointment, the stylist enters the final service price. The customer receives an email to approve payment and optionally add a tip."
      audience="Emily Carter"
      why="The stylist does not have to text a total or handle a tip at the chair. The customer reviews it when they are ready."
      prominent
    >
      <Letter
        to="Emily Carter"
        subject="Thank You for Visiting Lumen & Co."
        actions={appointment ? <button type="button" onClick={onPay}>{label}</button> : null}
      >
        <p>Hi Emily,</p>
        <p>Thank you for visiting Lumen & Co.! We hope you enjoyed your appointment.</p>
        <p>Your stylist has prepared your final service total.</p>
        <p>Please review the amount, add an optional tip, and confirm your payment.</p>
        <p className="demo-letter__amount"><span>{copy.service}</span><strong>{copy.amount}</strong></p>
      </Letter>
    </Story>
  )
}

function FollowUp({ digest, onOpenCalendar }) {
  return (
    <Story
      eyebrow="To Stylist · Daily at 8 AM"
      title="Daily Changes & Follow-Ups"
      trigger="Sent at 8 AM with yesterday's changes and outstanding items requiring attention, without sending separate emails for every customer action."
      audience="Mara at Lumen & Co."
      why="One briefing replaces a stack of individual alerts, while anything still waiting stays easy to find."
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
        <p>Customers requiring payment follow-up</p>
        <BulletList items={linesOrNone(digest.followUp)} />
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

  function openEmilyCard() {
    focusStylistView({ tab: 'clients', clientId: EMILY_CLIENT_ID })
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
        <p>See how Simple Salon keeps customers informed, simplifies payments, and reduces daily administrative work.</p>
      </header>
      <Briefing briefing={briefing} onOpenCalendar={() => openCalendar(briefing.dateKey)} />
      <PaymentStory appointment={emily} onPay={openPayment} />
      <Story
        eyebrow="Payment Setup"
        title="Save a Card for Faster Checkout"
        trigger="A customer chooses to save a payment method before a future visit."
        audience="The customer, with a saved-card indicator for the stylist"
        why="Customers can securely save a payment method through Stripe. Simple Salon never stores their actual card information."
      >
        <CardSetupPreview onShowClient={openEmilyCard} />
      </Story>
      <FollowUp digest={digest} onOpenCalendar={() => openCalendar('')} />
      <VisitMail messages={messages} onAction={openAction} />
    </section>
  )
}
