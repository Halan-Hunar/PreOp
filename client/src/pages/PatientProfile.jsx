import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPatient, assignDoctor } from '../api/patients'
import { createAssessment, listAssessments } from '../api/assessments'
import { listUsers } from '../api/users'
import Spinner from '../components/Spinner'
import StatusBadge, { asaVariant } from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'

function calcAge(dob) {
  if (!dob) return ''
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return ''
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

const BASE_TABS = [
  { id: 'overview', label: 'Overview', icon: 'person' },
  { id: 'appointments', label: 'Appointments', icon: 'event' },
]

const CLINICAL_TABS = [
  { id: 'assessments', label: 'Assessments', icon: 'assignment' },
  { id: 'clearances', label: 'Clearances', icon: 'verified' },
]

export default function PatientProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('overview')
  const [creating, setCreating] = useState(false)
  const [doctors, setDoctors] = useState([])
  const [doctorId, setDoctorId] = useState('')
  const [savingDoctor, setSavingDoctor] = useState(false)
  const [doctorMsg, setDoctorMsg] = useState('')

  // Only clinicians see assessment / clearance tabs.
  const canSeeClinical = hasRole('anaesthetist')
  const canAssignDoctor = hasRole('admin', 'receptionist')
  const tabs = canSeeClinical
    ? [BASE_TABS[0], ...CLINICAL_TABS, BASE_TABS[1]]
    : BASE_TABS

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await getPatient(id)
      setData(result)
      setDoctorId(result.patient?.assigned_doctor_id?.toString() || '')
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load patient')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!canAssignDoctor) return
    let cancelled = false
    listUsers({ role: 'anaesthetist', active: 'true' })
      .then((r) => {
        if (!cancelled) setDoctors(r.users || [])
      })
      .catch(() => {
        /* non-fatal — section will show empty list */
      })
    return () => {
      cancelled = true
    }
  }, [canAssignDoctor])

  const onAssignDoctor = async () => {
    if (!doctorId) return
    setSavingDoctor(true)
    setDoctorMsg('')
    try {
      await assignDoctor(id, parseInt(doctorId, 10))
      setDoctorMsg('Doctor assigned')
      await load()
      setTimeout(() => setDoctorMsg(''), 2500)
    } catch (e) {
      setDoctorMsg(e.response?.data?.error || 'Failed to assign')
    } finally {
      setSavingDoctor(false)
    }
  }

  const startAssessment = async () => {
    setCreating(true)
    try {
      // Reuse an existing draft for this patient instead of creating duplicates.
      const existing = await listAssessments({ patient_id: id, status: 'draft' })
      const draft = existing.assessments?.[0]
      if (draft) {
        navigate(`/assessments/${draft.id}`)
        return
      }

      const result = await createAssessment({
        patient_id: parseInt(id, 10),
        asa_classification: 'II',
      })
      navigate(`/assessments/${result.id}`)
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to create assessment')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={32} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-error-container text-on-error-container p-6 rounded-xl">
        {error || 'Patient not found'}
      </div>
    )
  }

  const { patient, appointments, assessments, clearances } = data
  const initials = (patient.full_name || '??')
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase()

  const latestAsa = assessments?.find((a) => a.asa_classification)?.asa_classification

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate('/patients')}
          className="text-sm text-on-surface-variant hover:text-secondary inline-flex items-center gap-1 mb-3"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            arrow_back
          </span>
          All patients
        </button>

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-xl">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-on-surface">{patient.full_name}</h1>
              <p className="text-sm text-on-surface-variant mt-1">
                DOB: {fmtDate(patient.dob)} ({calcAge(patient.dob)}y) • {patient.gender}
                {patient.national_id ? ` • ID ${patient.national_id}` : ''}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
            <div>
              <p className="text-xs font-semibold text-outline uppercase tracking-wider mb-1">
                Blood Type
              </p>
              <p className="font-semibold text-on-surface uppercase">
                {patient.blood_type === 'unknown' ? '—' : patient.blood_type || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-outline uppercase tracking-wider mb-1">
                Phone
              </p>
              <p className="font-semibold text-on-surface">{patient.phone || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-outline uppercase tracking-wider mb-1">
                Latest ASA
              </p>
              {latestAsa ? (
                <StatusBadge variant={asaVariant(latestAsa)} label={`ASA ${latestAsa}`} />
              ) : (
                <p className="font-semibold text-on-surface-variant">Not assessed</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-outline uppercase tracking-wider mb-1">
                Assigned Doctor
              </p>
              <p className="font-semibold text-on-surface">
                {patient.assigned_doctor_name || (
                  <span className="text-on-surface-variant font-normal">Unassigned</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-outline-variant overflow-x-auto custom-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? 'border-secondary text-secondary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center pr-2">
          {canSeeClinical && (
            <button
              onClick={startAssessment}
              disabled={creating}
              className="my-2 px-4 py-2 bg-secondary text-on-secondary rounded-lg font-semibold text-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {creating ? <Spinner size={16} /> : (
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_notes</span>
              )}
              New Assessment
            </button>
          )}
        </div>
      </div>

      {tab === 'overview' && canAssignDoctor && (
        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6">
          <h3 className="text-base font-semibold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">assignment_ind</span>
            Assign Doctor
          </h3>
          <p className="text-sm text-on-surface-variant mb-4">
            {patient.assigned_doctor_name
              ? `Currently assigned to ${patient.assigned_doctor_name}.`
              : 'No anaesthetist assigned yet.'}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
                Anaesthetist
              </label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
              >
                <option value="">Select an anaesthetist…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={onAssignDoctor}
              disabled={
                savingDoctor ||
                !doctorId ||
                doctorId === (patient.assigned_doctor_id?.toString() || '')
              }
              className="px-5 py-2.5 bg-secondary text-on-secondary rounded-lg font-semibold text-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {savingDoctor ? <Spinner size={16} /> : (
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
              )}
              Save
            </button>
            {doctorMsg && (
              <span className="text-xs text-on-secondary-container bg-secondary-container px-3 py-1 rounded-full">
                {doctorMsg}
              </span>
            )}
          </div>
        </section>
      )}

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-outline-variant p-6">
            <h3 className="text-base font-semibold text-on-surface mb-4">Contact & Address</h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-outline uppercase font-semibold mb-1">Email</dt>
                <dd className="text-on-surface">{patient.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-outline uppercase font-semibold mb-1">Phone</dt>
                <dd className="text-on-surface">{patient.phone || '—'}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-xs text-outline uppercase font-semibold mb-1">Address</dt>
                <dd className="text-on-surface whitespace-pre-line">{patient.address || '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6">
            <h3 className="text-base font-semibold text-on-surface mb-4">Emergency Contact</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-outline uppercase font-semibold mb-1">Name</dt>
                <dd className="text-on-surface">{patient.emergency_contact_name || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-outline uppercase font-semibold mb-1">Phone</dt>
                <dd className="text-on-surface">{patient.emergency_contact_phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-outline uppercase font-semibold mb-1">Relation</dt>
                <dd className="text-on-surface">{patient.emergency_contact_relation || '—'}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {tab === 'assessments' && (
        <ListCard
          items={assessments}
          empty="No assessments recorded."
          render={(a) => (
            <li
              key={a.id}
              onClick={() => navigate(`/assessments/${a.id}`)}
              className="px-6 py-4 flex items-center justify-between hover:bg-surface-container-low cursor-pointer transition-colors"
            >
              <div>
                <p className="font-semibold text-on-surface">
                  Assessment #{a.id}
                  {a.asa_classification ? ` • ASA ${a.asa_classification}` : ''}
                </p>
                <p className="text-xs text-on-surface-variant">
                  Created {fmtDate(a.created_at)}
                  {a.submitted_at ? ` • Submitted ${fmtDate(a.submitted_at)}` : ''}
                </p>
              </div>
              <StatusBadge status={a.status} />
            </li>
          )}
        />
      )}

      {tab === 'appointments' && (
        <ListCard
          items={appointments}
          empty="No appointments scheduled."
          render={(a) => (
            <li key={a.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-on-surface">{a.surgery_type || 'Procedure TBD'}</p>
                <p className="text-xs text-on-surface-variant">
                  {fmtDate(a.scheduled_date)} • {a.scheduled_time?.slice(0, 5)}
                  {a.doctor_name ? ` • ${a.doctor_name}` : ''}
                </p>
              </div>
              <StatusBadge status={a.status} />
            </li>
          )}
        />
      )}

      {tab === 'clearances' && (
        <ListCard
          items={clearances}
          empty="No clearance decisions yet."
          render={(c) => (
            <li key={c.id} className="px-6 py-4 flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="font-semibold text-on-surface capitalize">
                  {c.decision.replace('_', ' ')}
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Decided by {c.decided_by_name || 'Unknown'} on {fmtDate(c.decided_at)}
                </p>
                {c.conditions && (
                  <p className="text-sm text-on-surface-variant mt-2">
                    <span className="font-semibold">Conditions:</span> {c.conditions}
                  </p>
                )}
                {c.reason && (
                  <p className="text-sm text-on-surface-variant mt-1">
                    <span className="font-semibold">Reason:</span> {c.reason}
                  </p>
                )}
              </div>
              <StatusBadge status={c.decision} />
            </li>
          )}
        />
      )}
    </div>
  )
}

function ListCard({ items, empty, render }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
      {!items || items.length === 0 ? (
        <div className="p-12 text-center text-on-surface-variant">{empty}</div>
      ) : (
        <ul className="divide-y divide-outline-variant">{items.map(render)}</ul>
      )}
    </div>
  )
}
