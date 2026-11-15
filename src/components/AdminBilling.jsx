import { useCallback, useEffect, useState } from 'react'
import {
  createBillingCheckoutRequest,
  createBillingPortalRequest,
  listBillingUsersRequest,
  refreshBillingRequest,
} from '../auth/billingApi.js'
import { getSessionToken } from '../auth/sessionStore.js'
import './AdminBilling.css'

const STATUS_LABELS = {
  not_subscribed: 'Not subscribed',
  checkout_pending: 'Checkout pending',
  trialing: 'Trialing',
  active: 'Active',
  past_due: 'Past due',
  canceled: 'Canceled',
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return '—'
  }
}

function paymentLabel(user) {
  if (!user.paymentMethodBrand && !user.paymentMethodLast4) return '—'
  const rawBrand = String(user.paymentMethodBrand || '')
  if (rawBrand.toLowerCase() === 'link') return 'Link'
  const brand = rawBrand ? rawBrand.toUpperCase() : 'CARD'
  return user.paymentMethodLast4 ? `${brand} •••• ${user.paymentMethodLast4}` : brand
}

function lastPaymentLabel(user) {
  if (user.lastPaymentLabel) return user.lastPaymentLabel
  if (!user.lastPaymentStatus) return 'No payment yet.'
  return user.lastPaymentStatus
}

export default function AdminBilling() {
  const [users, setUsers] = useState([])
  const [meta, setMeta] = useState({ configured: false, monthlyPrice: '$5.00', mode: 'test' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await listBillingUsersRequest(getSessionToken())
      setUsers(result.users || [])
      setMeta({
        configured: Boolean(result.configured),
        monthlyPrice: result.monthlyPrice || '$5.00',
        mode: result.mode || 'test',
        priceId: result.priceId || '',
      })
    } catch (err) {
      setError(err.message || 'Unable to load billing.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleCheckout(user) {
    setBusyId(user.userId)
    setError('')
    setMessage('')
    try {
      const result = await createBillingCheckoutRequest(user.userId, getSessionToken())
      if (result.url) {
        window.open(result.url, '_blank', 'noopener,noreferrer')
        setMessage(
          `Checkout opened for ${user.username}. Share that tab/link with the stylist if needed.`,
        )
        await load()
      }
    } catch (err) {
      setError(err.message || 'Unable to start checkout.')
    } finally {
      setBusyId('')
    }
  }

  async function handlePortal(user) {
    setBusyId(user.userId)
    setError('')
    setMessage('')
    try {
      const result = await createBillingPortalRequest(user.userId, getSessionToken())
      if (result.url) {
        window.open(result.url, '_blank', 'noopener,noreferrer')
        setMessage(`Customer portal opened for ${user.username}.`)
      }
    } catch (err) {
      setError(err.message || 'Unable to open billing portal.')
    } finally {
      setBusyId('')
    }
  }

  async function handleRefresh(user) {
    setBusyId(user.userId)
    setError('')
    setMessage('')
    try {
      await refreshBillingRequest(user.userId, getSessionToken())
      setMessage(`Refreshed billing status for ${user.username}.`)
      await load()
    } catch (err) {
      setError(err.message || 'Unable to refresh billing status.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <section className="admin-billing" aria-label="Billing">
      <div className="admin-billing__intro">
        <h2 className="admin-billing__heading">Billing</h2>
        <p className="admin-billing__copy">
          Manage {meta.monthlyPrice}/month Simple Salon subscriptions in Stripe{' '}
          {meta.mode === 'live' ? 'live' : 'test'} mode. Billing status never blocks
          salon access.
        </p>
        {!meta.configured ? (
          <p className="admin-billing__warn">
            Stripe test secret key is not configured yet. Store{' '}
            <code>STRIPE_SECRET_KEY</code> in AWS Secrets Manager (
            <code>rosies-salon/stripe-test</code>), then refresh this page.
          </p>
        ) : null}
      </div>

      {message ? <p className="admin-billing__message">{message}</p> : null}
      {error ? <p className="admin-billing__error">{error}</p> : null}

      {loading ? <p className="admin-billing__empty">Loading billing…</p> : null}

      <ul className="admin-billing__list">
        {users.map((user) => {
          const busy = busyId === user.userId
          return (
            <li key={user.userId} className="admin-billing__card">
              <div className="admin-billing__card-head">
                <div>
                  <p className="admin-billing__name">{user.username}</p>
                  <p className="admin-billing__email">{user.email}</p>
                </div>
                <span
                  className={`admin-billing__status admin-billing__status--${user.subscriptionStatus}`}
                >
                  {STATUS_LABELS[user.subscriptionStatus] || user.subscriptionStatus}
                </span>
              </div>

              <dl className="admin-billing__meta">
                <div>
                  <dt>Monthly price</dt>
                  <dd>{user.monthlyPrice}</dd>
                </div>
                <div>
                  <dt>Next billing date</dt>
                  <dd>{formatDate(user.currentPeriodEnd)}</dd>
                </div>
                <div>
                  <dt>Payment method</dt>
                  <dd>{paymentLabel(user)}</dd>
                </div>
                <div>
                  <dt>Last payment</dt>
                  <dd>{lastPaymentLabel(user)}</dd>
                </div>
              </dl>

              <div className="admin-billing__actions">
                {user.canSetupBilling ? (
                  <button
                    type="button"
                    className="admin-billing__btn admin-billing__btn--primary"
                    disabled={busy || !meta.configured}
                    onClick={() => handleCheckout(user)}
                  >
                    {busy ? 'Working…' : 'Set Up Billing'}
                  </button>
                ) : null}
                {user.canManageBilling ? (
                  <button
                    type="button"
                    className="admin-billing__btn"
                    disabled={busy || !meta.configured}
                    onClick={() => handlePortal(user)}
                  >
                    Manage Billing
                  </button>
                ) : null}
                <button
                  type="button"
                  className="admin-billing__btn admin-billing__btn--ghost"
                  disabled={busy || !meta.configured}
                  onClick={() => handleRefresh(user)}
                >
                  Refresh Status
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {!loading && users.length === 0 ? (
        <p className="admin-billing__empty">No stylist accounts found.</p>
      ) : null}
    </section>
  )
}
