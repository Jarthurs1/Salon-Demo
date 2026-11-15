import { useState } from 'react'
import { requestDemoPayment } from '../demo/payments.js'
import { money, SERVICE_PRICES } from '../demo/showcase.js'

export default function PaymentPanel({ appointment }) {
  const suggested = SERVICE_PRICES[appointment.service] || 7500
  const [dollars, setDollars] = useState(String((suggested / 100).toFixed(0)))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const payment = appointment.payment

  if (appointment.type === 'blocked' || appointment.status === 'canceled') return null

  async function requestPayment() {
    const amountCents = Math.round(Number(dollars) * 100)
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError('Enter the final price.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await requestDemoPayment(appointment.id, amountCents)
    } catch (err) {
      setError(err.message || 'Could not request payment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="appointment-detail__request" aria-label="Payment">
      <p className="appointment-detail__reschedule-hint">Payment</p>
      {payment?.status === 'paid' ? (
        <p>
          Paid {money((payment.amountCents || 0) + (payment.tipCents || 0))}
          {payment.tipCents ? `, including a ${money(payment.tipCents)} tip` : ''}. A simulated receipt is in the Demo Inbox.
        </p>
      ) : null}
      {payment?.status === 'requested' ? (
        <p>Payment requested for {money(payment.amountCents)}. Waiting for the customer to approve it.</p>
      ) : null}
      {payment?.status !== 'paid' && payment?.status !== 'requested' ? (
        <>
          <label>
            Final price
            <input
              inputMode="decimal"
              value={dollars}
              onChange={(event) => setDollars(event.target.value)}
            />
          </label>
          <button type="button" className="form-btn form-btn--primary" disabled={busy} onClick={requestPayment}>
            Request payment
          </button>
        </>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  )
}
