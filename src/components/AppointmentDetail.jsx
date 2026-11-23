import { useState } from 'react'
import Sheet from './Sheet.jsx'
import AppointmentForm from './AppointmentForm.jsx'
import {
  approveRescheduleRequest,
  cancelAppointmentFromSalon,
  declineRescheduleRequest,
  deleteAppointment,
  getAppointments,
  releaseCanceledAppointmentSlot,
} from '../services/appointmentRepository.js'
import { getClientById } from '../services/clientRepository.js'
import {
  formatTimeDisplay,
  formatDuration,
  formatSelectedDate,
  parseDateKey,
  minutesToTime,
} from '../utils/dateUtils.js'
import { getAppointmentEndMinutes, isFullDayBlock } from '../utils/conflictUtils.js'
import { resolveAppointmentClientName } from '../utils/appointmentDisplay.js'
import { getAppointmentStatusLabel } from '../utils/appointmentStatus.js'
import ContactQuickActions from './ContactQuickActions.jsx'
import { getScheduleSettings } from '../data/schedule.js'
import { buildSmsUrl, formatPhoneDisplay } from '../utils/clientUtils.js'
import {
  isCanceledAppointment,
  isCanceledSlotHeld,
} from '../utils/canceledAppointment.js'
import { buildAppointmentMessageBody } from '../utils/appointmentMessages.js'
import PaymentPanel from './PaymentPanel.jsx'
import './AppointmentDetail.css'

function clientHasEmail(client) {
  const email = String(client?.email || '').trim()
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
}

