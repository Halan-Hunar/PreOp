import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTodayAppointments } from '../api/appointments'
import { listPendingAssessments } from '../api/assessments'
import StatCard from '../components/StatCard'
import StatusBadge, { asaVariant } from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import { useAuth } from '../context/AuthContext'

function formatTime(t) {
  if (!t) return '—'
  // backend returns HH:MM:SS
  const [h, m] = t.split(':')
  const hh = parseInt(h, 10)
  const period = hh >= 12 ? 'PM' : 'AM'
  const display = ((hh + 11) % 12) + 1
  return `${display}:${m} ${period}`
}

function todayDateLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function Dashboard() {
  const { user, hasRole } = useAuth()
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState([])
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const promises = [getTodayAppointments()]
        if (hasRole('anaesthetist', 'admin')) {
          promises.push(listPendingAssessments())
        }
        const results = await Promise.all(promises)
        if (cancelled) return
        setAppointments(results[0].appointments || [])
        if (results[1]) setPending(results[1].assessments || [])
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || 'Failed to load dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [hasRole])

  const total = appointments.length
  const completed = appointments.filter((a) => a.status === 'completed').length
  const cancelled = appointments.filter((a) => a.status === 'cancelled' || a.status === 'no_show').length
  const scheduled = appointments.filter((a) => a.status === 'scheduled' || a.status === 'in_progress').length

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface tracking-tight">
            Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">{todayDateLabel()}</p>
        </div>
      </div>

      <section>
        <h2 className="text-xl font-semibold text-on-surface mb-4">Day at a Glance</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            label="Today's Appointments"
            value={total}
            icon="event"
            suffix={`${scheduled} active`}
          />
          <StatCard
            label="Pending Assessments"
            value={pending.length}
            icon="hourglass_empty"
            iconColor="text-warning"
            footer="Awaiting clearance review"
          />
          <StatCard
            label="Completed Today"
            value={completed}
            icon="check_circle"
            iconColor="text-success"
            suffix={cancelled ? `${cancelled} cancelled` : undefined}
          />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-on-surface">Today's Schedule</h2>
          <button
            onClick={() => navigate('/appointments')}
            className="text-sm text-secondary font-semibold hover:underline"
          >
            View full schedule →
          </button>
        </div>

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <Spinner size={28} />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-on-error-container bg-error-container">{error}</div>
          ) : appointments.length === 0 ? (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-outline-variant" style={{ fontSize: 48 }}>
                event_busy
              </span>
              <p className="text-on-surface-variant mt-2">No appointments scheduled for today.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4">Patient</th>
                    <th className="px-6 py-4">Surgery</th>
                    <th className="px-6 py-4">Anaesthetist</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-sm">
                  {appointments.map((a) => (
                    <tr
                      key={a.id}
                      className="hover:bg-surface-container-low transition-colors cursor-pointer group"
                      onClick={() => navigate(`/patients/${a.patient_id}`)}
                    >
                      <td className="px-6 py-4 font-semibold text-on-surface tabular-nums">
                        {formatTime(a.scheduled_time)}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-on-surface">{a.patient_name || '—'}</p>
                        <p className="text-xs text-on-surface-variant">ID: {a.national_id || '—'}</p>
                      </td>
                      <td className="px-6 py-4 text-on-surface">{a.surgery_type || '—'}</td>
                      <td className="px-6 py-4 text-on-surface-variant">{a.doctor_name || '—'}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="material-symbols-outlined text-outline-variant group-hover:text-secondary">
                          chevron_right
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {hasRole('anaesthetist', 'admin') && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-on-surface">Pending Assessments</h2>
            <span className="text-sm text-on-surface-variant">{pending.length} submitted</span>
          </div>
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            {pending.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant">
                No assessments awaiting review.
              </div>
            ) : (
              <ul className="divide-y divide-outline-variant">
                {pending.map((a) => (
                  <li
                    key={a.id}
                    onClick={() => navigate(`/assessments/${a.id}/clearance`)}
                    className="px-6 py-4 flex items-center justify-between hover:bg-surface-container-low cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-sm font-semibold">
                        {(a.patient_name || '??').split(' ').slice(0, 2).map((s) => s[0]).join('')}
                      </div>
                      <div>
                        <p className="font-semibold text-on-surface">{a.patient_name}</p>
                        <p className="text-xs text-on-surface-variant">
                          {a.surgery_type || 'Procedure TBD'}
                          {a.scheduled_date ? ` • ${new Date(a.scheduled_date).toLocaleDateString()}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {a.asa_classification && (
                        <StatusBadge
                          variant={asaVariant(a.asa_classification)}
                          label={`ASA ${a.asa_classification}`}
                        />
                      )}
                      <StatusBadge status={a.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
