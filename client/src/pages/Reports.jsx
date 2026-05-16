import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { listPatients } from '../api/patients'
import { listAppointments } from '../api/appointments'
import { listAssessments } from '../api/assessments'
import { getAttendance, getAttendanceSummary } from '../api/attendance'
import StatCard from '../components/StatCard'
import Spinner from '../components/Spinner'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function pad(n) {
  return String(n).padStart(2, '0')
}

function monthRange(year, month) {
  // month is 1-indexed
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

// "HH:MM:SS" -> total seconds
function hmsToSeconds(hms) {
  if (!hms) return 0
  const [h, m, s] = hms.split(':').map((p) => parseInt(p, 10) || 0)
  return h * 3600 + m * 60 + s
}

export default function Reports() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState('')
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
      try {
        const [pat, app, ass, att, sum] = await Promise.all([
          listPatients({ limit: 500 }),
          listAppointments({ limit: 500 }),
          listAssessments({ limit: 500 }),
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
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || 'Failed to load report data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [month, year])

  const rangeLabel = `${MONTHS[month - 1]} ${year}`

  const stats = useMemo(() => {
    const monthAppts = data.appointments.filter((a) =>
      inMonth(a.scheduled_date, year, month)
    )
    const monthAssess = data.assessments.filter((a) =>
      inMonth(a.created_at, year, month)
    )

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

  // --- Sheet row builders (shared by Excel + PDF) ---------------------------

  const patientRows = () =>
    data.patients.map((p) => ({
      ID: p.id,
      Name: p.full_name,
      DOB: p.dob ? String(p.dob).slice(0, 10) : '',
      Gender: p.gender,
      'Blood Type': p.blood_type,
      'National ID': p.national_id || '',
      Phone: p.phone || '',
      Email: p.email || '',
      Registered: p.created_at ? String(p.created_at).slice(0, 10) : '',
    }))

  const appointmentRows = () =>
    stats.monthAppts.map((a) => ({
      ID: a.id,
      Date: String(a.scheduled_date || '').slice(0, 10),
      Time: (a.scheduled_time || '').slice(0, 5),
      Patient: a.patient_name || '',
      'National ID': a.national_id || '',
      Procedure: a.surgery_type || '',
      Anaesthetist: a.doctor_name || '',
      Status: a.status,
    }))

  const assessmentRows = () =>
    stats.monthAssess.map((a) => ({
      ID: a.id,
      Patient: a.patient_name || '',
      ASA: a.asa_classification || '',
      Plan: a.anaesthetic_plan || '',
      Status: a.status,
      Created: a.created_at ? String(a.created_at).slice(0, 10) : '',
      Submitted: a.submitted_at ? String(a.submitted_at).slice(0, 10) : '',
    }))

  const attendanceRows = () =>
    data.summary.map((s) => ({
      Staff: s.staff_name || '',
      Role: s.role,
      'Days Present': s.days_present || 0,
      'Total Hours': s.total_hours || '00:00:00',
      'Avg Hours/Day': s.avg_hours_per_day
        ? Number(s.avg_hours_per_day).toFixed(2)
        : '0.00',
    }))

  // --- Excel export --------------------------------------------------------

  const exportExcel = () => {
    setExporting('excel')
    try {
      const wb = XLSX.utils.book_new()

      const addSheet = (name, rows) => {
        const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{}])
        XLSX.utils.book_append_sheet(wb, sheet, name)
      }

      addSheet('Patients', patientRows())
      addSheet('Appointments', appointmentRows())
      addSheet('Assessments', assessmentRows())
      addSheet('Staff Attendance', attendanceRows())

      const filename = `PreOp_Report_${year}-${pad(month)}.xlsx`
      XLSX.writeFile(wb, filename)
    } finally {
      setExporting('')
    }
  }

  // --- PDF export ----------------------------------------------------------

  const exportPdf = () => {
    setExporting('pdf')
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const marginX = 40
      const headerY = 40
      const bodyTop = 90 // y where the first section title sits

      const drawHeader = () => {
        doc.setFontSize(16)
        doc.setTextColor(11, 28, 48)
        doc.text('PreOp Clinical Suite', marginX, headerY)
        doc.setFontSize(11)
        doc.setTextColor(118, 119, 125)
        doc.text(`Monthly Report — ${rangeLabel}`, marginX, headerY + 18)
        const generated = `Generated ${new Date().toLocaleString()}`
        doc.text(
          generated,
          pageWidth - marginX - doc.getTextWidth(generated),
          headerY + 18
        )
      }

      drawHeader()

      let cursorY = bodyTop

      const drawSection = (title, rows) => {
        if (!rows.length) return

        // If the title would crowd the page bottom, start a fresh page.
        if (cursorY > pageHeight - 120) {
          doc.addPage()
          drawHeader()
          cursorY = bodyTop
        }

        doc.setFontSize(14)
        doc.setTextColor(11, 28, 48)
        doc.text(title, marginX, cursorY)

        const cols = Object.keys(rows[0])
        const body = rows.map((r) => cols.map((c) => (r[c] ?? '').toString()))

        autoTable(doc, {
          head: [cols],
          body,
          startY: cursorY + 10,
          margin: { left: marginX, right: marginX, bottom: 40 },
          styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
          headStyles: {
            fillColor: [0, 106, 97], // secondary teal
            textColor: 255,
            fontStyle: 'bold',
          },
          alternateRowStyles: { fillColor: [239, 244, 255] },
        })

        cursorY = (doc.lastAutoTable?.finalY || cursorY + 20) + 30
      }

      drawSection('Patients', patientRows())
      drawSection('Appointments', appointmentRows())
      drawSection('Assessments', assessmentRows())
      drawSection('Staff Attendance', attendanceRows())

      // Page numbers — drawn last so they sit on top of every page footer.
      const totalPages = doc.internal.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(9)
        doc.setTextColor(118, 119, 125)
        const label = `Page ${i} of ${totalPages}`
        doc.text(label, pageWidth - marginX - doc.getTextWidth(label), pageHeight - 20)
      }

      doc.save(`PreOp_Report_${year}-${pad(month)}.pdf`)
    } finally {
      setExporting('')
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface tracking-tight">
            Monthly Report — {rangeLabel}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {monthRange(year, month).start} → {monthRange(year, month).end}
          </p>
        </div>

        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              Month
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              className="px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              Year
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10) || now.getFullYear())}
              className="w-28 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
            />
          </div>
          <button
            onClick={exportExcel}
            disabled={loading || exporting === 'excel'}
            className="px-4 py-2.5 bg-surface-container-lowest border border-secondary text-secondary rounded-lg font-semibold text-sm hover:bg-secondary-container/40 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {exporting === 'excel' ? <Spinner size={16} /> : (
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>table_view</span>
            )}
            Excel
          </button>
          <button
            onClick={exportPdf}
            disabled={loading || exporting === 'pdf'}
            className="px-4 py-2.5 bg-secondary text-on-secondary rounded-lg font-semibold text-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
          >
            {exporting === 'pdf' ? <Spinner size={16} /> : (
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>picture_as_pdf</span>
            )}
            PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size={32} />
        </div>
      ) : error ? (
        <div className="bg-error-container text-on-error-container p-6 rounded-xl">{error}</div>
      ) : (
        <>
          <section>
            <h2 className="text-lg font-semibold text-on-surface mb-4">Volume</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard label="Total Patients" value={stats.patients} icon="group" />
              <StatCard label="Appointments" value={stats.monthAppts.length} icon="event" />
              <StatCard label="Assessments" value={stats.monthAssess.length} icon="assignment" />
              <StatCard
                label="Cleared"
                value={stats.cleared}
                icon="check_circle"
                iconColor="text-success"
                suffix={stats.flagged ? `${stats.flagged} flagged` : undefined}
              />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-on-surface mb-4">ASA Distribution</h2>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
              {stats.monthAssess.length === 0 ? (
                <p className="text-on-surface-variant text-center">No assessments this month.</p>
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
            <h2 className="text-lg font-semibold text-on-surface mb-4">Staff Attendance</h2>
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              {data.summary.length === 0 ? (
                <div className="p-12 text-center text-on-surface-variant">
                  No attendance data for this month.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-surface-container-low border-b border-outline-variant text-xs uppercase tracking-wider text-on-surface-variant">
                    <tr>
                      <th className="px-6 py-4 text-left font-semibold">Staff</th>
                      <th className="px-6 py-4 text-left font-semibold">Role</th>
                      <th className="px-6 py-4 text-right font-semibold">Days Present</th>
                      <th className="px-6 py-4 text-right font-semibold">Total Hours</th>
                      <th className="px-6 py-4 text-right font-semibold">Avg / Day</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {data.summary.map((s) => (
                      <tr key={s.user_id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-6 py-4 font-semibold text-on-surface">{s.staff_name}</td>
                        <td className="px-6 py-4 text-on-surface-variant capitalize">{s.role}</td>
                        <td className="px-6 py-4 text-right tabular-nums">{s.days_present || 0}</td>
                        <td className="px-6 py-4 text-right tabular-nums">
                          {fmtHoursFromSeconds(hmsToSeconds(s.total_hours))}
                        </td>
                        <td className="px-6 py-4 text-right tabular-nums">
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
        </>
      )}
    </div>
  )
}
