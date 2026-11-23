import DemoIntro from './DemoIntro.jsx'

export default function StylistPage({ children }) {
  return (
    <section className="demo-page">
      <DemoIntro
        title="Everything you need to run your day"
        subtitle="Manage appointments, customers, and schedule changes in one simple app."
      />
      <p className="try-it"><strong>Try it:</strong> Tap an empty time to book, or an appointment to manage it.</p>
      <div className="stylist-stage">{children}</div>
      <section className="paper-section">
        <p className="try-it"><strong>Try it:</strong> See how handwritten appointments become a digital calendar.</p>
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
          </article>
        </div>
      </section>
    </section>
  )
}
