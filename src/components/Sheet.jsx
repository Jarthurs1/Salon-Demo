import { useEffect } from 'react'
import './Sheet.css'

/**
 * Full-screen mobile sheet overlay.
 */
export default function Sheet({
  title,
  onClose,
  children,
  footer = null,
  headerAction = null,
  ariaLabel,
}) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title}
      data-swipe-isolate
    >
      <button type="button" className="sheet__backdrop" aria-label="Close" onClick={onClose} />
      <div className="sheet__panel">
        <header className="sheet__header">
          <h2 className="sheet__title">{title}</h2>
          <div className="sheet__header-actions">
            {headerAction}
            <button type="button" className="sheet__close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </header>
        <div className="sheet__body">{children}</div>
        {footer ? <footer className="sheet__footer">{footer}</footer> : null}
      </div>
    </div>
  )
}
