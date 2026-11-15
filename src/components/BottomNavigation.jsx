import { Calendar, CalendarPlus, Users } from 'lucide-react'
import './BottomNavigation.css'

const TABS = [
  {
    id: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    theme: 'calendar',
  },
  {
    id: 'book',
    label: 'Book',
    icon: CalendarPlus,
    theme: 'book',
  },
  {
    id: 'clients',
    label: 'Clients',
    theme: 'clients',
    icon: Users,
  },
]

export default function BottomNavigation({ activeTab, onTabChange }) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div className="bottom-nav__inner">
        {TABS.map(({ id, label, icon: Icon, theme }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              type="button"
              className={`bottom-nav__tab bottom-nav__tab--${theme}${isActive ? ' is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
              onClick={() => onTabChange(id)}
            >
              <Icon className="bottom-nav__icon" strokeWidth={isActive ? 2.25 : 1.75} />
              <span className="bottom-nav__label">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
