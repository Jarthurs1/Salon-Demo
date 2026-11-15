import { useEffect, useMemo, useState } from 'react'
import DaySelector from './DaySelector.jsx'
import AppointmentList from './AppointmentList.jsx'
import AppointmentForm from './AppointmentForm.jsx'
import AppointmentDetail from './AppointmentDetail.jsx'
import AppHeader from './AppHeader.jsx'
import { useAppointments } from '../hooks/useAppointments.js'
import { isClosedDay } from '../data/schedule.js'
import { useScheduleSettings } from '../hooks/useScheduleSettings.js'
import { getDayStatusIndicator } from '../utils/timelineUtils.js'
import { isRescheduleRequested } from '../utils/appointmentStatus.js'
import {
  startOfDay,
  toDateKey,
  formatSelectedDate,
  isPastDay,
  parseDateKey,
  addDays,
  getDateRange,
} from '../utils/dateUtils.js'
import './CalendarView.css'

export default function CalendarView({
  focusDateKey = null,
  onRefresh = null,
  onOpenHelp = null,
  onOpenSettings = null,
  onBookAvailableSlot = null,
}) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const settings = useScheduleSettings()
  const allAppointments = useAppointments()
  const [refreshing, setRefreshing] = useState(false)

  const initialDate = useMemo(() => {
    if (focusDateKey) {
      try {
        return startOfDay(parseDateKey(focusDateKey))
      } catch {
        return today
      }
    }
    return today
  }, [focusDateKey, today])

  const [selectedDate, setSelectedDate] = useState(() => initialDate)
  const [sheet, setSheet] = useState(null)

  useEffect(() => {
    if (!focusDateKey) return
    try {
      setSelectedDate(startOfDay(parseDateKey(focusDateKey)))
    } catch {
      // Ignore invalid focus keys from navigation.
    }
  }, [focusDateKey])

  const calendarDays = useMemo(() => {
    const start = addDays(today, -7)
    const end = addDays(today, settings.maxFutureWeeks * 7)
    return getDateRange(start, end)
  }, [today, settings.maxFutureWeeks])

  const dayIndicators = useMemo(() => {
    const map = {}
    for (const day of calendarDays) {
      const key = toDateKey(day)
      const dayAppts = allAppointments.filter((a) => a.date === key)
      map[key] = getDayStatusIndicator(dayAppts)
    }
    return map
  }, [calendarDays, allAppointments])

  function handleSelectDay(day) {
    setSelectedDate(startOfDay(day))
  }

  const dateKey = toDateKey(selectedDate)
  const appointments = allAppointments.filter((a) => a.date === dateKey)
  const canBlock =
    !isPastDay(selectedDate, today) &&
    !isClosedDay(selectedDate, settings) &&
    !sheet

  async function handleRefresh() {
    if (!onRefresh || refreshing) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="calendar-view">
      <AppHeader
        subtitle="Your Schedule"
        onOpenHelp={onOpenHelp}
        onRefresh={onRefresh ? handleRefresh : null}
        refreshing={refreshing}
        onOpenSettings={onOpenSettings}
      />

      {allAppointments.filter((item) => isRescheduleRequested(item)).length > 0 ? (
        <button
          type="button"
          className="calendar-view__requests"
          onClick={() => {
            const next = allAppointments.find((item) => isRescheduleRequested(item))
            if (!next) return
            setSelectedDate(startOfDay(parseDateKey(next.date)))
            setSheet({ type: 'detail', appointment: next })
          }}
        >
          Reschedule Requests (
          {allAppointments.filter((item) => isRescheduleRequested(item)).length})
        </button>
      ) : null}

      <h2 className="calendar-view__selected-date">
        {formatSelectedDate(selectedDate)}
      </h2>

      <DaySelector
        days={calendarDays}
        selectedDate={selectedDate}
        today={today}
        onSelectDay={handleSelectDay}
        dayIndicators={dayIndicators}
      />

      <AppointmentList
        appointments={appointments}
        selectedDate={selectedDate}
        today={today}
        canBlock={canBlock}
        onSelectAppointment={(appointment) =>
          setSheet({ type: 'detail', appointment })
        }
        onBlockTime={() => setSheet({ type: 'block' })}
        onBookAvailableSlot={onBookAvailableSlot}
      />

      {sheet?.type === 'block' && (
        <AppointmentForm
          mode="block"
          initialDate={selectedDate}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet?.type === 'detail' && sheet.appointment && (
        <AppointmentDetail
          appointment={
            allAppointments.find((a) => a.id === sheet.appointment.id) ??
            sheet.appointment
          }
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
