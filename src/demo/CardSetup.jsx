import { useState } from 'react'
import { useClients } from '../hooks/useClients.js'
import { saveDemoCard } from './cards.js'
import { focusStylistView } from './focus.js'
import DemoIntro from './DemoIntro.jsx'
import './demo.css'

export default function CardSetup({ onOpenStylist }) {
  const clients = useClients()
  const [clientId, setClientId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const selected = clients.find((client) => client.id === clientId) || null

  async function save() {
    setError('')
    const result = await saveDemoCard(clientId)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setNotice(result.already
      ? 'This customer already has a fictional saved card.'
      : 'Fictional card saved. The stylist record now shows Card Ready.')
  }

  function showInStylist() {
    if (!selected) return
    focusStylistView({ tab: 'clients', clientId: selected.id })
    onOpenStylist()
  }

  return (
    <section className="demo-inbox">
      <DemoIntro
        title="Secure Card Setup"
        subtitle="Customers can securely save a payment method for faster checkout after future appointments."
      />
      <figure className="card-preview" aria-label="Illustrated payment setup preview">
        <p className="card-preview__salon">Lumen & Co.</p>
        <h3>Secure payment setup</h3>
        <p className="card-preview__label">Demo Preview — No Real Card Information Collected</p>
        <p>This is an illustration, not a live Stripe checkout page.</p>
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
        <figcaption>
          In a real salon, Stripe would collect the card. Simple Salon would store only a fictional-style indicator such as Visa ending in 4242.
        </figcaption>
      </figure>
      <div className="card-preview__saved">
        <label className="payment-price">
          <span>Fictional customer</span>
          <select aria-label="Fictional customer" value={clientId} onChange={(event) => { setClientId(event.target.value); setNotice('') }}>
            <option value="">Choose a customer</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.displayName || `${client.firstName} ${client.lastName}`}
                {client.savedCard ? ' · Card Ready' : ' · No card'}
              </option>
            ))}
          </select>
        </label>
        {error ? <p role="alert">{error}</p> : null}
        {notice ? <p role="status">{notice}</p> : null}
        {selected?.savedCard ? (
          <p><strong>Card Ready · {selected.savedCard.brand} ending in {selected.savedCard.last4}</strong></p>
        ) : null}
        <button type="button" onClick={save} disabled={!selected}>Save Payment Method</button>
        <button type="button" onClick={showInStylist} disabled={!selected?.savedCard}>See this in the stylist customer list</button>
      </div>
    </section>
  )
}
