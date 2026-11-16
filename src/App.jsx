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
import SmsPreview from './demo/SmsPreview.jsx'
import { peekStylistFocus, subscribeStylistFocus, takeStylistFocus } from './demo/focus.js'
import { scrollToDemoSection } from './demo/sections.js'
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
      const rect = frame.getBoundingClientRect()
      const dock = rect.top < window.innerHeight - 8 && rect.bottom > window.innerHeight + 4
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
  const [active, setActive] = useState('stylist')
  const scrolling = useRef(false)

  useEffect(() => {
    const nodes = ['stylist', 'customer', 'cards', 'inbox', 'sms']
      .map((id) => document.getElementById(id))
      .filter(Boolean)
    if (!nodes.length) return undefined
    const observer = new IntersectionObserver((entries) => {
      if (scrolling.current) return
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
      if (visible[0]) setActive(visible[0].target.id)
    }, { rootMargin: '-15% 0px -55% 0px', threshold: [0.15, 0.4, 0.7] })
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  function openSection(id) {
    scrolling.current = true
    setActive(id)
    scrollToDemoSection(id)
    window.setTimeout(() => {
      scrolling.current = false
    }, 700)
  }

  return (
    <div className="demo-root">
      <DemoChrome active={active} onSelect={openSection} />
      <main className="demo-stage">
        <section id="stylist" className="demo-section">
          <DemoIntro
            title="Stylist Experience"
            subtitle="Manage appointments, clients, and your daily schedule in one place."
          />
          <AppShell onRefresh={onRefresh} storageMode={storageMode} />
        </section>
        <section id="customer" className="demo-section">
          <DemoIntro
            title="Customer Experience"
            subtitle="Existing customers can book, confirm, and manage appointments online."
          />
          <CustomerDemo />
        </section>
        <section id="cards" className="demo-section">
          <CardSetup onOpenStylist={() => openSection('stylist')} />
        </section>
        <section id="inbox" className="demo-section">
          <DemoInbox
            onOpenCustomer={() => openSection('customer')}
            onOpenStylist={() => openSection('stylist')}
          />
        </section>
        <section id="sms" className="demo-section">
          <SmsPreview />
        </section>
      </main>
      <footer className="demo-footer">
        This is an interactive demonstration using fictional data. No real appointments, emails, or payments are processed.
      </footer>
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
