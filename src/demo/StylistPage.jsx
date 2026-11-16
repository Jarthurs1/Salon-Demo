import DemoIntro from './DemoIntro.jsx'

const POINTS = [
  ['Calendar', 'See the day at a glance, including confirmations and schedule changes.'],
  ['Customers', 'Keep client details and saved-card status together.'],
  ['Booking', 'Add appointments without a phone tag.'],
  ['Blocked time', 'Protect lunch and days off so customers cannot book them.'],
  ['Payments', 'Mark a finished visit complete and the payment request is created for you.'],
]

export default function StylistPage({ children }) {
  return (
    <section className="demo-page">
      <DemoIntro
        title="Stylist Experience"
        subtitle="Your salon, organized in one place."
      />
      <p className="demo-page__support">Manage appointments, customers, schedule changes, and payments from a simple mobile-friendly application.</p>
      <div className="stylist-layout">
        <aside className="stylist-copy">
          <h3>What this saves</h3>
          <p>Mara uses this during the day instead of checking texts, a paper book, and a separate payment app.</p>
          <ul>
            {POINTS.map(([title, text]) => (
              <li key={title}><strong>{title}.</strong> {text}</li>
            ))}
          </ul>
        </aside>
        <div className="stylist-stage">{children}</div>
      </div>
      <div className="feature-grid">
        <article className="feature-card">
          <p className="feature-card__kicker">Concept preview</p>
          <h3>AI Appointment Book Import</h3>
          <p>Photograph your handwritten appointment book and let AI help convert it into a digital calendar.</p>
          <ol className="feature-flow">
            <li>Paper Calendar</li>
            <li>AI Extraction</li>
            <li>Digital Appointments</li>
          </ol>
          <p className="feature-card__note">The stylist reviews every extracted visit before it is imported. This preview does not upload a photo or run AI.</p>
        </article>
        <article className="feature-card">
          <p className="feature-card__kicker">Concept preview</p>
          <h3>AI Customer List Import</h3>
          <p>Turn a photograph of your handwritten customer list into organized customer records.</p>
          <ol className="feature-flow">
            <li>Paper Client List</li>
            <li>AI Extraction</li>
            <li>Digital Customers</li>
          </ol>
          <p className="feature-card__note">The stylist checks names and contact details before saving them. This preview does not upload a photo or run AI.</p>
        </article>
      </div>
    </section>
  )
}
