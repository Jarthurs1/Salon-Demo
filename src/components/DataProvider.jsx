import { useEffect, useSyncExternalStore, useCallback } from 'react'
import {
  bootstrapAppData,
  refreshAppData,
  subscribeBootstrap,
  getBootstrapState,
} from '../services/dataBootstrap.js'
import {
  subscribePersistence,
  getPersistenceState,
  clearPersistenceStatus,
} from '../services/persistenceStatus.js'
import { getStorageMode } from '../storage/createStorageProvider.js'
import { useAuth } from '../auth/AuthContext.jsx'
import './DataProvider.css'

function useBootstrap() {
  return useSyncExternalStore(subscribeBootstrap, getBootstrapState, getBootstrapState)
}

function usePersistence() {
  return useSyncExternalStore(
    subscribePersistence,
    getPersistenceState,
    getPersistenceState,
  )
}

function PersistenceChip() {
  const { status, message } = usePersistence()
  if (status === 'idle' || !message) return null

  return (
    <div
      className={`persistence-chip persistence-chip--${status}`}
      role="status"
      aria-live="polite"
    >
      {message}
      {status === 'error' ? (
        <button
          type="button"
          className="persistence-chip__dismiss"
          onClick={() => clearPersistenceStatus()}
        >
          Dismiss
        </button>
      ) : null}
    </div>
  )
}

export default function DataProvider({ children }) {
  const bootstrap = useBootstrap()
  const { logout, status } = useAuth()

  useEffect(() => {
    bootstrapAppData()
  }, [])

  useEffect(() => {
    if (bootstrap.code !== 'unauthorized' || status !== 'authenticated') return
    logout()
  }, [bootstrap.code, logout, status])

  const handleRefresh = useCallback(() => {
    refreshAppData()
  }, [])

  useEffect(() => {
    if (getStorageMode() !== 'aws') return undefined
    if (bootstrap.status !== 'ready') return undefined

    let last = 0
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - last < 15000) return
      last = now
      refreshAppData()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [bootstrap.status])

  if (bootstrap.status === 'loading' || bootstrap.status === 'idle') {
    return (
      <div className="data-boot data-boot--loading" role="status">
        <div className="data-boot__spinner" aria-hidden="true" />
        <p>Loading schedule...</p>
      </div>
    )
  }

  if (bootstrap.status === 'error') {
    return (
      <div className="data-boot data-boot--error" role="alert">
        <p>{bootstrap.error}</p>
        <button type="button" className="data-boot__retry" onClick={() => bootstrapAppData()}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="data-provider">
      <PersistenceChip />
      {typeof children === 'function'
        ? children({ onRefresh: handleRefresh, storageMode: bootstrap.mode })
        : children}
    </div>
  )
}
