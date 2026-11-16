import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ensureSeedMailbox } from './mailbox.js'
import { useAppointments } from '../hooks/useAppointments.js'
import { DEMO_ROUTES } from './sections.js'
import './demo.css'

function clearDemoStorage() {
  const keys = []
  for (let index = 0; index < localStorage.length; index += 1) keys.push(localStorage.key(index))
  keys.forEach((key) => {
    if (key && (key.startsWith('salon-demo.') || key.startsWith('rosies-salon.'))) localStorage.removeItem(key)
  })
}

export default function DemoShell() {
  const appointments = useAppointments()
  const location = useLocation()
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    ensureSeedMailbox(appointments)
  }, [appointments])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  function resetDemo() {
    clearDemoStorage()
    window.location.reload()
  }

  return (
    <div className="demo-root">
      <header className="demo-chrome">
        <div className="demo-chrome__row">
          <p className="demo-chrome__title">Salon Demo</p>
          <button type="button" className="demo-chrome__reset" onClick={() => setConfirming(true)}>
            Reset Demo Data
          </button>
        </div>
        <nav className="demo-chrome__nav" aria-label="Demo pages">
          {DEMO_ROUTES.map(([path, label]) => (
            <NavLink key={path} to={path} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <div className="demo-lede">
        <p className="demo-lede__brand">Simple Salon</p>
        <p className="demo-lede__headline">Less administration. More time with clients.</p>
        <p>Explore how independent stylists manage appointments while customers book, confirm, reschedule, and pay online.</p>
        <p className="demo-lede__note">Interactive demonstration using fictional data.</p>
      </div>
      <main className="demo-stage">
        <Outlet />
      </main>
      {confirming ? (
        <div className="demo-confirm" role="dialog" aria-modal="true" aria-labelledby="reset-title">
          <div className="demo-confirm__card">
            <h2 id="reset-title">Reset Demo Data</h2>
            <p>This restores the original fictional appointments, customers, messages, cards, and payments on this page.</p>
            <div className="demo-confirm__actions">
              <button type="button" onClick={resetDemo}>Reset Demo Data</button>
              <button type="button" className="is-quiet" onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
