import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClients } from '../hooks/useClients.js'
import { saveDemoCard } from './cards.js'
import { focusStylistView } from './focus.js'
import { EMILY_CLIENT_ID } from './inboxStories.js'

export default function CardSetup() {
  const clients = useClients()
  const navigate = useNavigate()
  const emily = clients.find((client) => client.id === EMILY_CLIENT_ID) || null
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setError('')
    setBusy(true)
    try {
      const result = await saveDemoCard(EMILY_CLIENT_ID)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setNotice(result.already ? 'Emily already has a fictional card saved.' : 'Card Saved')
    } finally {
      setBusy(false)
    }
  }

  function showInStylist() {
    focusStylistView({ tab: 'clients', clientId: EMILY_CLIENT_ID })
    navigate('/stylist')
  }

  return (
    <section className="card-setup">
      <h3>Save Your Card for Easier Checkout</h3>
      <p>Save a payment method securely once, then review and approve payments after future appointments.</p>
      <figure className="card-preview" aria-label="Simulated secure payment setup">
        <p className="card-preview__salon">Lumen & Co.</p>
        <h3>Secure card setup</h3>
        <p className="card-preview__label">Simulated Stripe-style setup. No real card information is collected.</p>
        <div className="card-preview__field">
          <span>Card number</span>
          <strong>•••• •••• •••• 4242</strong>
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
      </figure>
      {error ? <p role="alert">{error}</p> : null}
      {emily?.savedCard ? <p role="status"><strong>Card Saved · {emily.savedCard.brand} ···· {emily.savedCard.last4}</strong></p> : null}
      {notice && !emily?.savedCard ? <p role="status">{notice}</p> : null}
      <button type="button" onClick={save} disabled={busy || Boolean(emily?.savedCard)}>Save Payment Method</button>
      <button type="button" onClick={showInStylist} disabled={!emily?.savedCard}>See Card Ready in the stylist app</button>
    </section>
  )
}
