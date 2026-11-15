import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import {
  combineDurationParts,
  formatDurationPickerLabel,
  splitDurationMinutes,
} from '../utils/durationUtils.js'
import './DurationPicker.css'

const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => i)
const MINUTE_OPTIONS = [0, 15, 30, 45]
const ITEM_HEIGHT = 36
const VISIBLE_ROWS = 5
const POPOVER_GAP = 8
const BOTTOM_NAV_RESERVE = 88

function WheelColumn({
  label,
  options,
  value,
  onChange,
  formatOption,
  disabledValues = [],
}) {
  const listRef = useRef(null)
  const suppressScroll = useRef(false)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const index = Math.max(0, options.indexOf(value))
    suppressScroll.current = true
    el.scrollTop = index * ITEM_HEIGHT
    requestAnimationFrame(() => {
      suppressScroll.current = false
    })
  }, [value, options])

  function readIndex() {
    const el = listRef.current
    if (!el) return 0
    return Math.min(
      options.length - 1,
      Math.max(0, Math.round(el.scrollTop / ITEM_HEIGHT)),
    )
  }

  function handleScroll() {
    if (suppressScroll.current) return
    const next = options[readIndex()]
    if (next !== value && !disabledValues.includes(next)) onChange(next)
  }

  function handleScrollEnd() {
    const el = listRef.current
    if (!el) return
    const index = readIndex()
    el.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' })
    const next = options[index]
    if (disabledValues.includes(next)) {
      const fallback = options.find((option) => !disabledValues.includes(option))
      if (fallback != null) onChange(fallback)
      return
    }
    if (next !== value) onChange(next)
  }

  return (
    <div className="duration-picker__column">
      <div className="duration-picker__wheel-shell" aria-label={label}>
        <div className="duration-picker__wheel-fade duration-picker__wheel-fade--top" />
        <div className="duration-picker__wheel-fade duration-picker__wheel-fade--bottom" />
        <ul
          ref={listRef}
          className="duration-picker__wheel"
          role="listbox"
          aria-label={label}
          tabIndex={0}
          onScroll={handleScroll}
          onTouchEnd={handleScrollEnd}
          onMouseUp={handleScrollEnd}
        >
          {options.map((option) => {
            const disabled = disabledValues.includes(option)
            return (
              <li
                key={`${label}-${option}`}
                role="option"
                aria-selected={option === value}
                aria-disabled={disabled}
                className={`duration-picker__wheel-item${option === value ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}
                onClick={() => {
                  if (!disabled) onChange(option)
                }}
              >
                {formatOption(option)}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

/**
 * Duration field + floating wheel popup (iOS time-picker style, not native).
 * Native <input type="time"> cannot reliably represent elapsed duration
 * (AM/PM / 12-hour clock conflict with 0–12 hour spans).
 * value / onChange use total minutes.
 */
export default function DurationPicker({
  value,
  onChange,
  disabled = false,
  id,
  'aria-label': ariaLabel = 'Appointment duration',
}) {
  const autoId = useId()
  const fieldId = id || autoId
  const rootRef = useRef(null)
  const popoverRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState({
    top: 0,
    left: 0,
    width: 280,
    openUp: false,
  })
  const parts = splitDurationMinutes(value)
  const [draftHours, setDraftHours] = useState(parts.hours)
  const [draftMinutes, setDraftMinutes] = useState(parts.minutes)

  function measurePlacement() {
    const field = rootRef.current
    if (!field) return
    const rect = field.getBoundingClientRect()
    const width = Math.min(300, Math.max(260, rect.width))
    const left = Math.min(
      Math.max(12, rect.left + (rect.width - width) / 2),
      window.innerWidth - width - 12,
    )
    const popoverHeight = 250
    const spaceBelow =
      window.innerHeight - rect.bottom - BOTTOM_NAV_RESERVE - POPOVER_GAP
    const openUp = spaceBelow < popoverHeight && rect.top > popoverHeight + 24
    const top = openUp
      ? Math.max(12, rect.top - popoverHeight - POPOVER_GAP)
      : Math.min(
          rect.bottom + POPOVER_GAP,
          window.innerHeight - BOTTOM_NAV_RESERVE - popoverHeight - 8,
        )
    setPlacement({ top, left, width, openUp })
  }

  useLayoutEffect(() => {
    if (!open) return
    measurePlacement()
  }, [open])

  useEffect(() => {
    if (!open) return
    const next = splitDurationMinutes(value)
    setDraftHours(next.hours)
    setDraftMinutes(next.minutes)

    function onReposition() {
      measurePlacement()
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, value])

  function handleHoursChange(hours) {
    setDraftHours(hours)
    if (hours === 12) setDraftMinutes(0)
    if (hours === 0 && draftMinutes === 0) setDraftMinutes(15)
  }

  function handleMinutesChange(minutes) {
    if (draftHours === 12) {
      setDraftMinutes(0)
      return
    }
    if (draftHours === 0 && minutes === 0) {
      setDraftMinutes(15)
      return
    }
    setDraftMinutes(minutes)
  }

  function handleConfirm() {
    onChange?.(combineDurationParts(draftHours, draftMinutes))
    setOpen(false)
  }

  const disabledMinutes =
    draftHours === 12 ? [15, 30, 45] : draftHours === 0 ? [0] : []

  return (
    <div className="duration-picker" ref={rootRef}>
      <button
        type="button"
        id={fieldId}
        className="duration-picker__field"
        disabled={disabled}
        aria-label={`${ariaLabel}: ${formatDurationPickerLabel(value)}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="duration-picker__field-value">
          {formatDurationPickerLabel(value)}
        </span>
      </button>

      {open ? (
        <div className="duration-picker__layer" role="presentation">
          <button
            type="button"
            className="duration-picker__scrim"
            aria-label="Dismiss duration picker"
            onClick={() => setOpen(false)}
          />
          <div
            ref={popoverRef}
            className={`duration-picker__popover${placement.openUp ? ' is-above' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="Choose duration"
            data-swipe-isolate
            style={{
              top: `${placement.top}px`,
              left: `${placement.left}px`,
              width: `${placement.width}px`,
              '--duration-item-height': `${ITEM_HEIGHT}px`,
              '--duration-visible-rows': VISIBLE_ROWS,
            }}
          >
            <div className="duration-picker__wheels">
              <div className="duration-picker__stage">
                <div
                  className="duration-picker__selection"
                  aria-hidden="true"
                />
                <div className="duration-picker__columns">
                  <WheelColumn
                    label="hours"
                    options={HOUR_OPTIONS}
                    value={draftHours}
                    onChange={handleHoursChange}
                    formatOption={(hour) => String(hour)}
                  />
                  <WheelColumn
                    label="min"
                    options={MINUTE_OPTIONS}
                    value={draftMinutes}
                    onChange={handleMinutesChange}
                    formatOption={(minute) => String(minute).padStart(2, '0')}
                    disabledValues={disabledMinutes}
                  />
                </div>
              </div>
              <div className="duration-picker__units" aria-hidden="true">
                <span>hours</span>
                <span>min</span>
              </div>
            </div>

            <button
              type="button"
              className="duration-picker__confirm"
              aria-label="Confirm duration"
              onClick={handleConfirm}
            >
              <Check size={22} strokeWidth={2.75} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
