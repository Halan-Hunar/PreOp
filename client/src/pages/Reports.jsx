import { useEffect, useMemo, useRef, useState } from 'react'
import { listPatients } from '../api/patients'
import { listAppointments } from '../api/appointments'
import { listAssessments } from '../api/assessments'
import { getAttendance, getAttendanceSummary } from '../api/attendance'
import StatCard from '../components/StatCard'
import Spinner from '../components/Spinner'
import ExportMenu from '../components/ExportMenu'
import {
  exportSheetsAsExcel,
  exportSheetsAsPdf,
  exportNodeAsImage,
  printNode,
} from '../utils/exportHelpers'
import { useLanguage } from '../context/LanguageContext'

const MONTH_KEYS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function pad(n) {
  return String(n).padStart(2, '0')
}

function monthRange(year, month) {
  const start = `${year}-${pad(month)}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${pad(month)}-${pad(lastDay)}`
  return { start, end }
}

function inMonth(value, year, month) {
  if (!value) return false
  const d = String(value).slice(0, 10)
  return d.startsWith(`${year}-${pad(month)}`)
}

function fmtHoursFromSeconds(seconds) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function hmsToSeconds(hms) {
  if (!hms) return 0
  const [h, m, s] = hms.split(':').map((p) => parseInt(p, 10) || 0)
  return h * 3600 + m * 60 + s
}

