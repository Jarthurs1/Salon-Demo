import DemoIntro from './DemoIntro.jsx'
import ImportExamples from './ImportExamples.jsx'

export default function StylistPage({ children }) {
  return (
    <section className="demo-page">
      <DemoIntro
        compact
        title="Your salon, simplified."
        subtitle="Appointments, customers, and schedule changes in one simple app."
      />
      <p className="try-it"><strong>Try it:</strong> Tap an empty time to book, or an appointment to manage it.</p>
      <div className="stylist-stage">{children}</div>
      <ImportExamples />
    </section>
  )
}
