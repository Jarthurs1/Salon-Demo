import { useMemo, useState } from 'react'
import { Camera, Plus, Search } from 'lucide-react'
import ClientCard from './ClientCard.jsx'
import ClientForm from './ClientForm.jsx'
import ClientDetail from './ClientDetail.jsx'
import AppointmentDetail from './AppointmentDetail.jsx'
import PhotoImport from './PhotoImport.jsx'
import AppHeader from './AppHeader.jsx'
import { useClients } from '../hooks/useClients.js'
import { searchClients } from '../services/clientRepository.js'
import './ClientsView.css'

export default function ClientsView({
  onBookClient,
  onRefresh = null,
  onOpenHelp = null,
  onOpenSettings = null,
}) {
  const clients = useClients()
  const [query, setQuery] = useState('')
  const [screen, setScreen] = useState({ type: 'list' })
  const [showPhotoImport, setShowPhotoImport] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefresh() {
    if (!onRefresh || refreshing) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }
  // list | detail | add | edit
  // { type, clientId?, appointment? }

  const filtered = useMemo(() => {
    if (!query.trim()) return clients
    return searchClients(query)
  }, [clients, query])

  const selectedClient =
    screen.clientId != null
      ? clients.find((c) => c.id === screen.clientId) ?? null
      : null

  if (screen.type === 'detail' && selectedClient) {
    return (
      <>
        <ClientDetail
          client={selectedClient}
          onBack={() => setScreen({ type: 'list' })}
          onEdit={() => setScreen({ type: 'edit', clientId: selectedClient.id })}
          onBook={() => onBookClient?.(selectedClient.id)}
          onOpenAppointment={(appointment) =>
            setScreen({
              type: 'detail',
              clientId: selectedClient.id,
              appointment,
            })
          }
          onDeleted={() => setScreen({ type: 'list' })}
        />
        {screen.appointment && (
          <AppointmentDetail
            appointment={screen.appointment}
            onClose={() =>
              setScreen({ type: 'detail', clientId: selectedClient.id })
            }
          />
        )}
      </>
    )
  }

  if (screen.type === 'detail' && !selectedClient) {
    // Client deleted or missing
    return (
      <div className="clients-view">
        <p className="clients-view__empty">Client not found.</p>
        <button
          type="button"
          className="clients-view__add"
          onClick={() => setScreen({ type: 'list' })}
        >
          Back to Clients
        </button>
      </div>
    )
  }

  return (
    <div className="clients-view">
      <AppHeader
        subtitle="Your Clients"
        onOpenHelp={onOpenHelp}
        onRefresh={onRefresh ? handleRefresh : null}
        refreshing={refreshing}
        onOpenSettings={onOpenSettings}
      />

      <div className="clients-view__search">
        <Search className="clients-view__search-icon" size={18} strokeWidth={2} />
        <input
          type="search"
          className="clients-view__search-input"
          placeholder="Search name, phone or email..."
          aria-label="Search name, phone or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <button
        type="button"
        className="clients-view__add"
        onClick={() => setScreen({ type: 'add' })}
      >
        <Plus size={18} strokeWidth={2.25} />
        <span>Add New Client</span>
      </button>

      {clients.length === 0 ? (
        <div className="clients-view__empty-state">
          <p className="clients-view__empty">No clients yet.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="clients-view__empty-state">
          <p className="clients-view__empty">No clients found.</p>
          <button
            type="button"
            className="clients-view__add"
            onClick={() => setScreen({ type: 'add' })}
          >
            <Plus size={18} strokeWidth={2.25} />
            <span>Add New Client</span>
          </button>
        </div>
      ) : (
        <ul className="clients-view__list">
          {filtered.map((client) => (
            <li key={client.id}>
              <ClientCard
                client={client}
                onSelect={() => setScreen({ type: 'detail', clientId: client.id })}
              />
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="clients-view__import"
        onClick={() => setShowPhotoImport(true)}
      >
        <Camera size={18} strokeWidth={2.25} />
        <span>Import Client List</span>
      </button>

      {screen.type === 'add' && (
        <ClientForm
          mode="create"
          onClose={() => setScreen({ type: 'list' })}
          onSaved={(saved) =>
            setScreen({ type: 'detail', clientId: saved.id })
          }
          onViewExisting={(match) =>
            setScreen({ type: 'detail', clientId: match.id })
          }
        />
      )}

      {screen.type === 'edit' && selectedClient && (
        <ClientForm
          mode="edit"
          client={selectedClient}
          onClose={() =>
            setScreen({ type: 'detail', clientId: selectedClient.id })
          }
          onSaved={() =>
            setScreen({ type: 'detail', clientId: selectedClient.id })
          }
          onViewExisting={(match) =>
            setScreen({ type: 'detail', clientId: match.id })
          }
        />
      )}

      {showPhotoImport ? (
        <PhotoImport
          initialMode="clients"
          onClose={() => setShowPhotoImport(false)}
        />
      ) : null}
    </div>
  )
}
