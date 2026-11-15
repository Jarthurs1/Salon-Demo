import { useEffect, useRef, useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext.jsx'
import BottomNavigation from './components/BottomNavigation.jsx'
import CalendarView from './components/CalendarView.jsx'
import BookView from './components/BookView.jsx'
import ClientsView from './components/ClientsView.jsx'
import DataProvider from './components/DataProvider.jsx'
import HowToUseGuide from './components/HowToUseGuide.jsx'
import SettingsSheet from './components/SettingsSheet.jsx'
import { useHorizontalSwipe } from './hooks/useHorizontalSwipe.js'
import { getAdjacentTab } from './utils/swipeNav.js'
import CustomerDemo from './customer/CustomerDemo.jsx'
import CardSetup from './demo/CardSetup.jsx'
import DemoChrome from './demo/DemoChrome.jsx'
import DemoInbox from './demo/DemoInbox.jsx'
import DemoIntro from './demo/DemoIntro.jsx'
import { takeStylistFocus } from './demo/focus.js'
import './App.css'
import './demo/demo.css'

function AppShell({ onRefresh, storageMode }) {
  const {
    status,
    isStylist,
    hasCompletedHelpGuide,
    completeHelpGuide,
  } = useAuth()
  const [activeTab, setActiveTab] = useState('calendar')
  const [clientFocusId, setClientFocusId] = useState('')
  const [calendarFocusDate, setCalendarFocusDate] = useState(null)
  const [bookPrefill, setBookPrefill] = useState(null)
  const [bookSession, setBookSession] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const contentRef = useRef(null)

  const needsMandatoryGuide =
    storageMode === 'aws' &&
    status === 'authenticated' &&
    isStylist &&
    !hasCompletedHelpGuide

  useEffect(() => {
    const focus = takeStylistFocus()
    if (!focus) return
    setActiveTab(focus.tab === 'clients' ? 'clients' : 'calendar')
    if (focus.dateKey) setCalendarFocusDate(focus.dateKey)
    if (focus.clientId) setClientFocusId(focus.clientId)
  }, [])

  function handleTabChange(tab) {
    if (needsMandatoryGuide) return
    setActiveTab(tab)
    if (tab !== 'calendar') {
      setCalendarFocusDate(null)
    }
  }

  function handleViewInCalendar(dateKey) {
    setCalendarFocusDate(dateKey)
    setActiveTab('calendar')
  }

  function handleBooked(dateKey) {
    setBookPrefill(null)
    setBookSession((value) => value + 1)
    setCalendarFocusDate(dateKey)
    setActiveTab('calendar')
  }

  function handleBookClient(clientId) {
    setBookPrefill({ clientId })
    setBookSession((value) => value + 1)
    setActiveTab('book')
  }

  function handleBookAvailableSlot({ date, startTime }) {
    setBookPrefill({ date, startTime })
    setBookSession((value) => value + 1)
    setActiveTab('book')
  }

  useHorizontalSwipe(contentRef, {
    enabled:
      !needsMandatoryGuide &&
      (activeTab === 'book' || activeTab === 'clients'),
    onSwipeLeft: () => {
      const next = getAdjacentTab(activeTab, 'left')
      if (next) handleTabChange(next)
    },
    onSwipeRight: () => {
      const next = getAdjacentTab(activeTab, 'right')
      if (next) handleTabChange(next)
    },
  })

  function openSettings() {
    if (needsMandatoryGuide) return
    setShowSettings(true)
  }

  function openHelp() {
    setShowHelp(true)
  }

  async function handleMandatoryComplete() {
    await completeHelpGuide()
    setActiveTab('calendar')
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <main className="app-content" ref={contentRef}>
          <div
            className="app-content__panel"
            hidden={activeTab !== 'calendar'}
            aria-hidden={activeTab !== 'calendar'}
          >
            <CalendarView
              focusDateKey={calendarFocusDate}
              onRefresh={onRefresh}
              onOpenHelp={needsMandatoryGuide ? null : openHelp}
              onOpenSettings={openSettings}
              storageMode={storageMode}
              onBookAvailableSlot={handleBookAvailableSlot}
            />
          </div>
          <div
            className="app-content__panel"
            hidden={activeTab !== 'book'}
            aria-hidden={activeTab !== 'book'}
          >
            <BookView
              key={`book-${bookSession}`}
              onViewInCalendar={handleViewInCalendar}
              onBooked={handleBooked}
              onRefresh={onRefresh}
              onOpenHelp={needsMandatoryGuide ? null : openHelp}
              onOpenSettings={openSettings}
              prefillClientId={bookPrefill?.clientId ?? null}
              prefillDate={bookPrefill?.date ?? null}
              prefillStartTime={bookPrefill?.startTime ?? null}
            />
          </div>
          <div
            className="app-content__panel"
            hidden={activeTab !== 'clients'}
            aria-hidden={activeTab !== 'clients'}
          >
            <ClientsView
              focusClientId={clientFocusId}
              onBookClient={handleBookClient}
              onRefresh={onRefresh}
              onOpenHelp={needsMandatoryGuide ? null : openHelp}
              onOpenSettings={openSettings}
            />
          </div>
        </main>
        {!needsMandatoryGuide ? (
          <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
        ) : null}
        {showSettings ? (
          <SettingsSheet onClose={() => setShowSettings(false)} />
        ) : null}
        {needsMandatoryGuide ? (
          <HowToUseGuide
            mandatory
            onComplete={handleMandatoryComplete}
            onClose={() => {}}
          />
        ) : null}
        {!needsMandatoryGuide && showHelp ? (
          <HowToUseGuide onClose={() => setShowHelp(false)} />
        ) : null}
      </div>
    </div>
  )
}

function DemoApp({ onRefresh, storageMode }) {
  const [view, setView] = useState('stylist')
  return (
    <div className="demo-root">
      <DemoChrome view={view} onView={setView} />
      <div className="demo-stage">
        {view === 'stylist' ? (
          <div className="demo-section">
            <DemoIntro
              title="Stylist Mobile App"
              subtitle="Your day-to-day workspace for managing appointments, customers, and schedule changes."
              who="The stylist, on their phone."
              does="Shows the day, clients, and schedule changes."
              trigger="Used throughout the day, and when an appointment is marked completed."
              relief="Booking, changes, and payment requests stay in one place."
            />
            <AppShell onRefresh={onRefresh} storageMode={storageMode} />
          </div>
        ) : null}
        {view === 'customer' ? (
          <div className="demo-section">
            <DemoIntro
              title="Customer Online Booking"
              subtitle="Existing customers can book appointments online without calling or texting their stylist."
              who="An existing customer."
              does="Books, confirms, cancels, or asks to reschedule."
              trigger="The customer opens the booking page."
              relief="The stylist does not have to trade messages to fill the book."
            />
            <CustomerDemo />
          </div>
        ) : null}
        {view === 'cards' ? (
          <CardSetup onOpenStylist={() => setView('stylist')} />
        ) : null}
        {view === 'inbox' ? (
          <DemoInbox onOpenCustomer={() => setView('customer')} onOpenStylist={() => setView('stylist')} />
        ) : null}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        {(ctx) => <DemoApp {...ctx} />}
      </DataProvider>
    </AuthProvider>
  )
}
