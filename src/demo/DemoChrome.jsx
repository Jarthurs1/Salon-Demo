import { useEffect } from 'react'
import { ensureSeedMailbox } from './mailbox.js'
import { useAppointments } from '../hooks/useAppointments.js'
import { DEMO_SECTIONS } from './sections.js'
import './demo.css'

export default function DemoChrome({ active, onSelect }) {
  const appointments = useAppointments()

  useEffect(() => {
    ensureSeedMailbox(appointments)
  }, [appointments])

  useEffect(() => {
    const selected = document.querySelector(`[data-demo-section="${active}"]`)
    const nav = selected?.parentElement
    if (!selected || !nav) return
    const left = selected.offsetLeft - (nav.clientWidth - selected.clientWidth) / 2
    nav.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [active])

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
        <button type="button" className="demo-chrome__reset" onClick={resetDemo}>Reset Demo</button>
      </div>
      <nav className="demo-chrome__nav" aria-label="Demo sections">
        {DEMO_SECTIONS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            data-demo-section={id}
            className={active === id ? 'is-active' : ''}
            aria-current={active === id ? 'true' : undefined}
            onClick={() => onSelect(id)}
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  )
}
