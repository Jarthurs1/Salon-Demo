import { useCallback, useEffect, useState } from 'react'
import {
  createMyBillingPortalRequest,
  getMyBillingRequest,
} from '../auth/billingApi.js'
import { getSessionToken } from '../auth/sessionStore.js'
import { useAuth } from '../auth/AuthContext.jsx'

export default function SettingsBillingCard() {
  const { isDemo } = useAuth()
  const [billing, setBilling] = useState(null)
  const [loading, setLoading] = useState(!isDemo)
  const [error, setError] = useState('')
  const [portalBusy, setPortalBusy] = useState(false)
  const [portalMessage, setPortalMessage] = useState('')

  const load = useCallback(async () => {
    if (isDemo) {
      setLoading(false)
      setBilling(null)
      setError('')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await getMyBillingRequest(getSessionToken())
      setBilling(result)
    } catch (err) {
      setBilling(null)
      setError(err.message || 'Unable to load billing details.')
    } finally {
      setLoading(false)
    }
  }, [isDemo])

  useEffect(() => {
    load()
  }, [load])

  if (isDemo) {
    return (
      <section
        className="settings-sheet__section settings-billing"
        aria-label="Subscription and Billing"
      >
        <h3 className="settings-sheet__section-title">Subscription &amp; Billing</h3>
        <p className="settings-sheet__help">
          Billing is disabled in the demonstration account. Explore scheduling and
          client tools instead — no charges can be made from this login.
        </p>
      </section>
    )
  }

  async function handleManagePaymentMethod() {
    setPortalBusy(true)
    setPortalMessage('')
    setError('')
    try {
      const result = await createMyBillingPortalRequest(getSessionToken())
      if (result.url) {
        window.location.assign(result.url)
        return
      }
      setPortalMessage('Stripe portal did not return a URL.')
    } catch (err) {
      if (err.code === 'stripe_portal_not_configured') {
        setPortalMessage(
          err.message ||
            'Stripe Customer Portal is not configured in this sandbox yet.',
        )
      } else {
        setError(err.message || 'Unable to open payment method management.')
      }
    } finally {
      setPortalBusy(false)
    }
  }

  return (
    <section className="settings-sheet__section settings-billing" aria-label="Subscription and Billing">
      <h2 className="settings-sheet__heading">Subscription &amp; Billing</h2>

      {loading ? (
        <p className="settings-sheet__help">Loading billing…</p>
      ) : null}

      {error ? (
        <p className="settings-sheet__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && billing?.unavailable ? (
        <p className="settings-sheet__notice" role="status">
          {billing.message ||
            'Billing details are temporarily unavailable. Try again shortly.'}
        </p>
      ) : null}

      {!loading && billing && !billing.configured ? (
        <p className="settings-sheet__notice" role="status">
          Billing is not configured yet. Your salon access is unaffected.
        </p>
      ) : null}

      {!loading && billing ? (
        <div className="settings-billing__card">
          <dl className="settings-billing__meta">
            <div>
              <dt>Subscription status</dt>
              <dd>
                <span
                  className={`settings-billing__status settings-billing__status--${billing.subscriptionStatus || 'not_subscribed'}`}
                >
                  {billing.subscriptionStatusLabel || 'Not Subscribed'}
                </span>
              </dd>
            </div>
            <div>
              <dt>Monthly subscription</dt>
              <dd>{billing.monthlyPrice || '$5.00'}/month</dd>
            </div>
            <div>
              <dt>Next billing</dt>
              <dd>{billing.nextBillingLabel || '—'}</dd>
            </div>
            <div>
              <dt>Last payment</dt>
              <dd>{billing.lastPaymentLabel || 'No payment yet.'}</dd>
            </div>
            <div>
              <dt>Payment method</dt>
              <dd>{billing.paymentMethodLabel || '—'}</dd>
            </div>
          </dl>

          {portalMessage ? (
            <p className="settings-sheet__notice" role="status">
              {portalMessage}
            </p>
          ) : null}

          <button
            type="button"
            className="form-btn form-btn--ghost settings-sheet__account-btn"
            disabled={portalBusy || !billing.canManagePaymentMethod}
            onClick={handleManagePaymentMethod}
          >
            {portalBusy ? 'Opening…' : 'Manage Payment Method'}
          </button>
          {!billing.canManagePaymentMethod ? (
            <p className="settings-sheet__help">
              Payment method management will appear once billing is set up for
              your account.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
