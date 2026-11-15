import { useEffect, useState } from 'react'
import {
  Camera,
  Calendar,
  CalendarPlus,
  MessageCircleCheck,
  Settings,
  Smartphone,
  Users,
  X,
} from 'lucide-react'
import { PWA_INSTALL_GUIDE } from '../utils/helpGuide.js'
import './HowToUseGuide.css'

const SECTIONS = [
  {
    icon: Camera,
    title: 'Bring in your existing appointments',
    body: 'Use Import from Photo to bring in your existing calendar or client list. Review everything before saving.',
  },
  {
    icon: Calendar,
    title: 'Manage your calendar',
    body: "See upcoming appointments, check who's confirmed, and tap an available time to book. Tap an appointment to edit, reschedule, or contact a client.",
  },
  {
    icon: CalendarPlus,
    title: 'Book appointments anytime',
    body: 'Use Book to select a client, service, date, time, and duration. You can even schedule outside regular hours or on closed days.',
  },
  {
    icon: Users,
    title: 'Keep your clients organized',
    body: 'Search by name, phone, or email. Add new clients and update their contact details whenever needed.',
  },
  {
    icon: MessageCircleCheck,
    title: 'Let confirmations happen automatically',
    body: 'In Settings, choose email and/or SMS reminders and when to send them. Once a client confirms, their appointment turns green. Reschedule requests appear orange.',
  },
  {
    icon: Smartphone,
    title: PWA_INSTALL_GUIDE.title,
    body: PWA_INSTALL_GUIDE.body,
    steps: PWA_INSTALL_GUIDE.steps,
  },
]

/**
 * @param {{
 *   onClose: () => void
 *   mandatory?: boolean
 *   onComplete?: () => Promise<void> | void
 * }} props
 */
export default function HowToUseGuide({
  onClose,
  mandatory = false,
  onComplete = null,
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const previousBody = document.body.style.overflow
    const content = document.querySelector('.app-content')
    const previousContent = content?.style.overflow ?? ''
    document.body.style.overflow = 'hidden'
    if (content) content.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousBody
      if (content) content.style.overflow = previousContent
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== 'Escape') return
      if (mandatory) {
        event.preventDefault()
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mandatory, onClose])

  async function handleGotIt() {
    setError('')
    if (!onComplete) {
      onClose()
      return
    }
    setSaving(true)
    try {
      await onComplete()
      onClose()
    } catch (err) {
      setError(err.message || 'Unable to save guide progress.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="how-to-use"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-use-title"
      data-swipe-isolate
    >
      <div className="how-to-use__panel">
        <header className="how-to-use__header">
          <div className="how-to-use__heading">
            <h2 id="how-to-use-title" className="how-to-use__title">
              Welcome to Simple Salon
            </h2>
            <p className="how-to-use__subtitle">Your simple appointment manager</p>
          </div>
          {mandatory ? null : (
            <button
              type="button"
              className="how-to-use__close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} strokeWidth={2.25} aria-hidden="true" />
            </button>
          )}
        </header>

        <div className="how-to-use__body">
          <ol className="how-to-use__sections">
            {SECTIONS.map((section) => {
              const Icon = section.icon
              return (
                <li key={section.title} className="how-to-use__section">
                  <div className="how-to-use__icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={2.25} />
                  </div>
                  <div className="how-to-use__copy">
                    <h3 className="how-to-use__section-title">{section.title}</h3>
                    <p className="how-to-use__section-body">{section.body}</p>
                    {section.steps?.length ? (
                      <ol className="how-to-use__install-steps">
                        {section.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>

          <div className="how-to-use__tip">
            <Settings
              className="how-to-use__tip-icon"
              size={16}
              strokeWidth={2.25}
              aria-hidden="true"
            />
            <p className="how-to-use__tip-text">
              Customize your hours, timezone, and reminders in Settings.
            </p>
          </div>
        </div>

        <footer className="how-to-use__footer">
          {error ? <p className="how-to-use__error">{error}</p> : null}
          <button
            type="button"
            className="how-to-use__got-it"
            onClick={handleGotIt}
            disabled={saving}
          >
            {saving
              ? 'Saving…'
              : mandatory
                ? 'Got it — Start Using Simple Salon'
                : 'Got it'}
          </button>
        </footer>
      </div>
    </div>
  )
}
