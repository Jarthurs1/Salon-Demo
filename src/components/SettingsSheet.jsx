import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import Sheet from './Sheet.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { sendTestNotificationEmail } from '../auth/notificationApi.js'
import {
  getReminderSettings,
  getScheduleSettings,
  updateReminderSettings,
  updateScheduleSettings,
} from '../services/settingsRepository.js'
import { isValidContactEmail } from '../reminders/salonBranding.js'
import { UNNAMED_SALON_FALLBACK } from '../branding/product.js'
import {
  REMINDER_INTERVAL_OPTIONS,
  NOTIFICATION_METHODS,
  toggleReminderInterval,
  reminderSettingsAreValid,
  isSmsRemindersOperational,
  methodWantsSms,
} from '../reminders/reminderSettings.js'
import {
  DEFAULT_SMS_USAGE,
  formatSmsUsageLabel,
} from '../reminders/smsUsageLimits.js'
import { DAY_KEYS } from '../data/scheduleDefaults.js'
import { CUSTOMER_CUTOFFS } from '../appointments/customerManage.js'
import SettingsBillingCard from './SettingsBillingCard.jsx'
import './SettingsSheet.css'

const INTERVAL_LABELS = {
  1: '1 day before appointment',
  2: '2 days before appointment',
  7: '7 days before appointment',
}

const DAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

const WORKING_DAY_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const TIMEZONE_OPTIONS = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'Pacific/Honolulu',
]

const HOUR_OPTIONS = buildHourOptions()

function buildHourOptions() {
  const options = []
  for (let minutes = 5 * 60; minutes <= 22 * 60; minutes += 30) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    options.push({ value, label: formatHourLabel(h, m) })
  }
  return options
}

