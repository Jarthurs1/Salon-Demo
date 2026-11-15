import HeaderActions from './HeaderActions.jsx'
import { useScheduleSettings } from '../hooks/useScheduleSettings.js'
import { UNNAMED_SALON_FALLBACK } from '../branding/product.js'
import './AppHeader.css'

/**
 * Shared tab header: brand title from Settings, tab subtitle, Help + Refresh + Settings.
 */
export default function AppHeader({
  subtitle,
  onOpenHelp = null,
  onRefresh = null,
  refreshing = false,
  onOpenSettings = null,
}) {
  const settings = useScheduleSettings()
  const brandTitle = settings.salonName?.trim() || UNNAMED_SALON_FALLBACK

  return (
    <header className="app-header">
      <div className="app-header__heading">
        <h1 className="app-header__title">{brandTitle}</h1>
        <p className="app-header__subtitle">{subtitle}</p>
      </div>
      <HeaderActions
        onOpenHelp={onOpenHelp}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onOpenSettings={onOpenSettings}
        onSignOut={null}
        refreshLabel="Refresh"
      />
    </header>
  )
}
