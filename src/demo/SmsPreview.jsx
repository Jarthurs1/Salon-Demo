import { useEffect, useState } from 'react'
import DemoIntro from './DemoIntro.jsx'
import { SMS_STATUS_LABELS, messagesFor, statusFor } from './smsPreview.js'
import './demo.css'

const REPLY_DELAY_MS = 700

export default function SmsPreview() {
  const [phase, setPhase] = useState('start')
  const messages = messagesFor(phase)
  const status = statusFor(phase)
  const waiting = phase === 'yes-wait'

  useEffect(() => {
    if (phase !== 'yes-wait') return undefined
    const timer = window.setTimeout(() => setPhase('yes-done'), REPLY_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  return (
    <section className="demo-inbox sms-preview">
      <DemoIntro
        title="SMS Confirmations"
        subtitle="Simple Salon automatically reminds customers of upcoming appointments. Customers can confirm by replying YES, and the stylist sees their updated confirmation status without making a phone call."
      />
      <p className="sms-preview__label">Interactive SMS Preview — Simulated Messages</p>
      <div className="sms-phone">
        <header className="sms-phone__top">
          <p>Lumen & Co.</p>
          <span className={`sms-status sms-status--${status}`}>{SMS_STATUS_LABELS[status]}</span>
        </header>
        <div className="sms-thread" aria-live="polite">
          {messages.map((message) => (
            <p key={`${message.from}-${message.text}`} className={`sms-bubble sms-bubble--${message.from}`}>
              {message.text}
            </p>
          ))}
          {waiting ? <p className="sms-bubble sms-bubble--salon sms-bubble--typing">…</p> : null}
        </div>
        {phase === 'reschedule' ? (
          <p className="sms-note">The stylist must approve this request. The 9:00 AM haircut stays on the book until then.</p>
        ) : null}
        <div className="sms-actions">
          {phase === 'start' ? (
            <>
              <button type="button" onClick={() => setPhase('yes-wait')}>Reply YES</button>
              <button type="button" onClick={() => setPhase('reschedule')}>Request Reschedule</button>
            </>
          ) : (
            <button type="button" onClick={() => setPhase('start')} disabled={waiting}>
              Reset Conversation
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