function formatHourLabel(hour, minute) {
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${String(minute).padStart(2, '0')} ${suffix}`
}

function InfoTip({ text }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="settings-sheet__info">
      <button
        type="button"
        className="settings-sheet__info-btn"
        aria-label="More information"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Info size={15} strokeWidth={2.25} aria-hidden="true" />
      </button>
      {open ? (
        <span className="settings-sheet__info-pop" role="note">
          {text}
        </span>
      ) : null}
    </span>
  )
}

export default function SettingsSheet({ onClose }) {
  const { user, logout, changePassword, isDemo } = useAuth()
  const initialSchedule = getScheduleSettings()
  const initialReminders = getReminderSettings()
  const [accountError, setAccountError] = useState('')
  const [accountMessage, setAccountMessage] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const [salonName, setSalonName] = useState(initialSchedule.salonName || '')
  const [stylistName, setStylistName] = useState(initialSchedule.stylistName || '')
  const [contactEmail, setContactEmail] = useState(
    initialSchedule.contactEmail || '',
  )
  const [customerChangeCutoff, setCustomerChangeCutoff] = useState(
    initialSchedule.customerChangeCutoff || 'not_same_day',
  )
  const [contactPhone, setContactPhone] = useState(
    initialSchedule.contactPhone || '',
  )
  const [timezone, setTimezone] = useState(
    initialSchedule.timezone || 'America/New_York',
  )
  const [testEmailStatus, setTestEmailStatus] = useState(null)
  const [testEmailBusy, setTestEmailBusy] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [calendarDisplayStart, setCalendarDisplayStart] = useState(
    initialSchedule.calendarDisplayStart || '08:00',
  )
  const [calendarDisplayEnd, setCalendarDisplayEnd] = useState(
    initialSchedule.calendarDisplayEnd || '18:00',
  )
  const [weeklyHours, setWeeklyHours] = useState(() =>
    structuredClone(initialSchedule.weeklyHours),
  )
  const [method, setMethod] = useState(initialReminders.method)
  const [intervalsDays, setIntervalsDays] = useState(
    initialReminders.intervalsDays,
  )
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const remindersOn = method !== 'none'
  const smsLive = isSmsRemindersOperational()
  const smsSelected = methodWantsSms(method)
  const smsUsage = useMemo(
    () => ({ ...DEFAULT_SMS_USAGE, ...(initialSchedule.smsUsage || {}) }),
    [initialSchedule.smsUsage],
  )

  function toggleWorkingDay(dayKey, open) {
    setWeeklyHours((prev) => {
      const current = prev[dayKey] || { closed: true }
      if (!open) {
        return { ...prev, [dayKey]: { ...current, closed: true } }
      }
      return {
        ...prev,
        [dayKey]: {
          closed: false,
          start: current.start || '09:00',
          end: current.end || '18:00',
        },
      }
    })
  }

  async function handleSave() {
    setError(null)
    setSuccessMessage('')
    setTestEmailStatus(null)
    const name = salonName.trim()
    const first = stylistName.trim()
    const email = contactEmail.trim()
    if (!name) {
      setError('Please enter your Salon Name.')
      return
    }
    if (!first) {
      setError('Please enter the Stylist First Name.')
      return
    }
    if (email && !isValidContactEmail(email)) {
      setError('Enter a valid Contact Email address.')
      return
    }
    if (!timezone.trim()) {
      setError('Please choose a timezone.')
      return
    }
    if (
      calendarDisplayStart >= calendarDisplayEnd
    ) {
      setError('Calendar display end must be after the start time.')
      return
    }

    const nextReminders = {
      method,
      enabled: method !== 'none',
      intervalsDays,
    }
    if (!reminderSettingsAreValid(nextReminders)) {
      setError('Choose at least one reminder day when reminders are on.')
      return
    }

    setSaving(true)
    try {
      await updateScheduleSettings({
        salonName: name,
        stylistName: first,
        contactEmail: email,
        contactPhone: contactPhone.trim(),
        customerChangeCutoff,
        timezone: timezone.trim(),
        calendarDisplayStart,
        calendarDisplayEnd,
        weeklyHours,
      })
      await updateReminderSettings(nextReminders)
      setSuccessMessage('Settings saved.')
    } catch (err) {
      console.error('[SettingsSheet] save failed', err)
      setError(err?.message || 'Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSendTestEmail() {
    setError(null)
    setTestEmailStatus(null)
    if (isDemo) {
      const result = await sendTestNotificationEmail()
      setTestEmailStatus({
        ok: true,
        message: result.message,
      })
      return
    }
    const email = contactEmail.trim()
    if (!isValidContactEmail(email)) {
      setError('Save a valid Contact Email before sending a test notification.')
      return
    }
    const saved = String(getScheduleSettings().contactEmail || '').trim().toLowerCase()
    if (saved !== email.toLowerCase()) {
      setError('Save Settings first so the Contact Email is stored, then send the test.')
      return
    }
    setTestEmailBusy(true)
    try {
      const result = await sendTestNotificationEmail()
      setTestEmailStatus({
        ok: true,
        message:
          result?.message ||
          'Test email accepted for delivery. Check your inbox shortly.',
      })
    } catch (err) {
      setTestEmailStatus({
        ok: false,
        message:
          err?.code === 'demo_restricted'
            ? 'Email sending is disabled in the demonstration account.'
            : err?.message || 'Could not send the test email.',
      })
    } finally {
      setTestEmailBusy(false)
    }
  }

  function handleIntervalChange(day, checked) {
    const next = toggleReminderInterval({ method, intervalsDays }, day, checked)
    setIntervalsDays(next.intervalsDays)
  }

  const footer = (
    <>
      <button
        type="button"
        className="form-btn form-btn--primary"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
      <button type="button" className="form-btn form-btn--ghost" onClick={onClose}>
        Cancel
      </button>
    </>
  )

  return (
    <Sheet title="Settings" onClose={onClose} footer={footer}>
      <div className="settings-sheet">
        {error ? (
          <p className="settings-sheet__error" role="alert">
            {error}
          </p>
        ) : null}
        {successMessage ? (
          <p className="settings-sheet__success" role="status">
            {successMessage}
          </p>
        ) : null}

        <section className="settings-sheet__section">
          <h2 className="settings-sheet__heading">Business</h2>
          <label className="settings-sheet__field">
            <span className="settings-sheet__label">Salon Name</span>
            <input
              type="text"
              className="settings-sheet__input"
              value={salonName}
              onChange={(e) => setSalonName(e.target.value)}
              placeholder={UNNAMED_SALON_FALLBACK}
              autoComplete="organization"
            />
          </label>
          <label className="settings-sheet__field">
            <span className="settings-sheet__label">Stylist First Name</span>
            <input
              type="text"
              className="settings-sheet__input"
              value={stylistName}
              onChange={(e) => setStylistName(e.target.value)}
              autoComplete="given-name"
            />
          </label>
          <label className="settings-sheet__field">
            <span className="settings-sheet__label">Contact Email</span>
            <input
              type="email"
              className="settings-sheet__input"
              value={contactEmail}
              onChange={(e) => {
                setContactEmail(e.target.value)
                setTestEmailStatus(null)
              }}
              autoComplete="email"
              inputMode="email"
            />
            <span className="settings-sheet__hint">
              Appointment cancellations, reschedule requests, and other salon
              notifications will be sent here.
            </span>
          </label>
          <label className="settings-sheet__field">
            <span className="settings-sheet__label">
              Customer Cancellation &amp; Reschedule Cutoff
            </span>
            <select
              className="settings-sheet__input"
              value={customerChangeCutoff}
              onChange={(e) => setCustomerChangeCutoff(e.target.value)}
            >
              {CUSTOMER_CUTOFFS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="settings-sheet__hint">
              Not on the appointment date means customers can make changes until
              the end of the day before the appointment.
            </span>
          </label>
          <div className="settings-sheet__test-email">
            <button
              type="button"
              className="form-btn form-btn--ghost settings-sheet__test-email-btn"
              onClick={handleSendTestEmail}
              disabled={testEmailBusy || saving || isDemo}
              title={
                isDemo
                  ? 'Email sending is disabled in the demonstration account'
                  : undefined
              }
            >
              {testEmailBusy ? 'Sending…' : 'Send Test Email'}
            </button>
            {isDemo ? (
              <p className="settings-sheet__hint">
                Real email and SMS notifications are disabled for this demo login.
              </p>
            ) : null}
            {testEmailStatus ? (
              <p
                className={
                  testEmailStatus.ok
                    ? 'settings-sheet__success'
                    : 'settings-sheet__error'
                }
                role="status"
              >
                {testEmailStatus.message}
              </p>
            ) : null}
          </div>
          <label className="settings-sheet__field">
            <span className="settings-sheet__label">Contact Phone</span>
            <input
              type="tel"
              className="settings-sheet__input"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              autoComplete="tel"
              inputMode="tel"
            />
          </label>
          <label className="settings-sheet__field">
            <span className="settings-sheet__label-row">
              <span className="settings-sheet__label">Timezone</span>
              <InfoTip text="Your timezone determines when appointment reminders are sent. Reminders normally go out at 9 AM local time, helping ensure customers aren't contacted too early or late." />
            </span>
            <select
              className="settings-sheet__input"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
              {!TIMEZONE_OPTIONS.includes(timezone) ? (
                <option value={timezone}>{timezone}</option>
              ) : null}
            </select>
          </label>
        </section>

        <section className="settings-sheet__section">
          <h2 className="settings-sheet__heading">
            <span className="settings-sheet__label-row">
              Working days
              <InfoTip text="Closed days show a simple Closed message on the Calendar. You can still book outside normal hours on open days from the Book tab." />
            </span>
          </h2>
          <div className="settings-sheet__checks">
            {WORKING_DAY_ORDER.map((dayKey) => {
              if (!DAY_KEYS.includes(dayKey)) return null
              const open = !weeklyHours[dayKey]?.closed
              return (
                <label key={dayKey} className="settings-sheet__check">
                  <input
                    type="checkbox"
                    checked={open}
                    onChange={(e) => toggleWorkingDay(dayKey, e.target.checked)}
                  />
                  <span>{DAY_LABELS[dayKey]}</span>
                </label>
              )
            })}
          </div>
        </section>

        <section className="settings-sheet__section">
          <h2 className="settings-sheet__heading">
            <span className="settings-sheet__label-row">
              Calendar display hours
              <InfoTip text="Controls which available time slots appear on the Calendar. You can still book appointments outside this window from the Book tab." />
            </span>
          </h2>
          <div className="settings-sheet__hours">
            <label className="settings-sheet__field">
              <span className="settings-sheet__label">Start</span>
              <select
                className="settings-sheet__input"
                value={calendarDisplayStart}
                onChange={(e) => setCalendarDisplayStart(e.target.value)}
              >
                {HOUR_OPTIONS.map((option) => (
                  <option key={`start-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-sheet__field">
              <span className="settings-sheet__label">End</span>
              <select
                className="settings-sheet__input"
                value={calendarDisplayEnd}
                onChange={(e) => setCalendarDisplayEnd(e.target.value)}
              >
                {HOUR_OPTIONS.map((option) => (
                  <option key={`end-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="settings-sheet__section">
          <h2 className="settings-sheet__heading">
            <span className="settings-sheet__label-row">
              Notification Method
              <InfoTip text="Choose Email, Text, both, or none. Text reminders stay off until AWS SMS registration is approved. Confirmations and reschedule requests stop remaining reminders." />
            </span>
          </h2>

          <div
            className="settings-sheet__radios"
            role="radiogroup"
            aria-label="Notification method"
          >
            {NOTIFICATION_METHODS.map((option) => {
              const selected = method === option.id
              return (
                <label
                  key={option.id}
                  className={`settings-sheet__radio${selected ? ' is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="notification-method"
                    value={option.id}
                    checked={selected}
                    onChange={() => setMethod(option.id)}
                  />
                  <span className="settings-sheet__radio-copy">
                    <span className="settings-sheet__radio-label">{option.label}</span>
                    <span className="settings-sheet__radio-desc">
                      {option.description}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>

          {isDemo ? (
            <p className="settings-sheet__notice" role="status">
              Choose how and when your customers receive automatic reminders. Messages uses this same choice. Nothing is sent.
            </p>
          ) : smsSelected && !smsLive ? (
            <p className="settings-sheet__notice" role="status">
              {method === 'sms'
                ? 'Text reminders are not available yet (toll-free registration pending). No automatic reminders will be sent until SMS is approved.'
                : 'Text reminders are not available yet (toll-free registration pending). Email reminders will still send; text will not be used until SMS is approved.'}
            </p>
          ) : null}
        </section>

        <section className="settings-sheet__section">
          <h2 className="settings-sheet__heading">
            <span className="settings-sheet__label-row">
              Reminder timing
              <InfoTip text="Reminders are checked around 9 AM local time and about every 15 minutes afterward so newly booked appointments are not missed. Nothing is sent before 9 AM or after 8 PM local time." />
            </span>
          </h2>
          <div
            className={`settings-sheet__checks${remindersOn ? '' : ' is-disabled'}`}
            aria-disabled={!remindersOn}
          >
            {REMINDER_INTERVAL_OPTIONS.map((day) => (
              <label
                key={day}
                className={`settings-sheet__check${remindersOn ? '' : ' is-disabled'}`}
              >
                <input
                  type="checkbox"
                  checked={intervalsDays.includes(day)}
                  disabled={!remindersOn}
                  onChange={(e) => handleIntervalChange(day, e.target.checked)}
                />
                <span>{INTERVAL_LABELS[day]}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="settings-sheet__section">
          <h2 className="settings-sheet__heading">
            <span className="settings-sheet__label-row">
              SMS usage
              <InfoTip text="Automated AWS SMS is capped at 300 segments per month and 30 per day. Native Message buttons on your iPhone do not count toward this limit." />
            </span>
          </h2>
          <p className="settings-sheet__usage">
            SMS Usage This Month: {formatSmsUsageLabel(smsUsage)}
          </p>
          {!smsLive ? (
            <p className="settings-sheet__help">
              Live SMS sending remains off until approval. Usage stays at zero meanwhile.
            </p>
          ) : null}
        </section>

        <section className="settings-sheet__section">
          <h2 className="settings-sheet__heading">Account</h2>
          <p className="settings-sheet__help">
            Signed in as <strong>{user?.username || '—'}</strong>
          </p>
          <form
            className="settings-sheet__account-form"
            onSubmit={async (event) => {
              event.preventDefault()
              setAccountError('')
              setAccountMessage('')
              setPasswordSaving(true)
              try {
                await changePassword(passwordForm)
                setPasswordForm({
                  currentPassword: '',
                  newPassword: '',
                  confirmPassword: '',
                })
                setAccountMessage('Password updated.')
              } catch (err) {
                setAccountError(err.message || 'Unable to change password.')
              } finally {
                setPasswordSaving(false)
              }
            }}
          >
            <label className="settings-sheet__field">
              <span className="settings-sheet__label">Current password</span>
              <input
                type="password"
                className="settings-sheet__input"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    currentPassword: e.target.value,
                  }))
                }
                autoComplete="current-password"
                required
              />
            </label>
            <label className="settings-sheet__field">
              <span className="settings-sheet__label">New password</span>
              <input
                type="password"
                className="settings-sheet__input"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    newPassword: e.target.value,
                  }))
                }
                autoComplete="new-password"
                required
                minLength={5}
              />
            </label>
            <label className="settings-sheet__field">
              <span className="settings-sheet__label">Confirm password</span>
              <input
                type="password"
                className="settings-sheet__input"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    confirmPassword: e.target.value,
                  }))
                }
                autoComplete="new-password"
                required
                minLength={5}
              />
            </label>
            {accountError ? (
              <p className="settings-sheet__error" role="alert">
                {accountError}
              </p>
            ) : null}
            {accountMessage ? (
              <p className="settings-sheet__help">{accountMessage}</p>
            ) : null}
            <button
              type="submit"
              className="form-btn form-btn--ghost settings-sheet__account-btn"
              disabled={passwordSaving}
            >
              {passwordSaving ? 'Updating…' : 'Change Password'}
            </button>
          </form>
          <button
            type="button"
            className="form-btn form-btn--ghost settings-sheet__account-btn"
            onClick={async () => {
              await logout()
              onClose()
            }}
          >
            Sign Out
          </button>
        </section>

        <SettingsBillingCard />
      </div>
    </Sheet>
  )
}
