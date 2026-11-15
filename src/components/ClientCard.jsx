import {
  getClientListName,
  getClientInitials,
  getClientSecondaryContact,
} from '../utils/clientUtils.js'

export default function ClientCard({ client, onSelect }) {
  const displayName = getClientListName(client)
  const contact = getClientSecondaryContact(client)

  return (
    <button type="button" className="client-card" onClick={() => onSelect?.(client)}>
      <div className="client-card__avatar" aria-hidden="true">
        {getClientInitials(client)}
      </div>
      <div className="client-card__info">
        <h3 className="client-card__name">{displayName}</h3>
        <span
          className={
            contact.type === 'none'
              ? 'client-card__contact client-card__contact--muted'
              : 'client-card__contact'
          }
        >
          {contact.text}
        </span>
        {client.savedCard ? (
          <span className="client-card__card">{client.savedCard.brand} ···· {client.savedCard.last4}</span>
        ) : null}
      </div>
    </button>
  )
}
