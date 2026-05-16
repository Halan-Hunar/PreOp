import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listPendingAssessments } from '../api/assessments'
import { listPatients } from '../api/patients'
import { getTodayAppointments } from '../api/appointments'

/**
 * Notifications are derived on the fly from existing endpoints — there's no
 * separate notifications table. Each role gets a different mix:
 *
 *   anaesthetist → assessments awaiting clearance (their own queue)
 *   receptionist → patients without an assigned doctor (action they own)
 *   admin        → both views, so they can triage
 *   nurse        → today's appointments at a glance
 *
 * Items are click-to-navigate; the bell shows a red dot when count > 0.
 */
export default function NotificationsBell() {
  const { user, hasRole } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClickAway = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [open])

  const load = async () => {
    setLoading(true)
    const collected = []

    try {
      if (hasRole('anaesthetist', 'admin')) {
        const r = await listPendingAssessments().catch(() => ({ assessments: [] }))
        ;(r.assessments || []).slice(0, 5).forEach((a) => {
          collected.push({
            id: `assessment-${a.id}`,
            icon: 'assignment',
            title: 'Awaiting clearance',
            body: `${a.patient_name || 'Patient'} — ASA ${a.asa_classification || '—'}`,
            to: `/assessments/${a.id}/clearance`,
          })
        })
      }

      if (hasRole('receptionist', 'admin')) {
        const r = await listPatients({ limit: 100 }).catch(() => ({ patients: [] }))
        ;(r.patients || [])
          .filter((p) => !p.assigned_doctor_id)
          .slice(0, 5)
          .forEach((p) => {
            collected.push({
              id: `unassigned-${p.id}`,
              icon: 'person_off',
              title: 'Unassigned patient',
              body: `${p.full_name} needs an anaesthetist`,
              to: `/patients/${p.id}`,
            })
          })
      }

      if (hasRole('nurse')) {
        const r = await getTodayAppointments().catch(() => ({ appointments: [] }))
        ;(r.appointments || [])
          .filter((a) => a.status === 'scheduled')
          .slice(0, 5)
          .forEach((a) => {
            collected.push({
              id: `appt-${a.id}`,
              icon: 'event',
              title: 'Scheduled today',
              body: `${a.patient_name || 'Patient'} — ${a.scheduled_time?.slice(0, 5)}`,
              to: `/patients/${a.patient_id}`,
            })
          })
      }
    } finally {
      setItems(collected)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    load()
    // refresh every 60s while mounted
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role])

  const hasUnread = items.length > 0

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => {
          setOpen((o) => !o)
          if (!open) load()
        }}
        className="relative p-2 text-on-surface-variant hover:text-secondary hover:bg-surface-container-high rounded-full transition-colors"
        aria-label="Notifications"
      >
        <span className="material-symbols-outlined">notifications</span>
        {hasUnread && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-error rounded-full ring-2 ring-surface" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
            <p className="text-sm font-semibold text-on-surface">Notifications</p>
            <span className="text-xs text-on-surface-variant">
              {items.length} item{items.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="px-4 py-8 text-center text-on-surface-variant text-sm">
                Loading…
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-on-surface-variant text-sm">
                You're all caught up.
              </div>
            ) : (
              <ul className="divide-y divide-outline-variant">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => {
                        setOpen(false)
                        navigate(n.to)
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors flex items-start gap-3"
                    >
                      <span className="material-symbols-outlined text-secondary mt-0.5" style={{ fontSize: 20 }}>
                        {n.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-on-surface truncate">
                          {n.title}
                        </p>
                        <p className="text-xs text-on-surface-variant truncate">{n.body}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
