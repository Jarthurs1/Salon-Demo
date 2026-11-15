import { CircleHelp, RefreshCw, Settings } from 'lucide-react'
import './HeaderActions.css'

/**
 * In-flow header controls (scroll with page). Help → Refresh → Settings.
 */
export default function HeaderActions({
  onOpenHelp = null,
  onRefresh = null,
  refreshing = false,
  onOpenSettings,
  onSignOut = null,
  refreshLabel = 'Refresh',
}) {
  return (
    <div className="header-actions">
      {onOpenHelp ? (
        <button
          type="button"
          className="header-actions__help"
          onClick={onOpenHelp}
          aria-label="How to use"
        >
          <CircleHelp
            className="header-actions__icon"
            size={18}
            strokeWidth={2.25}
            aria-hidden="true"
          />
        </button>
      ) : null}
      {onRefresh ? (
        <button
          type="button"
          className="header-actions__refresh"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label={refreshLabel}
          aria-busy={refreshing}
        >
          <RefreshCw
            className={`header-actions__icon${refreshing ? ' is-spinning' : ''}`}
            size={18}
            strokeWidth={2.25}
            aria-hidden="true"
          />
        </button>
      ) : null}
      {onSignOut ? (
        <button
          type="button"
          className="header-actions__signout"
          onClick={onSignOut}
        >
          Sign out
        </button>
      ) : null}
      <button
        type="button"
        className="header-actions__settings"
        onClick={onOpenSettings}
        aria-label="Settings"
      >
        <Settings
          className="header-actions__icon"
          size={18}
          strokeWidth={2.25}
          aria-hidden="true"
        />
      </button>
    </div>
  )
}
