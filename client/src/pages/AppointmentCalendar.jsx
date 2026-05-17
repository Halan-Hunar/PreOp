import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listAppointments } from '../api/appointments'
import Spinner from '../components/Spinner'
import StatusBadge from '../components/StatusBadge'
import { useLanguage } from '../context/LanguageContext'

function toIsoDate(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function addDays(d, n) {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}

function startOfWeek(d) {
  const c = new Date(d)
  const day = c.getDay()
  c.setDate(c.getDate() - day)
  return c
}

function fmtTime(t) {
  if (!t) return '—'
  const [h, m] = t.split(':')
  const hh = parseInt(h, 10)
  const period = hh >= 12 ? 'PM' : 'AM'
  const display = ((hh + 11) % 12) + 1
  return `${display}:${m} ${period}`
}

const HOURS = Array.from({ length: 11 }, (_, i) => 7 + i)

export default function AppointmentCalendar() {
  const navigate = useNavigate()
  const { t, lang, dr } = useLanguage()
  const localeTag = lang === 'ku' ? 'ku' : undefined

  const [view, setView] = useState('day')
  const [anchor, setAnchor] = useState(new Date())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const range = useMemo(() => {
    if (view === 'day') return [anchor]
    const start = startOfWeek(anchor)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [view, anchor])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        if (view === 'day') {
          const r = await listAppointments({ date: toIsoDate(anchor), limit: 100 })
          if (!cancelled) setItems(r.appointments || [])
        } else {
          const all = await Promise.all(
            range.map((d) => listAppointments({ date: toIsoDate(d), limit: 100 }))
          )
          if (!cancelled) setItems(all.flatMap((r) => r.appointments || []))
        }
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || t('common.failedLoad'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchor])

  const byDateHour = useMemo(() => {
    const map = new Map()
    items.forEach((a) => {
      const date = a.scheduled_date?.slice(0, 10)
      const hour = parseInt(a.scheduled_time?.slice(0, 2) || '0', 10)
      const key = `${date}|${hour}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(a)
    })
    return map
  }, [items])

  const shift = (n) => {
    setAnchor((a) => addDays(a, view === 'day' ? n : n * 7))
  }

  const dateLabel =
    view === 'day'
      ? anchor.toLocaleDateString(localeTag, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : t('calendar.weekOf', {
          date: startOfWeek(anchor).toLocaleDateString(localeTag, {
            month: 'short',
            day: 'numeric',
          }),
        })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface tracking-tight">
            {t('calendar.title')}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">{dateLabel}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-surface-container-high rounded-lg p-1">
            <button
              onClick={() => setView('day')}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                view === 'day' ? 'bg-surface text-secondary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              {t('calendar.day')}
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                view === 'week' ? 'bg-surface text-secondary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              {t('calendar.week')}
            </button>
          </div>

          <div className="flex items-center gap-1 bg-surface-container-lowest border border-outline-variant rounded-lg px-1">
            <button
              onClick={() => shift(-1)}
              className="p-1.5 hover:bg-surface-container-high rounded-md transition-colors"
              aria-label={t('calendar.previous')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                chevron_left
              </span>
            </button>
            <button
              onClick={() => setAnchor(new Date())}
              className="px-3 py-1 text-xs font-semibold text-on-surface-variant hover:text-secondary"
            >
              {t('calendar.today')}
            </button>
            <button
              onClick={() => shift(1)}
              className="p-1.5 hover:bg-surface-container-high rounded-md transition-colors"
              aria-label={t('calendar.next')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                chevron_right
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Spinner size={28} />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-on-error-container bg-error-container">{error}</div>
        ) : (
          <div className="overflow-auto custom-scrollbar">
            <div
              className="grid min-w-fit"
              style={{
                gridTemplateColumns: `100px repeat(${range.length}, minmax(220px, 1fr))`,
              }}
            >
              <div className="h-12 bg-surface-container-low border-b border-outline-variant" />
              {range.map((d) => (
                <div
                  key={d.toISOString()}
                  className="h-12 bg-surface-container-low border-b border-s border-outline-variant flex flex-col items-center justify-center"
                >
                  <p className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                    {d.toLocaleDateString(localeTag, { weekday: 'short' })}
                  </p>
                  <p className="text-sm font-semibold text-on-surface">
                    {d.getDate()} {d.toLocaleDateString(localeTag, { month: 'short' })}
                  </p>
                </div>
              ))}

              {HOURS.map((hour) => (
                <Row
                  key={hour}
                  hour={hour}
                  range={range}
                  byDateHour={byDateHour}
                  formatDoctor={dr}
                  onClick={(a) => navigate(`/patients/${a.patient_id}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ hour, range, byDateHour, onClick, formatDoctor }) {
  const label = `${((hour + 11) % 12) + 1}:00 ${hour >= 12 ? 'PM' : 'AM'}`
  return (
    <>
      <div className="border-t border-outline-variant py-3 pe-3 text-end text-xs font-semibold text-outline tabular-nums">
        {label}
      </div>
      {range.map((d) => {
        const items = byDateHour.get(`${toIsoDate(d)}|${hour}`) || []
        return (
          <div
            key={`${d.toISOString()}-${hour}`}
            className="border-t border-s border-outline-variant p-2 min-h-[80px] space-y-2"
          >
            {items.map((a) => (
              <button
                key={a.id}
                onClick={() => onClick(a)}
                className="w-full text-start bg-secondary-container/40 hover:bg-secondary-container border border-secondary/20 rounded-lg p-2 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-on-surface tabular-nums">
                    {fmtTime(a.scheduled_time)}
                  </span>
                  <StatusBadge status={a.status} />
                </div>
                <p className="text-sm font-semibold text-on-surface truncate">
                  {a.patient_name || '—'}
                </p>
                <p className="text-xs text-on-surface-variant truncate">
                  {a.surgery_type || '—'}
                </p>
                {a.doctor_name && (
                  <p className="text-[11px] text-outline mt-1 truncate">
                    {formatDoctor(a.doctor_name)}
                  </p>
                )}
              </button>
            ))}
          </div>
        )
      })}
    </>
  )
}
