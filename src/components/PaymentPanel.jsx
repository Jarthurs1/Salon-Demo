import { useState } from 'react'
import { completeDemoAppointment } from '../demo/payments.js'
import { money, SERVICE_PRICES } from '../demo/showcase.js'

export default function PaymentPanel({ appointment }) {
  const suggested = SERVICE_PRICES[appointment.service] || 7500
  const [dollars, setDollars] = useState(String((suggested / 100).toFixed(0)))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const payment = appointment.payment
  const blocked = appointment.type === 'blocked' || appointment.status === 'canceled'
  const rescheduleOpen = appointment.status === 'reschedule_requested'
    || appointment.rescheduleRequest?.status === 'pending'

  if (blocked) return null

  async function markCompleted() {
    setBusy(true)
    setError('')
    try {
      const result = await completeDemoAppointment(appointment.id, dollars)
      if (!result.ok) setError(result.message)
    } catch (err) {
      setError(err.message || 'Could not complete this appointment.')
    } finally {
      setBusy(false)
    }
  }

  const canComplete = appointment.status === 'confirmed'
    && !rescheduleOpen
    && payment?.status !== 'paid'
    && payment?.status !== 'requested'

  return (
    <section className="appointment-detail__payment" aria-label="Payment">
      <h3>Payment</h3>
      {payment?.status === 'paid' ? (
        <p>
          Paid {money((payment.amountCents || 0) + (payment.tipCents || 0))}
          {payment.tipCents ? `, including a ${money(payment.tipCents)} tip` : ''}.
        </p>
      ) : null}
      {payment?.status === 'requested' ? (
        <p>Awaiting Payment for {money(payment.amountCents)}. The customer can review it from Emails & Payments.</p>
      ) : null}
      {rescheduleOpen ? (
        <p>Resolve the reschedule request before this visit can be completed.</p>
      ) : null}
      {canComplete ? (
        <>
          <label className="payment-price">
            <span>Final price</span>
            <input
              inputMode="decimal"
              value={dollars}
              aria-label="Final price"
              onChange={(event) => setDollars(event.target.value)}
            />
          </label>
          <button type="button" className="form-btn form-btn--primary" disabled={busy} onClick={markCompleted}>
            Mark Completed
          </button>
        </>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  )
}
