import { LoaderCircle } from 'lucide-react'
import './AuthSplash.css'

export default function AuthSplash() {
  return (
    <div className="auth-splash">
      <div className="auth-splash__backdrop" aria-hidden="true" />
      <div className="auth-splash__card" role="status" aria-live="polite">
        <LoaderCircle
          className="auth-splash__spinner"
          size={22}
          strokeWidth={2.25}
          aria-hidden="true"
        />
        <p className="auth-splash__text">Checking your session…</p>
      </div>
    </div>
  )
}
