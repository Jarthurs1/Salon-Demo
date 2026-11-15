import { useEffect } from 'react'
import { ensureSeedMailbox } from './mailbox.js'
import { useAppointments } from '../hooks/useAppointments.js'
import './demo.css'

const VIEWS = [
  ['stylist', 'Stylist Mobile App'],
  ['customer', 'Customer Booking'],
  ['cards', 'Card Setup'],
  ['inbox', 'Emails & Payments'],
  ['sms', 'SMS Preview'],
]

export default function DemoChrome({ view, onView }) {
  const appointments = useAppointments()

  useEffect(() => {
    ensureSeedMailbox(appointments)
  }, [appointments])

  function resetDemo() {
    const keys = []
    for (let index = 0; index < localStorage.length; index += 1) keys.push(localStorage.key(index))
    keys.forEach((key) => {
      if (key && (key.startsWith('salon-demo.') || key.startsWith('rosies-salon.'))) localStorage.removeItem(key)
    })
    window.location.reload()
  }

  return (
    <header className="demo-chrome">
      <div className="demo-chrome__row">
        <p className="demo-chrome__title">Salon Demo</p>
        <nav className="demo-chrome__nav" aria-label="Demo views">
          {VIEWS.map(([id, label]) => (
            <button key={id} type="button" className={view === id ? 'is-active' : ''} onClick={() => onView(id)}>
              {label}
            </button>
          ))}
        </nav>
        <button type="button" className="demo-chrome__reset" onClick={resetDemo}>Reset Demo</button>
      </div>
      <p className="demo-chrome__note">Explore the stylist app and the customer booking experience. Card setup and emails stay in sync with both.</p>
      <p className="demo-chrome__banner">This is an interactive demonstration using fictional data. No real appointments, emails, or payments are processed.</p>
    </header>
  )
}
