import { useState } from 'react'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import './LoginScreen.css'

export default function LoginScreen() {
  const { login } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!identifier.trim() || !password) {
      setError('Enter your email/username and password.')
      return
    }
    setSubmitting(true)
    try {
      await login(identifier.trim(), password)
    } catch (err) {
      setError(err.message || 'Incorrect email/username or password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-screen__backdrop" aria-hidden="true" />
      <div className="login-screen__card">
        <div className="login-screen__brand">
          <h1 className="login-screen__title">Welcome to Simple Salon</h1>
          <p className="login-screen__subtitle">Your salon, beautifully organized.</p>
        </div>

        <form className="login-screen__form" onSubmit={handleSubmit} noValidate>
          <label className="login-screen__field">
            <span className="login-screen__label">Email or Username</span>
            <input
              className="login-screen__input"
              type="text"
              name="username"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={submitting}
              required
            />
          </label>

          <label className="login-screen__field">
            <span className="login-screen__label">Password</span>
            <div className="login-screen__password-row">
              <input
                className="login-screen__input login-screen__input--password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                required
              />
              <button
                type="button"
                className="login-screen__toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff size={18} strokeWidth={2.25} aria-hidden="true" />
                ) : (
                  <Eye size={18} strokeWidth={2.25} aria-hidden="true" />
                )}
              </button>
            </div>
          </label>

          {error ? <p className="login-screen__error">{error}</p> : null}

          <button
            type="submit"
            className="login-screen__submit"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <LoaderCircle
                  className="login-screen__spinner"
                  size={18}
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
