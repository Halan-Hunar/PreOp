import { useEffect, useMemo, useState } from 'react'
import { listAssessments } from '../api/assessments'
import { listAppointments } from '../api/appointments'
import { listPatients } from '../api/patients'
import StatCard from '../components/StatCard'
import Spinner from '../components/Spinner'

function monthKey(d) {
  return new Date(d).toISOString().slice(0, 7)
}

export default function Reports() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState({ assessments: [], appointments: [], patients: 0 })
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [assess, appts, pats] = await Promise.all([
          listAssessments({ limit: 200 }),
          listAppointments({ limit: 200 }),
          listPatients({ limit: 1 }),
        ])
        if (cancelled) return
        setData({
          assessments: assess.assessments || [],
          appointments: appts.appointments || [],
          patients: pats.total || 0,
        })
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || 'Failed to load reports')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    const now = monthKey(new Date())
    const thisMonthAssess = data.assessments.filter((a) => monthKey(a.created_at) === now)
    const thisMonthAppts = data.appointments.filter((a) => monthKey(a.scheduled_date) === now)
    const cleared = data.assessments.filter((a) => a.status === 'approved').length
    const flagged = data.assessments.filter((a) => a.status === 'flagged').length

    const asaCounts = data.assessments.reduce((acc, a) => {
      const k = a.asa_classification || 'Unknown'
      acc[k] = (acc[k] || 0) + 1
      return acc
    }, {})

    return {
      monthAssess: thisMonthAssess.length,
      monthAppts: thisMonthAppts.length,
      cleared,
      flagged,
      asaCounts,
    }
  }, [data])

  const exportPdf = () => {
    setPrinting(true)
    setTimeout(() => {
      window.print()
      setPrinting(false)
    }, 50)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={32} />
      </div>
    )
  }

  if (error) {
    return <div className="bg-error-container text-on-error-container p-6 rounded-xl">{error}</div>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface tracking-tight">Reports</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Monthly summary and aggregate statistics
          </p>
        </div>
        <button
          onClick={exportPdf}
          disabled={printing}
          className="px-4 py-2.5 bg-secondary text-on-secondary rounded-lg font-semibold text-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>print</span>
          Export to PDF
        </button>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-on-surface mb-4">This Month</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard label="Total Patients" value={data.patients} icon="group" />
          <StatCard label="Appointments" value={stats.monthAppts} icon="event" />
          <StatCard label="Assessments" value={stats.monthAssess} icon="assignment" />
          <StatCard label="Cleared" value={stats.cleared} icon="check_circle" iconColor="text-success" />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-on-surface mb-4">ASA Distribution</h2>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          {Object.keys(stats.asaCounts).length === 0 ? (
            <p className="text-on-surface-variant text-center">No assessments yet.</p>
          ) : (
            <div className="space-y-3">
              {['I', 'II', 'III', 'IV', 'V', 'VI'].map((k) => {
                const count = stats.asaCounts[k] || 0
                const total = data.assessments.length || 1
                const pct = Math.round((count / total) * 100)
                return (
                  <div key={k}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-semibold text-on-surface">ASA {k}</span>
                      <span className="text-on-surface-variant tabular-nums">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                      <div
                        className="h-full bg-secondary rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-on-surface mb-4">Outcomes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Cleared" value={stats.cleared} icon="check_circle" iconColor="text-success" />
          <StatCard label="Flagged" value={stats.flagged} icon="flag" iconColor="text-error" />
          <StatCard
            label="In Review"
            value={data.assessments.filter((a) => a.status === 'submitted').length}
            icon="hourglass_empty"
            iconColor="text-warning"
          />
        </div>
      </section>
    </div>
  )
}
