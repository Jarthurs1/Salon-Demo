import { useSyncExternalStore } from 'react'
import { listMessages, subscribeMailbox } from './mailbox.js'
import { focusCustomerAppointment } from './focus.js'
import './demo.css'

export default function DemoInbox({ onOpenCustomer, onOpenStylist }) {
  const messages = useSyncExternalStore(subscribeMailbox, listMessages, listMessages)

  function openAction(message, action) {
    if (action.id === 'review') {
      onOpenStylist()
      return
    }
    if (action.appointmentId) focusCustomerAppointment(action.appointmentId, action.id === 'pay' ? 'pay' : 'manage')
    onOpenCustomer()
  }

  return (
    <section className="demo-inbox">
      <h2>Demo Inbox</h2>
      <p>These messages stay in this browser. Nothing is emailed.</p>
      {messages.length === 0 ? <p>No simulated messages yet.</p> : null}
      <div className="demo-inbox__list">
        {messages.map((message) => (
          <article key={message.id} className="demo-inbox__item">
            <p className="demo-inbox__meta">To {message.to}</p>
            <h3>{message.subject}</h3>
            <p>{message.body}</p>
            <div className="demo-inbox__actions">
              {(message.actions || []).map((action) => (
                <button key={action.id} type="button" onClick={() => openAction(message, action)}>
                  {action.label}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
