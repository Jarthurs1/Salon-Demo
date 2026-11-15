import { useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import './ForcePasswordChange.css'

export default function ForcePasswordChange() {
  const { changePassword, logout, user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match.')
      return
    }
    setSaving(true)
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword })
    } catch (err) {
      setError(err.message || 'Unable to change password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="force-password">
      <div className="force-password__card">
        <h1 className="force-password__title">Change temporary password</h1>
        <p className="force-password__text">
          Signed in as <strong>{user?.username}</strong>. Update your password
          before continuing.
        </p>
        <form className="force-password__form" onSubmit={handleSubmit}>
          <label className="force-password__field">
            <span>Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label className="force-password__field">
            <span>New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={5}
            />
          </label>
          <label className="force-password__field">
            <span>Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={5}
            />
          </label>
          {error ? <p className="force-password__error">{error}</p> : null}
          <button type="submit" className="force-password__submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save password'}
          </button>
          <button type="button" className="force-password__signout" onClick={logout}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
