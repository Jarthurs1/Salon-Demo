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
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import CustomerPage from './demo/CustomerPage.jsx'
import DemoShell from './demo/DemoShell.jsx'
import MessagingPage from './demo/MessagingPage.jsx'
import StylistPage from './demo/StylistPage.jsx'
import { peekStylistFocus, subscribeStylistFocus, takeStylistFocus } from './demo/focus.js'
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
  const shellRef = useRef(null)

  const needsMandatoryGuide =
    storageMode === 'aws' &&
    status === 'authenticated' &&
    isStylist &&
    !hasCompletedHelpGuide

  useEffect(() => {
    function apply(focus) {
      if (!focus) return
      setActiveTab(focus.tab === 'clients' ? 'clients' : 'calendar')
      if (focus.dateKey) setCalendarFocusDate(focus.dateKey)
      if (focus.clientId) setClientFocusId(focus.clientId)
      takeStylistFocus()
    }
    apply(peekStylistFocus())
    return subscribeStylistFocus(apply)
  }, [])

  useEffect(() => {
    const frame = shellRef.current?.querySelector('.app-frame')
    const nav = frame?.querySelector('.bottom-nav')
    if (!frame || !nav) return undefined
    let frameId = 0
    function update() {
      const mobile = window.matchMedia('(max-width: 959px)').matches
      const rect = frame.getBoundingClientRect()
      const dock = mobile && rect.top < window.innerHeight - 8 && rect.bottom > window.innerHeight + 4
      nav.classList.toggle('is-docked', dock)
      if (dock) {
        nav.style.left = `${rect.left}px`
        nav.style.width = `${rect.width}px`
      } else {
        nav.style.left = ''
        nav.style.width = ''
      }
    }
    function onScroll() {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
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
    <div className="app-shell" ref={shellRef}>
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
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DemoShell />}>
          <Route index element={<Navigate to="/stylist" replace />} />
          <Route path="stylist" element={<StylistPage><AppShell onRefresh={onRefresh} storageMode={storageMode} /></StylistPage>} />
          <Route path="customer" element={<CustomerPage />} />
          <Route path="messaging" element={<MessagingPage />} />
          <Route path="*" element={<Navigate to="/stylist" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
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
