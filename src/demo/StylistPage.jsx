import DemoIntro from './DemoIntro.jsx'

const BENEFITS = [
  ['See your day', 'Know who’s coming in and when.'],
  ['Stay organized', 'Keep customer details and appointments together.'],
  ['Handle changes', 'Approve reschedules without endless texts.'],
  ['Get paid easily', 'Send customers a payment request automatically after their visit.'],
]

export default function StylistPage({ children }) {
  return (
    <section className="demo-page">
      <DemoIntro
        title="Everything you need to run your day"
        subtitle="Your appointments, customers, and schedule changes — all in one simple app."
      />
      <div className="stylist-layout">
        <aside className="stylist-copy">
          <ul className="benefit-list">
            {BENEFITS.map(([title, text]) => (
              <li key={title}>
                <strong>{title}</strong>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </aside>
        <div className="stylist-stage">{children}</div>
      </div>
      <section className="paper-section">
        <h3>Already have a paper appointment book?</h3>
        <p>Just take a photo. Simple Salon can help turn your handwritten appointments and customer details into your new digital calendar.</p>
        <div className="paper-grid">
          <article className="paper-card">
            <div className="paper-preview">
              <div className="paper-side">
                <p className="paper-label">Paper Book</p>
                <div className="paper-note">
                  <span>Mon 9 — Emily</span>
                  <span>Tue 10 — Lauren</span>
                  <span>Wed 1 — Sarah</span>
                </div>
              </div>
              <span className="paper-arrow" aria-hidden="true" />
              <div className="paper-side">
                <p className="paper-label">Your Digital Calendar</p>
                <div className="paper-result">
                  <span><strong>9:00</strong> Emily Carter</span>
                  <span><strong>10:00</strong> Lauren Mitchell</span>
                  <span><strong>1:00</strong> Sarah Bennett</span>
                </div>
              </div>
            </div>
            <h4>Import your appointments</h4>
            <p>Take a photo of your appointment book. Review the details before adding them to your calendar.</p>
          </article>
          <article className="paper-card">
            <div className="paper-preview">
              <div className="paper-side">
                <p className="paper-label">Paper List</p>
                <div className="paper-note">
                  <span>Emily C. 555-0142</span>
                  <span>Lauren M. 555-0188</span>
                  <span>Sarah B. 555-0164</span>
                </div>
              </div>
              <span className="paper-arrow" aria-hidden="true" />
              <div className="paper-side">
                <p className="paper-label">Your Customer List</p>
                <div className="paper-result">
                  <span className="paper-record"><strong>Emily Carter</strong><span>555-0142</span></span>
                  <span className="paper-record"><strong>Lauren Mitchell</strong><span>555-0188</span></span>
                  <span className="paper-record"><strong>Sarah Bennett</strong><span>555-0164</span></span>
                </div>
              </div>
            </div>
            <h4>Import your customers</h4>
            <p>Take a photo of your customer list. Review the names and phone numbers before saving.</p>
          </article>
        </div>
        <p className="paper-section__note">You’re always in control. Review everything before saving.</p>
      </section>
    </section>
  )
}
