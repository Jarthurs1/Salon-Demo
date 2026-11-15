import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import './DemoWelcomeBanner.css'

const SESSION_KEY = 'simple-salon-demo-welcome-dismissed'

export default function DemoWelcomeBanner() {
  const { isDemo } = useAuth()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isDemo) {
      setVisible(false)
      return
    }
    try {
      setVisible(sessionStorage.getItem(SESSION_KEY) !== '1')
    } catch {
      setVisible(true)
    }
  }, [isDemo])

  if (!visible) return null

  function dismiss() {
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      // ignore
    }
    setVisible(false)
  }

  return (
    <div className="demo-welcome" role="status">
      <p className="demo-welcome__text">
        Welcome to the Simple Salon Demo. Explore the calendar, manage
        appointments, and try the client tools. All information is fictional and
        resets daily.
      </p>
      <button type="button" className="demo-welcome__dismiss" onClick={dismiss}>
        Got it
      </button>
    </div>
  )
}
