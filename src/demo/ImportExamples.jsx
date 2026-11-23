import { Search } from 'lucide-react'
import { formatDuration, formatTimeDisplay } from '../utils/dateUtils.js'
import { getAppointmentStatusBadgeLabel } from '../utils/appointmentStatus.js'
import '../components/AppointmentCard.css'
import '../components/AppointmentList.css'
import '../components/ClientsView.css'
import '../components/AppHeader.css'

const APPOINTMENTS = [
  { time: '09:00', name: 'Emily Carter', service: 'Haircut', minutes: 45, status: 'pending' },
  { time: '10:00', name: 'Lauren Mitchell', service: 'Haircut & Style', minutes: 60, status: 'confirmed' },
  { time: '15:00', name: 'Sarah Bennett', service: 'Color', minutes: 120, status: 'pending' },
]

const CUSTOMERS = [
  { initials: 'EC', name: 'Emily Carter', phone: '555-0142' },
  { initials: 'LM', name: 'Lauren Mitchell', phone: '555-0188' },
  { initials: 'SB', name: 'Sarah Bennett', phone: '555-0164' },
]

function PaperLines({ title, lines }) {
  return (
    <div className="paper-note">
      <p className="paper-note__date">{title}</p>
      {lines.map((line) => <p key={line}>{line}</p>)}
    </div>
  )
}

function PreviewAppointment({ time, name, service, minutes, status }) {
  return (
    <article className={`appointment-card appointment-card--${status}`}>
      <div className="appointment-card__time">
        <span>{formatTimeDisplay(time)}</span>
      </div>
      <div className="appointment-card__body">
        <h3 className="appointment-card__title">{name}</h3>
        <p className="appointment-card__service">{service}</p>
      </div>
      <div className="appointment-card__meta">
        <span className={`appointment-card__badge appointment-card__badge--${status}`}>
          {getAppointmentStatusBadgeLabel(status)}
        </span>
        <span className="appointment-card__duration">{formatDuration(minutes)}</span>
      </div>
    </article>
  )
}

function PreviewClient({ initials, name, phone }) {
  return (
    <div className="client-card">
      <div className="client-card__avatar" aria-hidden="true">{initials}</div>
      <div className="client-card__info">
        <h3 className="client-card__name">{name}</h3>
        <span className="client-card__contact">{phone}</span>
      </div>
    </div>
  )
}

function Comparison({ paperLabel, paper, digitalLabel, digital }) {
  return (
    <article className="paper-card">
      <div className="paper-preview">
        <div className="paper-side">
          <h4 className="paper-label">{paperLabel}</h4>
          {paper}
        </div>
        <span className="paper-arrow" aria-hidden="true" />
        <div className="paper-side">
          <h4 className="paper-label">{digitalLabel}</h4>
          {digital}
        </div>
      </div>
    </article>
  )
}

export default function ImportExamples() {
  return (
    <section className="paper-section">
      <h3>Turn your paper book into a digital calendar</h3>
      <p>Take a photo of your appointments or customer list. Simple Salon helps organize the information so you can review it before saving.</p>
      <p className="try-it"><strong>Try it:</strong> See how handwritten information becomes your digital calendar and customer list.</p>
      <div className="paper-grid">
        <Comparison
          paperLabel="Paper Appointment Book"
          paper={(
            <PaperLines
              title="Monday, November 23"
              lines={[
                '9:00 AM — Emily Carter',
                '10:00 AM — Lauren Mitchell',
                '3:00 PM — Sarah Bennett',
              ]}
            />
          )}
          digitalLabel="Your Digital Calendar"
          digital={(
            <div className="app-preview" aria-label="Calendar preview for Monday, November 23">
              <header className="app-header">
                <div className="app-header__heading">
                  <h3 className="app-header__title">Lumen & Co.</h3>
                  <p className="app-header__subtitle">Monday, November 23</p>
                </div>
              </header>
              <div className="appointment-list">
                <p className="appointment-list__summary">
                  3 appointments
                  {' · '}
                  <span className="appointment-list__summary-pending">2 awaiting confirmation</span>
                </p>
                <div className="app-preview__cards">
                  {APPOINTMENTS.map((item) => <PreviewAppointment key={item.time} {...item} />)}
                </div>
              </div>
            </div>
          )}
        />
        <Comparison
          paperLabel="Paper Customer List"
          paper={(
            <PaperLines
              title="Customers"
              lines={CUSTOMERS.map((item) => `${item.name} — ${item.phone}`)}
            />
          )}
          digitalLabel="Your Customer List"
          digital={(
            <div className="app-preview" aria-label="Customer list preview">
              <header className="app-header">
                <div className="app-header__heading">
                  <h3 className="app-header__title">Lumen & Co.</h3>
                  <p className="app-header__subtitle">Your Clients</p>
                </div>
              </header>
              <div className="clients-view__search" aria-hidden="true">
                <Search className="clients-view__search-icon" size={18} strokeWidth={2} />
                <input className="clients-view__search-input" placeholder="Search name, phone or email..." readOnly tabIndex={-1} />
              </div>
              <div className="clients-view__list">
                {CUSTOMERS.map((item) => <PreviewClient key={item.name} {...item} />)}
              </div>
            </div>
          )}
        />
      </div>
      <p className="paper-section__note">Simulated preview. Nothing is uploaded or saved.</p>
    </section>
  )
}