export default function Reports() {
  const { t, lang, formatName } = useLanguage()
  const reportRef = useRef(null)
  const localeTag = lang === 'ku' ? 'ku' : undefined
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState({
    patients: [],
    appointments: [],
    assessments: [],
    attendance: [],
    summary: [],
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')

      const [pat, app, ass, att, sum] = await Promise.all([
        listPatients({ limit: 500 }).catch(() => ({ patients: [] })),
        listAppointments({ limit: 500 }).catch(() => ({ appointments: [] })),
        listAssessments({ limit: 500 }).catch(() => ({ assessments: [] })),
        getAttendance({ month, year }).catch(() => ({ records: [] })),
        getAttendanceSummary({ month, year }).catch(() => ({ summary: [] })),
      ])

      if (cancelled) return
      setData({
        patients: pat.patients || [],
        appointments: app.appointments || [],
        assessments: ass.assessments || [],
        attendance: att.records || [],
        summary: sum.summary || [],
      })
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [month, year])

  const monthName = useMemo(
    () =>
      new Date(year, month - 1, 1).toLocaleDateString(localeTag, {
        month: 'long',
        year: 'numeric',
      }) || `${MONTH_KEYS[month - 1]} ${year}`,
    [month, year, localeTag]
  )
  const rangeLabel = monthName

  const stats = useMemo(() => {
    const monthAppts = data.appointments.filter((a) => inMonth(a.scheduled_date, year, month))
    const monthAssess = data.assessments.filter((a) => inMonth(a.created_at, year, month))

    const asaCounts = monthAssess.reduce((acc, a) => {
      const k = a.asa_classification || 'Unknown'
      acc[k] = (acc[k] || 0) + 1
      return acc
    }, {})

    return {
      patients: data.patients.length,
      monthAppts,
      monthAssess,
      asaCounts,
      cleared: monthAssess.filter((a) => a.status === 'approved').length,
      flagged: monthAssess.filter((a) => a.status === 'flagged').length,
      submitted: monthAssess.filter((a) => a.status === 'submitted').length,
    }
  }, [data, month, year])

  // Row builders — column headers reuse translated labels.
  const patientRows = () =>
    data.patients.map((p) => ({
      ID: p.id,
      [t('common.name')]: p.full_name,
      [t('newPatient.dob')]: p.dob ? String(p.dob).slice(0, 10) : '',
      [t('newPatient.gender')]: p.gender ? t(`gender.${p.gender}`) : '',
      [t('newPatient.bloodType')]: p.blood_type,
      [t('newPatient.nationalId')]: p.national_id || '',
      [t('newPatient.phone')]: p.phone || '',
      [t('common.email')]: p.email || '',
      [t('patientList.headerRegistered')]: p.created_at ? String(p.created_at).slice(0, 10) : '',
    }))

  const appointmentRows = () =>
    stats.monthAppts.map((a) => ({
      ID: a.id,
      [t('attendance.date')]: String(a.scheduled_date || '').slice(0, 10),
      [t('dashboard.time')]: (a.scheduled_time || '').slice(0, 5),
      [t('dashboard.patient')]: a.patient_name || '',
      [t('newPatient.nationalId')]: a.national_id || '',
      [t('dashboard.surgery')]: a.surgery_type || '',
      [t('dashboard.anaesthetist')]: a.doctor_name ? formatName(a.doctor_name, 'anaesthetist') : '',
      [t('common.status')]: a.status,
    }))

  const assessmentRows = () =>
    stats.monthAssess.map((a) => ({
      ID: a.id,
      [t('dashboard.patient')]: a.patient_name || '',
      ASA: a.asa_classification || '',
      [t('clearance.summary.plan')]: a.anaesthetic_plan || '',
      [t('common.status')]: a.status,
      Created: a.created_at ? String(a.created_at).slice(0, 10) : '',
      Submitted: a.submitted_at ? String(a.submitted_at).slice(0, 10) : '',
    }))

  const attendanceRows = () =>
    data.summary.map((s) => ({
      [t('reports.staff')]: formatName(s.staff_name, s.role),
      [t('common.role')]: s.role,
      [t('reports.daysPresent')]: s.days_present || 0,
      [t('reports.totalHours')]: s.total_hours || '00:00:00',
      [t('reports.avgPerDay')]: s.avg_hours_per_day
        ? Number(s.avg_hours_per_day).toFixed(2)
        : '0.00',
    }))

  const sheets = () => [
    { name: 'Patients', rows: patientRows() },
    { name: 'Appointments', rows: appointmentRows() },
    { name: 'Assessments', rows: assessmentRows() },
    { name: 'Staff Attendance', rows: attendanceRows() },
  ]
  const baseName = `PreOp_Report_${year}-${pad(month)}`

  const handleExportExcel = () => exportSheetsAsExcel(sheets(), `${baseName}.xlsx`)
  const handleExportPdf = () =>
    exportSheetsAsPdf(sheets(), {
      title: 'PreOp Clinical Suite',
      subtitle: `Monthly Report — ${MONTH_KEYS[month - 1]} ${year}`,
      filename: `${baseName}.pdf`,
    })
  const handleExportImage = () => exportNodeAsImage(reportRef.current, `${baseName}.png`)
  const handlePrint = () => printNode(reportRef.current)

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface tracking-tight">
            {t('reports.monthlyTitle', { label: rangeLabel })}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {monthRange(year, month).start} → {monthRange(year, month).end}
          </p>
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              {t('reports.month')}
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              className="px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
            >
              {MONTH_KEYS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {new Date(2000, i, 1).toLocaleDateString(localeTag, { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              {t('reports.year')}
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10) || now.getFullYear())}
              className="w-28 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
            />
          </div>
          <ExportMenu
            disabled={loading}
            options={[
              { id: 'pdf', onClick: handleExportPdf },
              { id: 'excel', onClick: handleExportExcel },
              { id: 'image', onClick: handleExportImage },
              { id: 'print', onClick: handlePrint },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size={32} />
        </div>
      ) : error ? (
        <div className="bg-error-container text-on-error-container p-6 rounded-xl">{error}</div>
      ) : (
        <div ref={reportRef} className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-on-surface mb-4">{t('reports.volume')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard label={t('reports.totalPatients')} value={stats.patients} icon="group" />
              <StatCard
                label={t('reports.appointments')}
                value={stats.monthAppts.length}
                icon="event"
              />
              <StatCard
                label={t('reports.assessments')}
                value={stats.monthAssess.length}
                icon="assignment"
              />
              <StatCard
                label={t('reports.cleared')}
                value={stats.cleared}
                icon="check_circle"
                iconColor="text-success"
                suffix={
                  stats.flagged
                    ? `${stats.flagged} ${t('reports.flagged').toLowerCase()}`
                    : undefined
                }
              />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-on-surface mb-4">
              {t('reports.asaDistribution')}
            </h2>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
              {stats.monthAssess.length === 0 ? (
                <p className="text-on-surface-variant text-center">
                  {t('reports.noAssessmentsMonth')}
                </p>
              ) : (
                <div className="space-y-3">
                  {['I', 'II', 'III', 'IV', 'V', 'VI'].map((k) => {
                    const count = stats.asaCounts[k] || 0
                    const total = stats.monthAssess.length || 1
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
                          <div className="h-full bg-secondary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-on-surface mb-4">
              {t('reports.staffAttendance')}
            </h2>
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              {data.summary.length === 0 ? (
                <div className="p-12 text-center text-on-surface-variant">
                  {t('reports.noAttendance')}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-surface-container-low border-b border-outline-variant text-xs uppercase tracking-wider text-on-surface-variant">
                    <tr>
                      <th className="px-6 py-4 text-start font-semibold">{t('reports.staff')}</th>
                      <th className="px-6 py-4 text-start font-semibold">{t('common.role')}</th>
                      <th className="px-6 py-4 text-end font-semibold">
                        {t('reports.daysPresent')}
                      </th>
                      <th className="px-6 py-4 text-end font-semibold">
                        {t('reports.totalHours')}
                      </th>
                      <th className="px-6 py-4 text-end font-semibold">
                        {t('reports.avgPerDay')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {data.summary.map((s) => (
                      <tr key={s.user_id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-6 py-4 font-semibold text-on-surface">
                          {formatName(s.staff_name, s.role)}
                        </td>
                        <td className="px-6 py-4 text-on-surface-variant">
                          {s.role ? t(`role.${s.role}`) : ''}
                        </td>
                        <td className="px-6 py-4 text-end tabular-nums">{s.days_present || 0}</td>
                        <td className="px-6 py-4 text-end tabular-nums">
                          {fmtHoursFromSeconds(hmsToSeconds(s.total_hours))}
                        </td>
                        <td className="px-6 py-4 text-end tabular-nums">
                          {s.avg_hours_per_day
                            ? `${Number(s.avg_hours_per_day).toFixed(2)}h`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
