import { useMemo, useState } from 'react'
import Sheet from './Sheet.jsx'
import {
  createClient,
  updateClient,
  findDuplicateClients,
} from '../services/clientRepository.js'
import {
  isValidEmail,
  splitFullName,
  getClientDisplayName,
  formatPhoneDisplay,
} from '../utils/clientUtils.js'
import {
  SMS_CONSENT_CHECKBOX_LABEL,
  SMS_DISCLOSURE_VERSION,
  SMS_PRIVACY_URL,
  SMS_TERMS_URL,
  buildStylistSmsDisclosure,
  buildVerbalConsentScript,
} from '../reminders/smsDisclosure.js'
import {
  clearStylistRecordedConsent,
  hasActiveSmsOptOut,
  normalizeSmsConsent,
  recordVerbalSmsConsent,
} from '../reminders/smsConsent.js'
import { useAuth } from '../auth/AuthContext.jsx'
import './ClientForm.css'

export default function ClientForm({
  mode = 'create',
  client = null,
  initialName = '',
  onClose,
  onSaved,
  onViewExisting,
}) {
  const { user } = useAuth()
  const smsDisclosure = useMemo(() => buildStylistSmsDisclosure(), [])
  const verbalScript = useMemo(() => buildVerbalConsentScript(), [])

  const split = splitFullName(client ? getClientDisplayName(client) : initialName)
  const previousConsent = normalizeSmsConsent(client)
  const [firstName, setFirstName] = useState(client?.firstName || split.firstName)
  const [lastName, setLastName] = useState(client?.lastName || split.lastName)
  const [email, setEmail] = useState(client?.email || '')
  const [phone, setPhone] = useState(client?.phone || '')
  const [notes, setNotes] = useState(client?.notes || '')
  const [smsOptIn, setSmsOptIn] = useState(Boolean(previousConsent.optedIn))
  const [error, setError] = useState(null)
  const [duplicates, setDuplicates] = useState(null)
  const [saving, setSaving] = useState(false)

  const isEdit = mode === 'edit'
  const title = isEdit ? 'Edit Client' : 'Add New Client'
  const stopOnFile = hasActiveSmsOptOut(client)

  function handleSubmit(event, { allowDuplicate = false } = {}) {
    event?.preventDefault?.()
    void saveClient({ allowDuplicate })
  }

  async function saveClient({ allowDuplicate = false } = {}) {
    setError(null)
    setDuplicates(null)

    if (!firstName.trim()) {
      setError('First name is required.')
      return
    }

    if (email.trim() && !isValidEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }

    if (!allowDuplicate && !isEdit) {
      const dupes = findDuplicateClients({
        firstName,
        lastName,
        email,
        excludeId: client?.id,
      })
      if (dupes.emailMatch || dupes.nameMatches.length > 0) {
        setDuplicates({
          emailMatch: dupes.emailMatch,
          nameMatches: dupes.nameMatches,
          strictEmail: Boolean(dupes.emailMatch),
        })
        return
      }
    }

    setSaving(true)
    try {
      const now = new Date().toISOString()
      let smsConsent
      if (smsOptIn) {
        smsConsent = recordVerbalSmsConsent({
          previousConsent: client?.smsConsent,
          phone,
          recordedBy: user?.id || null,
          atIso: now,
          disclosureVersion: SMS_DISCLOSURE_VERSION,
        })
      } else {
        smsConsent = clearStylistRecordedConsent(client?.smsConsent, now, {
          recordedBy: user?.id || null,
        })
      }

      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
        smsConsent,
      }

      const saved = await (isEdit
        ? updateClient(client.id, payload)
        : createClient(payload, { allowDuplicate }))

      onSaved?.(saved)
      onClose?.()
    } catch (err) {
      if (err.code === 'sms_stop_requires_start') {
        setError(err.message)
      } else if (err.matches) {
        setDuplicates({
          emailMatch: err.code === 'duplicate_email' ? err.matches[0] : null,
          nameMatches: err.matches,
          strictEmail: err.code === 'duplicate_email',
        })
      } else {
        setError(err.message || "Couldn't save your changes. Please try again.")
      }
    } finally {
      setSaving(false)
    }
  }

  const footer = (
    <>
      <button
        type="submit"
        form="client-form"
        className="form-btn form-btn--primary"
        disabled={saving}
        style={{ background: '#2a7a6e' }}
      >
        {isEdit ? 'Save Changes' : 'Save Client'}
      </button>
      <button type="button" className="form-btn form-btn--ghost" onClick={onClose}>
        Cancel
      </button>
    </>
  )

  return (
    <Sheet title={title} onClose={onClose} footer={footer}>
      <form
        id="client-form"
        className="client-form"
        onSubmit={(e) => handleSubmit(e)}
      >
        <label className="client-form__field">
          <span className="client-form__label">First Name</span>
          <input
            className="client-form__input"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            autoComplete="given-name"
          />
        </label>

        <label className="client-form__field">
          <span className="client-form__label">Last Name</span>
          <input
            className="client-form__input"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
          />
        </label>

        <label className="client-form__field">
          <span className="client-form__label">Email</span>
          <input
            type="email"
            className="client-form__input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@email.com"
            autoComplete="email"
          />
          {!email.trim() && (
            <p className="client-form__hint">
              Email will be needed for automatic appointment confirmations.
            </p>
          )}
        </label>

        <label className="client-form__field">
          <span className="client-form__label">Phone</span>
          <input
            type="tel"
            className="client-form__input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(404) 555-1234"
            autoComplete="tel"
          />
        </label>

        <section
          className="client-form__sms"
          aria-labelledby="client-form-sms-heading"
        >
          <h3 id="client-form-sms-heading" className="client-form__sms-heading">
            SMS Appointment Reminders
          </h3>

          <div className="client-form__field client-form__field--checkbox">
            <label className="client-form__checkbox-row">
              <input
                type="checkbox"
                checked={smsOptIn}
                disabled={stopOnFile}
                onChange={(e) => setSmsOptIn(e.target.checked)}
              />
              <span>{SMS_CONSENT_CHECKBOX_LABEL}</span>
            </label>
            <p className="client-form__disclosure">{smsDisclosure}</p>
            {stopOnFile ? (
              <p className="client-form__notice" role="status">
                This customer previously replied STOP. They must text START to
                re-subscribe before SMS reminders can resume. Editing this form
                cannot clear that opt-out.
              </p>
            ) : (
              <p className="client-form__hint">
                Only check the box after the customer agrees. Imported and
                existing clients stay opted out until consent is recorded.
              </p>
            )}
            <p className="client-form__policy-links">
              <a href={SMS_PRIVACY_URL} target="_blank" rel="noopener noreferrer">
                SMS Privacy Policy
              </a>
              <span aria-hidden="true"> · </span>
              <a href={SMS_TERMS_URL} target="_blank" rel="noopener noreferrer">
                SMS Terms and Conditions
              </a>
            </p>
          </div>

          <details className="client-form__script">
            <summary>Verbal consent script</summary>
            <p>{verbalScript}</p>
          </details>
        </section>

        <label className="client-form__field">
          <span className="client-form__label">Notes</span>
          <textarea
            className="client-form__input client-form__textarea"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Preferences, allergies, etc."
          />
        </label>

        {error && (
          <div className="client-form__error" role="alert">
            {error}
          </div>
        )}

        {duplicates && (
          <div className="client-form__duplicate" role="alert">
            <p className="client-form__duplicate-title">
              This client may already exist.
            </p>
            <ul className="client-form__duplicate-list">
              {(duplicates.emailMatch
                ? [duplicates.emailMatch]
                : duplicates.nameMatches
              ).map((match) => (
                <li key={match.id}>
                  <strong>{getClientDisplayName(match)}</strong>
                  {match.email ? <span>{match.email}</span> : null}
                  {match.phone ? (
                    <span>{formatPhoneDisplay(match.phone)}</span>
                  ) : null}
                  <button
                    type="button"
                    className="client-form__link-btn"
                    onClick={() => onViewExisting?.(match)}
                  >
                    View Existing Client
                  </button>
                </li>
              ))}
            </ul>
            {!duplicates.strictEmail && (
              <button
                type="button"
                className="form-btn form-btn--ghost"
                onClick={() => handleSubmit(null, { allowDuplicate: true })}
              >
                Create Anyway
              </button>
            )}
          </div>
        )}
      </form>
    </Sheet>
  )
}