export default function AppointmentDetail({ appointment, onClose }) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmRelease, setConfirmRelease] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [releaseError, setReleaseError] = useState('')
  const [decisionError, setDecisionError] = useState('')
  const [deciding, setDeciding] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)

  const isBlocked = appointment.type === 'blocked' || appointment.status === 'blocked'
  const fullDayBlock = isBlocked && isFullDayBlock(appointment)
  const endMinutes = getAppointmentEndMinutes(appointment)
  const endTime = endMinutes != null ? minutesToTime(endMinutes) : null
  const client =
    !isBlocked && appointment.clientId ? getClientById(appointment.clientId) : null
  const unblockLabel = fullDayBlock ? 'Unblock Day' : 'Remove Block'
  const unblockConfirmText = fullDayBlock
    ? 'Unblock this day? The full-day block will be removed and normal working hours will apply again if this day is normally open.'
    : 'Remove this blocked time? The selected period will become available again according to your working hours.'
  const showMissingEmail =
    !isBlocked && appointment.status === 'pending' && (!client || !clientHasEmail(client))
  const status = String(appointment.status || '').toLowerCase()
  const isCanceled = isCanceledAppointment(appointment)
  const slotHeld = isCanceled && isCanceledSlotHeld(appointment)

  const showClientActions =
    !isBlocked &&
    (isCanceled ||
      status === 'pending' ||
      status === 'confirmed' ||
      status === 'reschedule_requested')

  const messageBody = showClientActions
    ? buildAppointmentMessageBody({
        appointment,
        client,
        appointments: getAppointments(),
        settings: getScheduleSettings(),
      })
    : ''
  const smsHref = showClientActions
    ? buildSmsUrl(client?.phone, { body: messageBody })
    : null

  function handleDelete() {
    deleteAppointment(appointment.id)
      .then(() => onClose())
      .catch((err) => {
        console.error('[AppointmentDetail] delete failed', err)
      })
  }

  async function handleReleaseSlot() {
    setReleasing(true)
    setReleaseError('')
    try {
      await releaseCanceledAppointmentSlot(appointment.id)
      onClose()
    } catch (err) {
      console.error('[AppointmentDetail] free up slot failed', err)
      setReleaseError(err?.message || 'Unable to free up this slot.')
      setReleasing(false)
    }
  }

  if (editing) {
    return (
      <AppointmentForm
        mode="edit"
        appointment={appointment}
        onClose={() => setEditing(false)}
        onSaved={onClose}
      />
    )
  }

  const headerAction =
    slotHeld && !confirmRelease ? (
      <button
        type="button"
        className="sheet__header-action"
        onClick={() => {
          setConfirmDelete(false)
          setConfirmRelease(true)
        }}
      >
        Free Up Slot
      </button>
    ) : null

  return (
    <Sheet
      title={isBlocked ? 'Blocked Time' : 'Appointment'}
      onClose={onClose}
      headerAction={headerAction}
      footer={
        confirmRelease ? (
          <>
            <p className="appointment-detail__confirm-text">
              Free up this appointment time? The canceled appointment will be
              removed from the active calendar, and the time will become
              available for booking.
            </p>
            {releaseError ? (
              <p className="appointment-detail__email-hint" role="alert">
                {releaseError}
              </p>
            ) : null}
            <button
              type="button"
              className="form-btn form-btn--danger"
              onClick={handleReleaseSlot}
              disabled={releasing}
            >
              {releasing ? 'Freeing…' : 'Free Up Slot'}
            </button>
            <button
              type="button"
              className="form-btn form-btn--ghost"
              onClick={() => {
                setConfirmRelease(false)
                setReleaseError('')
              }}
              disabled={releasing}
            >
              Cancel
            </button>
          </>
        ) : confirmDelete ? (
          <>
            <p className="appointment-detail__confirm-text">
              {isBlocked ? unblockConfirmText : 'Delete this appointment?'}
            </p>
            <button type="button" className="form-btn form-btn--danger" onClick={handleDelete}>
              {isBlocked ? unblockLabel : 'Delete'}
            </button>
            <button
              type="button"
              className="form-btn form-btn--ghost"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {showClientActions ? (
              smsHref ? (
                <a
                  className="form-btn appointment-detail__message"
                  href={smsHref}
                >
                  Message
                </a>
              ) : (
                <button
                  type="button"
                  className="form-btn appointment-detail__message"
                  disabled
                  title="No phone number on file for this client"
                >
                  Message
                </button>
              )
            ) : null}
            {!isCanceled && !isBlocked ? (
              <button
                type="button"
                className="form-btn form-btn--primary"
                onClick={() => setEditing(true)}
              >
                Reschedule / Edit
              </button>
            ) : null}
            {!isCanceled && !isBlocked ? (
              <button
                type="button"
                className="form-btn form-btn--ghost"
                onClick={async () => {
                  try {
                    await cancelAppointmentFromSalon(appointment.id)
                    onClose()
                  } catch (error) {
                    setDecisionError(error?.message || 'Could not cancel the appointment.')
                  }
                }}
              >
                Cancel Appointment
              </button>
            ) : null}
            {isBlocked ? (
              <button
                type="button"
                className="form-btn form-btn--danger"
                onClick={() => setConfirmDelete(true)}
              >
                {unblockLabel}
              </button>
            ) : (
              <button
                type="button"
                className="form-btn form-btn--ghost"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            )}
            {isBlocked ? (
              <button
                type="button"
                className="form-btn form-btn--ghost"
                onClick={() => setEditing(true)}
              >
                Edit Block
              </button>
            ) : null}
          </>
        )
      }
    >
      <div className="appointment-detail">
        <p className="appointment-detail__date">
          {formatSelectedDate(parseDateKey(appointment.date))}
        </p>
        <p className="appointment-detail__time">
          {formatTimeDisplay(appointment.startTime)}
          {endTime ? ` – ${formatTimeDisplay(endTime)}` : ''}
        </p>

        <div
          className={`appointment-detail__badge appointment-detail__badge--${appointment.status}`}
        >
          {getAppointmentStatusLabel(appointment.status)}
        </div>
        <PaymentPanel appointment={appointment} />

        {appointment.status === 'reschedule_requested' &&
        appointment.rescheduleRequest?.status === 'pending' ? (
          <div className="appointment-detail__request">
            <p className="appointment-detail__reschedule-hint" role="status">
              Reschedule Requested
            </p>
            <p>
              Current appointment: {formatSelectedDate(parseDateKey(appointment.date))} —{' '}
              {formatTimeDisplay(appointment.startTime)}
            </p>
            <p>
              Requested appointment:{' '}
              {formatSelectedDate(parseDateKey(appointment.rescheduleRequest.date))} —{' '}
              {formatTimeDisplay(appointment.rescheduleRequest.startTime)}
            </p>
            <div className="appointment-detail__request-actions">
              <button
                type="button"
                className="form-btn form-btn--primary"
                disabled={deciding}
                onClick={async () => {
                  setDeciding(true)
                  setDecisionError('')
                  try {
                    const result = await approveRescheduleRequest(appointment.id)
                    if (!result.ok) {
                      setDecisionError(
                        result.message || 'That time is no longer available. You can decline it.',
                      )
                    }
                  } catch (error) {
                    setDecisionError(error?.message || 'Could not approve the request.')
                  } finally {
                    setDeciding(false)
                  }
                }}
              >
                Approve
              </button>
              <button
                type="button"
                className="form-btn form-btn--primary"
                disabled={deciding}
                onClick={() => setContactOpen(true)}
              >
                Contact Customer
              </button>
              <button
                type="button"
                className="form-btn form-btn--ghost"
                disabled={deciding}
                onClick={async () => {
                  setDeciding(true)
                  setDecisionError('')
                  try {
                    await declineRescheduleRequest(appointment.id)
                  } catch (error) {
                    setDecisionError(error?.message || 'Could not keep the original time.')
                  } finally {
                    setDeciding(false)
                  }
                }}
              >
                Keep original time
              </button>
            </div>
            {decisionError ? <p role="alert">{decisionError}</p> : null}
            {contactOpen ? (
              <div className="appointment-detail__draft" aria-label="Simulated conversation">
                <p className="contact-bubble contact-bubble--them">Can we find another time for my {appointment.service || 'appointment'}?</p>
                <p className="contact-bubble contact-bubble--you">
                  Hi {client?.firstName || 'there'}, this is Mara at Lumen & Co. I saw your request to move from {formatTimeDisplay(appointment.startTime)} to {formatTimeDisplay(appointment.rescheduleRequest.startTime)}. Your original time stays reserved until I approve a new one.
                </p>
                <p className="appointment-detail__draft-note">Simulated conversation. Nothing is sent.</p>
                <button type="button" className="form-btn form-btn--ghost" onClick={() => setContactOpen(false)}>Close message</button>
              </div>
            ) : null}
          </div>
        ) : appointment.status === 'reschedule_requested' ? (
          <p className="appointment-detail__reschedule-hint" role="status">
            Reschedule requested — contact the client and choose a new time.
            The original slot stays until you edit it.
          </p>
        ) : null}
        {decisionError && appointment.rescheduleRequest?.status !== 'pending' ? (
          <p role="alert">{decisionError}</p>
        ) : null}

        {slotHeld ? (
          <p className="appointment-detail__canceled-hint" role="status">
            This time is still held on your calendar. Free Up Slot when you are
            ready to make it available again.
          </p>
        ) : null}

        {showMissingEmail ? (
          <p className="appointment-detail__email-hint">
            No email available for automatic confirmation
          </p>
        ) : null}

        {appointment.confirmationEmail?.status === 'failed' ||
        appointment.confirmationEmail?.status === 'not_sent' ? (
          <p className="appointment-detail__email-hint" role="status">
            Confirmation email was not sent. Follow up with the client.
          </p>
        ) : null}

        <dl className="appointment-detail__meta">
          {!isBlocked && (
            <div>
              <dt>Client</dt>
              <dd>{resolveAppointmentClientName(appointment)}</dd>
            </div>
          )}
          {!isBlocked && client?.phone ? (
            <div>
              <dt>Phone</dt>
              <dd>{formatPhoneDisplay(client.phone)}</dd>
            </div>
          ) : null}
          {!isBlocked && clientHasEmail(client) ? (
            <div>
              <dt>Email</dt>
              <dd>{String(client.email).trim()}</dd>
            </div>
          ) : null}
          {isBlocked ? (
            <div>
              <dt>Block type</dt>
              <dd>{fullDayBlock ? 'Full day' : 'Partial day'}</dd>
            </div>
          ) : null}
          <div>
            <dt>{isBlocked ? 'Label' : 'Service'}</dt>
            <dd>{appointment.service || (isBlocked ? 'Blocked time' : '—')}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{formatDuration(appointment.durationMinutes)}</dd>
          </div>
          {isBlocked && appointment.notes ? (
            <div>
              <dt>Reason</dt>
              <dd>{appointment.notes}</dd>
            </div>
          ) : null}
          {!isBlocked && appointment.notes ? (
            <div>
              <dt>Notes</dt>
              <dd>{appointment.notes}</dd>
            </div>
          ) : null}
        </dl>

        {showClientActions ? (
          <ContactQuickActions
            phone={client?.phone}
            showMessage={false}
            showCall
            className="appointment-detail__contact"
          />
        ) : null}
      </div>
    </Sheet>
  )
}
