import { useAuth } from '../auth/AuthContext.jsx'
import './AccountSetupPending.css'

export default function AccountSetupPending() {
  const { user, logout } = useAuth()

  return (
    <div className="setup-pending">
      <div className="setup-pending__card">
        <h1 className="setup-pending__title">Account setup pending</h1>
        <p className="setup-pending__text">
          Hi {user?.username}. Your sign-in works, but a salon workspace has not
          been connected to this account yet. Please contact your administrator.
        </p>
        <button type="button" className="setup-pending__signout" onClick={logout}>
          Sign out
        </button>
      </div>
    </div>
  )
}
