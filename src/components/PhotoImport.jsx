import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'
import Sheet from './Sheet.jsx'
import { useClients } from '../hooks/useClients.js'
import { useAppointments } from '../hooks/useAppointments.js'
import { compressImageForImport } from '../import/compressImageForImport.js'
import {
  extractFromPhotos,
  isPhotoImportConfigured,
} from '../import/photoImportApi.js'
import {
  enrichClientsWithMatches,
  matchLabel,
} from '../import/matchImportedClients.js'
import {
  enrichAppointmentsForReview,
  appointmentCanImport,
} from '../import/enrichImportedAppointments.js'
import { savePhotoImport } from '../import/savePhotoImport.js'
import { formatPhoneDisplay, getClientDisplayName } from '../utils/clientUtils.js'
import { SERVICE_LABELS, getDefaultDurationForService } from '../data/services.js'
import './PhotoImport.css'

const MAX_IMAGES = 10
const DURATION_OPTIONS = [30, 45, 60, 90, 120, 150, 180, 240]

function uncertainClass(row, field) {
  return row.uncertainFields?.includes(field) ? 'photo-import__field--uncertain' : ''
}

function makeLocalId() {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * @param {{ onClose: () => void, initialMode?: 'clients'|'calendar' }} props
 */
export default function PhotoImport({ onClose, initialMode = 'clients' }) {
  const existingClients = useClients()
  const existingAppointments = useAppointments()
  const [mode, setMode] = useState(
    initialMode === 'calendar' ? 'calendar' : 'clients',
  )
  const [step, setStep] = useState('pick') // pick | reading | review | saving | done
  const [error, setError] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [clients, setClients] = useState([])
  const [appointments, setAppointments] = useState([])
  const [summary, setSummary] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState([])
  const previewUrlsRef = useRef([])

  const configured = isPhotoImportConfigured()
  const isCalendar = mode === 'calendar'

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      previewUrlsRef.current = []
    }
  }, [])

  const selectedCount = useMemo(() => {
    if (isCalendar) {
      return appointments.filter((row) => appointmentCanImport(row)).length
    }
    return clients.filter((row) => row.selected && row.action !== 'skip').length
  }, [clients, appointments, isCalendar])

  const blockingCount = useMemo(() => {
    if (!isCalendar) return 0
    return appointments.filter((row) => row.selected && !appointmentCanImport(row))
      .length
  }, [appointments, isCalendar])

  function clearPreviews() {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrlsRef.current = []
  }

  function addFiles(fileList) {
    setError(null)
    const incoming = Array.from(fileList || []).filter((file) =>
      String(file.type || '').startsWith('image/'),
    )
    if (!incoming.length) {
      setError('Please choose photo files (JPG or PNG).')
      return
    }

    setSelectedFiles((current) => {
      const room = MAX_IMAGES - current.length
      if (room <= 0) {
        setError(`You can import up to ${MAX_IMAGES} photos at a time.`)
        return current
      }
      const accepted = incoming.slice(0, room)
      if (incoming.length > room) {
        setError(
          `Only ${MAX_IMAGES} photos can be imported at once. Extra photos were skipped.`,
        )
      }
      const next = accepted.map((file) => {
        const previewUrl = URL.createObjectURL(file)
        previewUrlsRef.current.push(previewUrl)
        return {
          id: makeLocalId(),
          file,
          previewUrl,
          name: file.name || 'Photo',
        }
      })
      return [...current, ...next]
    })
  }

  function removeSelected(id) {
    setSelectedFiles((current) => {
      const target = current.find((item) => item.id === id)
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl)
        previewUrlsRef.current = previewUrlsRef.current.filter(
          (url) => url !== target.previewUrl,
        )
      }
      return current.filter((item) => item.id !== id)
    })
  }

  async function handleScan() {
    setError(null)
    if (!configured) {
      setError('Photo import is not available in this build yet.')
      return
    }
    if (!selectedFiles.length) {
      setError('Add at least one photo first.')
      return
    }

    setStep('reading')
    try {
      const compressed = []
      for (const item of selectedFiles) {
        compressed.push(await compressImageForImport(item.file))
      }
      const extracted = await extractFromPhotos(compressed, { mode })
      const enrichedClients = enrichClientsWithMatches(
        extracted.clients,
        existingClients,
      )

      if (isCalendar) {
        const enriched = enrichAppointmentsForReview(
          extracted.appointments || [],
          existingClients,
          existingAppointments,
          enrichedClients,
        )
        setClients(enriched.clients.length ? enriched.clients : enrichedClients)
        setAppointments(enriched.appointments)
      } else {
        setClients(enrichedClients)
        setAppointments([])
      }

      setWarnings(extracted.warnings || [])
      clearPreviews()
      setSelectedFiles([])
      setStep('review')
    } catch (err) {
      console.error('[PhotoImport] extract failed', err?.code || err?.name || 'error')
      setError(
        err?.code === 'demo_restricted'
          ? 'Photo import is disabled in the demonstration account to avoid paid AI usage. You can still create appointments and clients manually.'
          : err?.message || 'Could not read those photos.',
      )
      setStep('pick')
    }
  }

  function updateClient(tempId, patch) {
    setClients((list) =>
      list.map((row) => {
        if (row.tempId !== tempId) return row
        const next = { ...row, ...patch }
        if (patch.action === 'link' && patch.linkedClientId) {
          next.linkedClientId = patch.linkedClientId
        }
        if (patch.action === 'create') {
          next.linkedClientId = null
        }
        return next
      }),
    )
  }

  function updateAppointment(tempId, patch) {
    setAppointments((list) => {
      const next = list.map((row) => {
        if (row.tempId !== tempId) return row
        const merged = { ...row, ...patch }
        if (Object.prototype.hasOwnProperty.call(patch, 'durationMinutes')) {
          merged.durationInferred = false
          merged.durationSource = 'visible'
          merged.needsDuration = patch.durationMinutes == null
          merged.uncertainFields = (merged.uncertainFields || []).filter(
            (f) => f !== 'duration',
          )
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'date')) {
          merged.needsDate = !patch.date
          if (patch.date) {
            merged.uncertainFields = (merged.uncertainFields || []).filter(
              (f) => f !== 'date',
            )
          }
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'service') && patch.service) {
          if (merged.durationMinutes == null) {
            const inferred = getDefaultDurationForService(patch.service, null)
            if (inferred != null) {
              merged.durationMinutes = inferred
              merged.durationInferred = true
              merged.durationSource = 'inferred_service'
              merged.needsDuration = true
            }
          }
        }
        return merged
      })
      return enrichAppointmentsForReview(
        next,
        existingClients,
        existingAppointments,
        clients,
      ).appointments
    })
  }

  async function handleSave() {
    setError(null)
    if (selectedCount === 0) {
      setError(
        isCalendar
          ? blockingCount > 0
            ? 'Resolve conflicts and missing fields before importing.'
            : 'Select at least one appointment to save.'
          : 'Select at least one client to save.',
      )
      return
    }
    setStep('saving')
    try {
      const appointmentsToSave = isCalendar
        ? appointments.filter((row) => appointmentCanImport(row))
        : []

      const { clients: calendarClients, appointments: calendarAppts } =
        isCalendar
          ? buildClientsForCalendarSave(clients, appointmentsToSave)
          : {
              clients: clients.filter(
                (row) => row.selected && row.action !== 'skip',
              ),
              appointments: [],
            }

      const result = await savePhotoImport({
        clients: calendarClients,
        appointments: isCalendar ? calendarAppts : [],
      })
      setSummary(result)
      setStep('done')
    } catch (err) {
      console.error('[PhotoImport] save failed', err?.name || 'error')
      setError(err?.message || 'Could not save. Please try again.')
      setStep('review')
    }
  }

  const title = isCalendar ? 'Import Calendar from Photo' : 'Import Client List'
  const scanLabel = isCalendar ? 'Scan Calendar' : 'Scan Clients'

  const footer =
    step === 'pick' ? (
      <>
        <button
          type="button"
          className="form-btn form-btn--primary"
          onClick={handleScan}
          disabled={!configured || selectedFiles.length === 0}
        >
          {scanLabel}
        </button>
        <button type="button" className="form-btn form-btn--ghost" onClick={onClose}>
          Cancel
        </button>
      </>
    ) : step === 'review' ? (
      <>
        <button
          type="button"
          className="form-btn form-btn--primary"
          onClick={handleSave}
          disabled={selectedCount === 0}
        >
          Import {selectedCount > 0 ? selectedCount : ''} selected
        </button>
        <button type="button" className="form-btn form-btn--ghost" onClick={onClose}>
          Cancel
        </button>
      </>
    ) : step === 'done' ? (
      <button type="button" className="form-btn form-btn--primary" onClick={onClose}>
        Done
      </button>
    ) : null

  return (
    <Sheet title={title} onClose={onClose} footer={footer}>
      <div className="photo-import">
        {error ? <p className="photo-import__error" role="alert">{error}</p> : null}

        {step === 'pick' ? (
          <div className="photo-import__pick">
            <div className="photo-import__mode" role="group" aria-label="Import type">
              <button
                type="button"
                className={`photo-import__mode-btn${mode === 'clients' ? ' photo-import__mode-btn--active' : ''}`}
                onClick={() => setMode('clients')}
              >
                Clients
              </button>
              <button
                type="button"
                className={`photo-import__mode-btn${mode === 'calendar' ? ' photo-import__mode-btn--active' : ''}`}
                onClick={() => setMode('calendar')}
              >
                Calendar appointments
              </button>
            </div>

            <p className="photo-import__lead">
              {isCalendar
                ? 'Import handwritten books, printed schedules, or calendar screenshots. Review every appointment before saving.'
                : 'Import handwritten lists, printed lists, or contact screenshots. Review everything before saving.'}
            </p>
            <p className="photo-import__note">
              You can select up to {MAX_IMAGES} photos. Photos are read once and not
              kept.
              {isCalendar
                ? ' Appointments import as Pending and never trigger emails or SMS.'
                : ' Imports never opt clients into SMS.'}
            </p>
            {!configured ? (
              <p className="photo-import__error">
                Photo import is not configured for this build.
              </p>
            ) : (
              <>
                <div className="photo-import__actions">
                  <label className="photo-import__action">
                    <Camera size={20} strokeWidth={2.25} />
                    <span>Take Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="photo-import__file"
                      onChange={(e) => {
                        addFiles(e.target.files)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  <label className="photo-import__action photo-import__action--secondary">
                    <ImagePlus size={20} strokeWidth={2.25} />
                    <span>Choose Photos</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="photo-import__file"
                      onChange={(e) => {
                        addFiles(e.target.files)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>

                {selectedFiles.length > 0 ? (
                  <div className="photo-import__previews">
                    <p className="photo-import__preview-label">
                      {selectedFiles.length} photo
                      {selectedFiles.length === 1 ? '' : 's'} ready
                    </p>
                    <ul className="photo-import__preview-list">
                      {selectedFiles.map((item) => (
                        <li key={item.id} className="photo-import__preview-item">
                          <img src={item.previewUrl} alt="" />
                          <button
                            type="button"
                            className="photo-import__preview-remove"
                            aria-label="Remove photo"
                            onClick={() => removeSelected(item.id)}
                          >
                            <X size={14} strokeWidth={2.5} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {step === 'reading' || step === 'saving' ? (
          <div className="photo-import__busy" role="status">
            <div className="photo-import__spinner" aria-hidden="true" />
            <p>
              {step === 'reading'
                ? isCalendar
                  ? 'Scanning appointments from your photos…'
                  : 'Scanning clients from your photos…'
                : 'Saving to your salon records…'}
            </p>
          </div>
        ) : null}

        {step === 'review' ? (
          <div className="photo-import__review">
            {warnings.length > 0 ? (
              <ul className="photo-import__warnings">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}

            {isCalendar ? (
              <CalendarReview
                appointments={appointments}
                existingClients={existingClients}
                updateAppointment={updateAppointment}
              />
            ) : (
              <ClientsReview
                clients={clients}
                updateClient={updateClient}
              />
            )}
          </div>
        ) : null}

        {step === 'done' ? (
          <div className="photo-import__done">
            <p className="photo-import__lead">Import saved.</p>
            <ul className="photo-import__summary">
              {isCalendar ? (
                <>
                  <li>{summary?.appointmentsCreated || 0} appointments created</li>
                  <li>{summary?.clientsCreated || 0} new clients created</li>
                  <li>
                    {(summary?.clientsLinked || 0) + (summary?.clientsUpdated || 0)}{' '}
                    existing clients linked
                  </li>
                </>
              ) : (
                <>
                  <li>{summary?.clientsCreated || 0} clients created</li>
                  <li>
                    {(summary?.clientsLinked || 0) + (summary?.clientsUpdated || 0)}{' '}
                    existing clients reviewed
                  </li>
                </>
              )}
            </ul>
            {summary?.errors?.length ? (
              <ul className="photo-import__warnings">
                {summary.errors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              className="photo-import__dismiss"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        ) : null}
      </div>
    </Sheet>
  )
}

function ClientsReview({ clients, updateClient }) {
  return (
    <section className="photo-import__section">
      <h2>Clients ({clients.length})</h2>
      {clients.length === 0 ? (
        <p className="photo-import__empty">No clients found in these photos.</p>
      ) : (
        clients.map((row) => (
          <article
            key={row.tempId}
            className={`photo-import__card${row.confidence === 'low' ? ' photo-import__card--low' : ''}`}
          >
            <label className="photo-import__select">
              <input
                type="checkbox"
                checked={row.selected && row.action !== 'skip'}
                onChange={(e) =>
                  updateClient(row.tempId, {
                    selected: e.target.checked,
                    action: e.target.checked
                      ? row.action === 'skip'
                        ? 'create'
                        : row.action
                      : 'skip',
                  })
                }
              />
              <span>Include</span>
            </label>
            <p className="photo-import__match">
              {row.confidence === 'low' || row.uncertainFields?.length
                ? 'Needs review · '
                : ''}
              {matchLabel(row.match)}
            </p>
            <div className="photo-import__grid">
              <label className={uncertainClass(row, 'firstName') || undefined}>
                First name
                <input
                  value={row.firstName}
                  onChange={(e) =>
                    updateClient(row.tempId, { firstName: e.target.value })
                  }
                />
              </label>
              <label className={uncertainClass(row, 'lastName') || undefined}>
                Last name
                <input
                  value={row.lastName}
                  onChange={(e) =>
                    updateClient(row.tempId, { lastName: e.target.value })
                  }
                />
              </label>
              <label className={uncertainClass(row, 'phone') || undefined}>
                Phone
                <input
                  value={row.phone}
                  inputMode="tel"
                  onChange={(e) =>
                    updateClient(row.tempId, { phone: e.target.value })
                  }
                />
              </label>
              <label className={uncertainClass(row, 'email') || undefined}>
                Email
                <input
                  value={row.email}
                  inputMode="email"
                  onChange={(e) =>
                    updateClient(row.tempId, { email: e.target.value })
                  }
                />
              </label>
              <label className="photo-import__full">
                Notes
                <input
                  value={row.notes}
                  onChange={(e) =>
                    updateClient(row.tempId, { notes: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="photo-import__full">
              Duplicate handling
              <select
                value={
                  row.action === 'link' && row.linkedClientId
                    ? `link:${row.linkedClientId}`
                    : row.action === 'skip'
                      ? 'skip'
                      : 'create'
                }
                onChange={(e) => {
                  const value = e.target.value
                  if (value === 'create') {
                    updateClient(row.tempId, {
                      action: 'create',
                      linkedClientId: null,
                      selected: true,
                    })
                  } else if (value === 'skip') {
                    updateClient(row.tempId, {
                      action: 'skip',
                      selected: false,
                    })
                  } else if (value.startsWith('link:')) {
                    updateClient(row.tempId, {
                      action: 'link',
                      linkedClientId: value.slice(5),
                      selected: true,
                    })
                  }
                }}
              >
                <option value="create">Add as New</option>
                {(row.match?.candidates?.length
                  ? row.match.candidates
                  : row.match?.matchedClient
                    ? [row.match.matchedClient]
                    : []
                ).map((candidate) => (
                  <option key={candidate.id} value={`link:${candidate.id}`}>
                    Review Existing Client · {getClientDisplayName(candidate)}
                    {candidate.phone
                      ? ` · ${formatPhoneDisplay(candidate.phone)}`
                      : ''}
                  </option>
                ))}
                <option value="skip">Skip</option>
              </select>
            </label>
            {row.uncertainFields?.length > 0 ? (
              <p className="photo-import__uncertain-note">
                Needs review: {row.uncertainFields.join(', ')}
              </p>
            ) : null}
          </article>
        ))
      )}
    </section>
  )
}

function CalendarReview({ appointments, existingClients, updateAppointment }) {
  return (
    <section className="photo-import__section">
      <h2>Appointments ({appointments.length})</h2>
      {appointments.length === 0 ? (
        <p className="photo-import__empty">
          No appointments found in these photos.
        </p>
      ) : (
        appointments.map((row) => {
          const canImport = appointmentCanImport(row)
          return (
            <article
              key={row.tempId}
              className={[
                'photo-import__card',
                row.confidence === 'low' ? 'photo-import__card--low' : '',
                row.blocking ? 'photo-import__card--conflict' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <label className="photo-import__select">
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={(e) =>
                    updateAppointment(row.tempId, {
                      selected: e.target.checked,
                    })
                  }
                />
                <span>Include</span>
              </label>

              <p className="photo-import__match">
                {row.matchLabel || 'New client'}
                {!canImport && row.selected ? ' · Resolve before import' : ''}
              </p>

              {row.warnings?.length ? (
                <ul className="photo-import__row-warnings">
                  {row.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}

              <div className="photo-import__grid">
                <label
                  className={[
                    'photo-import__full',
                    uncertainClass(row, 'clientName'),
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  Customer
                  <input
                    value={row.clientName}
                    onChange={(e) =>
                      updateAppointment(row.tempId, {
                        clientName: e.target.value,
                      })
                    }
                  />
                </label>

                <label className="photo-import__full">
                  Client match
                  <select
                    value={
                      row.linkedClientId
                        ? `link:${row.linkedClientId}`
                        : 'create'
                    }
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === 'create') {
                        updateAppointment(row.tempId, {
                          linkedClientId: null,
                          clientAction: 'create',
                        })
                      } else if (value.startsWith('link:')) {
                        const id = value.slice(5)
                        const found = existingClients.find((c) => c.id === id)
                        updateAppointment(row.tempId, {
                          linkedClientId: id,
                          clientAction: 'link',
                          clientName: found
                            ? getClientDisplayName(found)
                            : row.clientName,
                        })
                      }
                    }}
                  >
                    <option value="create">Create new client</option>
                    {(row.match?.candidates?.length
                      ? row.match.candidates
                      : existingClients
                    )
                      .slice(0, 40)
                      .map((candidate) => (
                        <option key={candidate.id} value={`link:${candidate.id}`}>
                          {getClientDisplayName(candidate)}
                          {candidate.phone
                            ? ` · ${formatPhoneDisplay(candidate.phone)}`
                            : ''}
                        </option>
                      ))}
                  </select>
                </label>

                <label className={uncertainClass(row, 'date') || undefined}>
                  Date
                  <input
                    type="date"
                    value={row.date}
                    onChange={(e) =>
                      updateAppointment(row.tempId, { date: e.target.value })
                    }
                  />
                </label>

                <label className={uncertainClass(row, 'startTime') || undefined}>
                  Start time
                  <input
                    type="time"
                    value={row.startTime}
                    onChange={(e) =>
                      updateAppointment(row.tempId, {
                        startTime: e.target.value,
                      })
                    }
                  />
                </label>

                <label
                  className={[
                    uncertainClass(row, 'duration'),
                    row.durationInferred ? 'photo-import__field--inferred' : '',
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined}
                >
                  Duration
                  <select
                    value={row.durationMinutes ?? ''}
                    onChange={(e) => {
                      const value = e.target.value
                      updateAppointment(row.tempId, {
                        durationMinutes: value === '' ? null : Number(value),
                      })
                    }}
                  >
                    <option value="">Select duration…</option>
                    {DURATION_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} min
                        {row.durationInferred &&
                        row.durationMinutes === minutes
                          ? ' (inferred)'
                          : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label
                  className={[
                    'photo-import__full',
                    uncertainClass(row, 'service'),
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  Service
                  <input
                    value={row.service}
                    list="photo-import-services"
                    onChange={(e) =>
                      updateAppointment(row.tempId, {
                        service: e.target.value,
                      })
                    }
                  />
                </label>

                <label className="photo-import__full">
                  Notes
                  <input
                    value={row.notes}
                    onChange={(e) =>
                      updateAppointment(row.tempId, { notes: e.target.value })
                    }
                  />
                </label>

                <label className="photo-import__full">
                  Status
                  <select
                    value={row.status || 'pending'}
                    onChange={(e) =>
                      updateAppointment(row.tempId, { status: e.target.value })
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                  </select>
                </label>
              </div>

              {row.outsideHours ? (
                <label className="photo-import__select photo-import__outside">
                  <input
                    type="checkbox"
                    checked={Boolean(row.allowOutsideHours)}
                    onChange={(e) =>
                      updateAppointment(row.tempId, {
                        allowOutsideHours: e.target.checked,
                      })
                    }
                  />
                  <span>Allow outside regular working hours</span>
                </label>
              ) : null}
            </article>
          )
        })
      )}
      <datalist id="photo-import-services">
        {SERVICE_LABELS.map((label) => (
          <option key={label} value={label} />
        ))}
      </datalist>
    </section>
  )
}

/**
 * For calendar imports, only persist clients needed by selected appointments.
 */
function buildClientsForCalendarSave(clients, appointments) {
  const neededTempIds = new Set(
    appointments.map((a) => a.clientTempId).filter(Boolean),
  )

  const fromDrafts = (clients || [])
    .filter((c) => neededTempIds.has(c.tempId))
    .map((c) => ({
      ...c,
      selected: true,
      action: c.action === 'link' && c.linkedClientId ? 'link' : 'create',
    }))

  const draftByTemp = new Map(fromDrafts.map((c) => [c.tempId, c]))
  const synthetic = []
  const remapped = appointments.map((appt) => {
    if (appt.linkedClientId) {
      const tempId = `link-only-${appt.linkedClientId}`
      if (!synthetic.some((c) => c.tempId === tempId) && !draftByTemp.has(appt.clientTempId)) {
        synthetic.push({
          tempId,
          selected: true,
          action: 'link',
          linkedClientId: appt.linkedClientId,
          firstName: '',
          lastName: '',
          phone: '',
          email: '',
          notes: '',
        })
      }
      return {
        ...appt,
        clientTempId: draftByTemp.has(appt.clientTempId)
          ? appt.clientTempId
          : tempId,
      }
    }
    return appt
  })

  return {
    clients: [...fromDrafts, ...synthetic],
    appointments: remapped,
  }
}
