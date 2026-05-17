import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getAssessment,
  updateAssessment,
  submitAssessment,
  deleteAssessment,
} from '../api/assessments'
import Spinner from '../components/Spinner'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import ExportMenu from '../components/ExportMenu'
import AssessmentPrintForm from '../components/AssessmentPrintForm'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import {
  exportNodeAsImage,
  exportNodeAsPdf,
  exportSheetsAsExcel,
  printNode,
} from '../utils/exportHelpers'

/* ─────────────────────────────────────────────────────────────────────────
 * Form data model
 *
 * `formData` mirrors the paper form 1:1. On save we split it into:
 *   - Flat columns the backend already understands (vitals, ASA, mallampati…)
 *   - Everything else (medicines list, family-history table, fasting times,
 *     etc.) packed into a single JSON blob inside `special_notes`.
 *
 * On load we parse `special_notes` back out into `formData.extra`.
 *
 * NOTE: this is a transitional storage strategy. The clean fix is an
 * `extra_data JSON` column on the `assessments` table. See README in the
 * commit message for the suggested migration.
 * ─────────────────────────────────────────────────────────────────────── */

const blankExtra = () => ({
  // Header
  proposed_surgery: '',
  side: '',
  age: '',

  // Section 1
  previous_anaesthetics: Array.from({ length: 8 }, () => ({
    procedure: '',
    type: '',
    ga: false,
    ra: false,
    la: false,
  })),
  ponv: false,
  delayed_recovery: false,
  prev_details: '',
  last_anaesthesia_before: '',
  respiratory_distress: false,
  plph: false,
  complications_other: '',

  // Section 2
  family_history: {
    father: { type: '', complications: '' },
    mother: { type: '', complications: '' },
    brothers: { type: '', complications: '' },
    sisters: { type: '', complications: '' },
  },

  // Section 3
  medical_history: {
    hypertension: { regular_rx: false, duration: '', notes: '' },
    ihd: { regular_rx: false, duration: '', notes: '' },
    thyroid: { regular_rx: false, duration: '', notes: '' },
    bleeding: { regular_rx: false, duration: '', notes: '' },
    other_disease: { regular_rx: false, duration: '', notes: '' },
  },
  blood_transfusion: false,
  pregnancy: false,
  trimester: '',
  pregnancy_regular: true,
  lactation: false,
  lactation_duration: '',
  ocp: false,

  // Section 4
  medicines: Array.from({ length: 8 }, () => ({
    name: '',
    dose: '',
    frequency: '',
    action: '',
  })),

  // Section 5
  hyper_food: '',
  hyper_blood: '',

  // Section 6
  tobacco_used: false,
  tobacco_type: '',
  tobacco_amount: '',
  tobacco_duration: '',
  tobacco_status: '',
  tobacco_quit_years: '',
  tobacco_recommendation: '',
  alcohol_used: false,
  alcohol_type: '',
  alcohol_amount: '',
  alcohol_duration: '',
  alcohol_status: '',
  alcohol_recommendation: '',

  // Section 7
  neck_goiter: '',
  hr_rhythm: 'regular',
  abdomen: '',
  exam_others: '',
  echo_ef: '',
  ecg_findings: '',
  heart_conclusion: '',
  heart_recommendations: '',

  // Section 8
  bun: '',
  s_creatinine: '',
  b_glucose: '',
  k_plus: '',
  ca_plus: '',
  pt: '',
  ptt: '',
  inr: '',
  ast: '',
  alt: '',
  alp: '',
  hbv: '',
  hcv: '',
  hiv: '',
  t3: '',
  t4: '',
  tsh: '',
  free_t3: '',
  dentures: 'none',

  // Section 10
  fast_food: '',
  fast_clear_fluid: '',
  fast_breast_milk: '',
  fast_bottle_milk: '',
  score: '',
  consent_by: '',
})

function calcAge(dob) {
  if (!dob) return ''
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return ''
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
}

function calcBmi(w, h) {
  const W = Number(w)
  const H = Number(h)
  if (!W || !H || W <= 0 || H <= 0) return ''
  const m = H / 100
  return (W / (m * m)).toFixed(1)
}

function bmiBracket(bmi, t) {
  const v = Number(bmi)
  if (!v) return { key: '', label: '', color: '' }
  if (v < 18.5) return { key: 'under', label: t('bmi.underweight'), color: 'text-blue-500' }
  if (v < 25) return { key: 'healthy', label: t('bmi.healthy'), color: 'text-success' }
  if (v < 30) return { key: 'over', label: t('bmi.overweight'), color: 'text-warning' }
  if (v < 35) return { key: 'ob1', label: t('bmi.obese1'), color: 'text-warning' }
  if (v < 40) return { key: 'ob2', label: t('bmi.obese2'), color: 'text-error' }
  return { key: 'ob3', label: t('bmi.obese3'), color: 'text-error' }
}

// Animated count-up for the BMI number — uses rAF, settles in ~600ms.
function useCountUp(target) {
  const [value, setValue] = useState(0)
  const fromRef = useRef(0)
  useEffect(() => {
    const end = Number(target) || 0
    const start = fromRef.current
    const duration = 600
    const t0 = performance.now()
    let raf
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3)
      const v = start + (end - start) * eased
      setValue(v)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = end
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return value
}

/* ─────────────────────────────────────────────────────────────────────────
 * Small UI primitives used inside the form.
 * ─────────────────────────────────────────────────────────────────────── */

const inputCls =
  'w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all'

function Field({ label, children, full }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
        {label}
      </label>
      {children}
    </div>
  )
}

function CheckboxRow({ label, checked, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-on-surface cursor-pointer select-none">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-secondary w-4 h-4"
      />
      {label}
    </label>
  )
}

function RadioRow({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((o) => (
        <label key={o.value} className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="accent-secondary"
          />
          {o.label}
        </label>
      ))}
    </div>
  )
}

function CollapsibleSection({ icon, title, defaultOpen = true, complete, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-6 py-4 bg-surface-container-low border-b border-outline-variant flex items-center gap-3 hover:bg-surface-container transition-colors"
      >
        <span className="material-symbols-outlined text-secondary">{icon}</span>
        <h2 className="text-base font-semibold text-on-surface flex-1 text-start">{title}</h2>
        {complete && (
          <span
            className="material-symbols-outlined text-success"
            style={{ fontSize: 20 }}
            aria-label="complete"
          >
            check_circle
          </span>
        )}
        <span
          className="material-symbols-outlined text-on-surface-variant transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          expand_more
        </span>
      </button>
      {open && <div className="p-6 anim-section-content">{children}</div>}
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Main page
 * ─────────────────────────────────────────────────────────────────────── */

const DRAFT_KEY_PREFIX = 'preop_assessment_draft_'

export default function AssessmentForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()
  const { t, lang } = useLanguage()
  const localeTag = lang === 'ku' ? 'ku' : undefined

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [assessment, setAssessment] = useState(null)
  const [formData, setFormData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const printRef = useRef(null)

  const draftKey = `${DRAFT_KEY_PREFIX}${id}`

  // Load assessment + restore draft if newer.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const r = await getAssessment(id)
        if (cancelled) return
        setAssessment(r.assessment)

        // Parse the JSON-encoded extras out of `special_notes`, falling back
        // to a fresh blank if it's not JSON (older records).
        const extra = (() => {
          if (!r.assessment.special_notes) return blankExtra()
          try {
            const parsed = JSON.parse(r.assessment.special_notes)
            if (parsed && typeof parsed === 'object' && parsed.__extra) {
              return { ...blankExtra(), ...parsed }
            }
          } catch {
            /* not JSON — old free-text note */
          }
          return blankExtra()
        })()

        const initial = { ...r.assessment, extra }

        // If localStorage has a fresher draft, ask the user whether to load it.
        // Simple heuristic: if a draft exists at all, prefer it (assessment is
        // still in-progress) — but only when it's newer than the server copy.
        try {
          const raw = localStorage.getItem(draftKey)
          if (raw) {
            const draft = JSON.parse(raw)
            if (draft && draft.savedAt && (!r.assessment.submitted_at ||
              new Date(draft.savedAt) > new Date(r.assessment.submitted_at))) {
              setFormData({ ...initial, ...draft.data, extra: { ...initial.extra, ...draft.data.extra } })
              setSavedMsg(t('form.draftRestored'))
              setTimeout(() => setSavedMsg(''), 2500)
              return
            }
          }
        } catch {
          /* ignore corrupt draft */
        }

        setFormData(initial)
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
  }, [id, draftKey, t])

  // Autosave: persist to localStorage on every change and on a 30s interval.
  useEffect(() => {
    if (!formData) return
    const payload = JSON.stringify({ savedAt: new Date().toISOString(), data: formData })
    try {
      localStorage.setItem(draftKey, payload)
    } catch {
      /* quota — give up silently */
    }
  }, [formData, draftKey])

  // BMI is derived from current form values.
  const liveBmi = useMemo(
    () => calcBmi(formData?.weight_kg, formData?.height_cm),
    [formData?.weight_kg, formData?.height_cm]
  )
  const bracket = useMemo(() => bmiBracket(liveBmi, t), [liveBmi, t])
  const bmiAnimated = useCountUp(liveBmi)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={32} />
      </div>
    )
  }
  if (!formData) {
    return (
      <div className="bg-error-container text-on-error-container p-6 rounded-xl">
        {error || t('assessment.notFound')}
      </div>
    )
  }

  /* ── State update helpers ─────────────────────────────────────── */
  const set = (path, value) => {
    setFormData((prev) => setIn(prev, path, value))
  }
  const setExtra = (key, value) => set(['extra', key], value)

  /* ── Submit / save ────────────────────────────────────────────── */
  const buildPayload = () => {
    const f = formData
    // Map known flat columns; everything else lives in `extra` and is
    // serialised into `special_notes` so the existing backend persists it.
    const flat = {
      weight_kg: numOrNull(f.weight_kg),
      height_cm: numOrNull(f.height_cm),
      blood_pressure_systolic: numOrNull(f.blood_pressure_systolic),
      blood_pressure_diastolic: numOrNull(f.blood_pressure_diastolic),
      heart_rate: numOrNull(f.heart_rate),
      respiratory_rate: numOrNull(f.respiratory_rate),
      oxygen_saturation: numOrNull(f.oxygen_saturation),
      temperature_celsius: numOrNull(f.temperature_celsius),
      chief_complaint: f.chief_complaint || null,
      current_medications: f.current_medications || null,
      drug_allergies: f.drug_allergies || null,
      cardiovascular_status: f.cardiovascular_status || null,
      respiratory_status: f.respiratory_status || null,
      mallampati_score: f.mallampati_score || null,
      asa_classification: f.asa_classification || 'II',
      asa_justification: f.asa_justification || null,
      anaesthetic_plan: f.anaesthetic_plan || null,
      anaesthetic_plan_details: f.anaesthetic_plan_details || null,
      risk_notes: f.risk_notes || null,
      // Pack the structured extras into special_notes as JSON with a marker.
      special_notes: JSON.stringify({ __extra: 1, ...f.extra }),
    }
    return Object.fromEntries(Object.entries(flat).filter(([, v]) => v !== null && v !== undefined && v !== ''))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await updateAssessment(id, buildPayload())
      setSavedMsg(t('assessment.draftSaved'))
      setTimeout(() => setSavedMsg(''), 2500)
    } catch (e) {
      setError(e.response?.data?.error || t('common.failedSave'))
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    setSubmitting(true)
    setError('')
    try {
      await updateAssessment(id, buildPayload())
      await submitAssessment(id)
      // Clear the draft once submitted.
      try {
        localStorage.removeItem(draftKey)
      } catch {
        /* ignore */
      }
      navigate(`/assessments/${id}/clearance`)
    } catch (err) {
      setError(err.response?.data?.error || t('assessment.failedSubmit'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      await deleteAssessment(id)
      try {
        localStorage.removeItem(draftKey)
      } catch {
        /* ignore */
      }
      navigate(`/patients/${assessment.patient_id}`)
    } catch (e) {
      setError(e.response?.data?.error || t('assessment.failedDelete'))
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  /* ── Export handlers ──────────────────────────────────────────── */
  const filenameBase = `Assessment_${id}_${(assessment?.patient_name || 'patient').replace(/\s+/g, '_')}`
  const exportData = { ...assessment, ...formData, extra: formData.extra }

  const handleExportPdf = async () => exportNodeAsPdf(printRef.current, `${filenameBase}.pdf`)
  const handleExportImage = async () => exportNodeAsImage(printRef.current, `${filenameBase}.png`)
  const handlePrint = () => printNode(printRef.current)
  const handleExportExcel = async () => {
    const flat = {}
    Object.entries(formData).forEach(([k, v]) => {
      if (k === 'extra') return
      flat[k] = typeof v === 'object' && v !== null ? JSON.stringify(v) : v
    })
    Object.entries(formData.extra || {}).forEach(([k, v]) => {
      flat[`extra.${k}`] = typeof v === 'object' && v !== null ? JSON.stringify(v) : v
    })
    exportSheetsAsExcel(
      [{ name: 'Assessment', rows: [flat] }],
      `${filenameBase}.xlsx`
    )
  }

  const canModify =
    hasRole('admin') || (hasRole('anaesthetist') && assessment.created_by === user?.id)
  const isDraft = assessment.status === 'draft'
  const isApproved = assessment.status === 'approved'

  /* ── Section completion heuristics for the green checkmark ─────── */
  const sectionComplete = {
    s7:
      !!formData.heart_rate &&
      !!formData.blood_pressure_systolic &&
      !!formData.oxygen_saturation,
    s9: !!formData.asa_classification,
  }

  return (
    <>
      {/* Off-screen paper-replica used by Export image/pdf/print. */}
      <AssessmentPrintForm ref={printRef} data={exportData} />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-6xl mx-auto">
        {/* ─── Page header ───────────────────────────────────────── */}
        <div className="flex items-start justify-between flex-wrap gap-4 anim-pop-in">
          <div>
            <button
              type="button"
              onClick={() => navigate(`/patients/${assessment.patient_id}`)}
              className="text-sm text-on-surface-variant hover:text-secondary inline-flex items-center gap-1 mb-3"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                arrow_back
              </span>
              {t('assessment.backToPatient')}
            </button>
            <h1 className="text-3xl font-bold text-on-surface tracking-tight">{t('form.title')}</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              {t('assessment.subtitle', {
                name: assessment.patient_name || '',
                id: assessment.id,
              })}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={assessment.status} />
            {savedMsg && (
              <span className="text-xs text-on-success-container bg-success-container px-3 py-1 rounded-full anim-pop-in">
                {savedMsg}
              </span>
            )}
            <ExportMenu
              label={t('export.assessment')}
              options={[
                { id: 'pdf', onClick: handleExportPdf },
                { id: 'excel', onClick: handleExportExcel },
                { id: 'image', onClick: handleExportImage },
                { id: 'print', onClick: handlePrint },
              ]}
            />
          </div>
        </div>

        {/* ─── Header strip (Name / Age / Gender / Weight / Height / BMI / Surgery / Side) ─── */}
        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6 anim-pop-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label={t('form.name')}>
              <input
                value={assessment.patient_name || ''}
                disabled
                className={`${inputCls} opacity-75`}
              />
            </Field>
            <Field label={t('form.age')}>
              <input
                value={
                  calcAge(assessment.dob) !== ''
                    ? t('patientProfile.yearsOld', { age: calcAge(assessment.dob) })
                    : ''
                }
                disabled
                className={`${inputCls} opacity-75`}
              />
            </Field>
            <Field label={t('form.gender')}>
              <input
                value={assessment.gender ? t(`gender.${assessment.gender}`) : ''}
                disabled
                className={`${inputCls} opacity-75`}
              />
            </Field>
            <Field label={t('form.date')}>
              <input
                value={new Date().toLocaleDateString(localeTag, {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
                disabled
                className={`${inputCls} opacity-75`}
              />
            </Field>
            <Field label={t('form.weight') + ' (kg)'}>
              <input
                type="number"
                step="0.1"
                value={formData.weight_kg ?? ''}
                onChange={(e) => set(['weight_kg'], e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={t('form.height') + ' (cm)'}>
              <input
                type="number"
                step="0.1"
                value={formData.height_cm ?? ''}
                onChange={(e) => set(['height_cm'], e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={t('form.bmi')}>
              <div className="px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm flex items-baseline gap-2 min-h-[42px]">
                <span className="font-semibold text-on-surface tabular-nums text-base">
                  {liveBmi ? bmiAnimated.toFixed(1) : '—'}
                </span>
                {bracket.label && (
                  <span className={`text-xs font-semibold ${bracket.color}`}>
                    {bracket.label}
                  </span>
                )}
              </div>
            </Field>
            <Field label={t('form.sideOperated')}>
              <RadioRow
                value={formData.extra.side}
                onChange={(v) => setExtra('side', v)}
                options={[
                  { value: 'R', label: t('form.side.r') },
                  { value: 'L', label: t('form.side.l') },
                  { value: 'NA', label: t('form.side.na') },
                ]}
              />
            </Field>
            <Field label={t('form.proposedSurgery')} full>
              <input
                value={formData.extra.proposed_surgery}
                onChange={(e) => setExtra('proposed_surgery', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </section>

        {/* ─── Section 1: Previous Anesthetics ─── */}
        <CollapsibleSection icon="history" title={`${t('form.section1')} ${t('form.section1.hint')}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-on-surface-variant">
                <tr>
                  <th className="px-2 py-2 text-start">#</th>
                  <th className="px-2 py-2 text-start">{t('form.prevAnaesth.procedure')}</th>
                  <th className="px-2 py-2 text-start">{t('form.prevAnaesth.type')}</th>
                  <th className="px-2 py-2">GA</th>
                  <th className="px-2 py-2">RA</th>
                  <th className="px-2 py-2">LA</th>
                </tr>
              </thead>
              <tbody>
                {formData.extra.previous_anaesthetics.map((row, i) => (
                  <tr key={i} className="border-t border-outline-variant">
                    <td className="px-2 py-1 text-on-surface-variant">{i + 1}</td>
                    <td className="px-2 py-1">
                      <input
                        value={row.procedure}
                        onChange={(e) =>
                          setExtra(
                            'previous_anaesthetics',
                            formData.extra.previous_anaesthetics.map((r, idx) =>
                              idx === i ? { ...r, procedure: e.target.value } : r
                            )
                          )
                        }
                        className={inputCls}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        value={row.type}
                        onChange={(e) =>
                          setExtra(
                            'previous_anaesthetics',
                            formData.extra.previous_anaesthetics.map((r, idx) =>
                              idx === i ? { ...r, type: e.target.value } : r
                            )
                          )
                        }
                        className={inputCls}
                      />
                    </td>
                    {['ga', 'ra', 'la'].map((k) => (
                      <td key={k} className="px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={!!row[k]}
                          onChange={(e) =>
                            setExtra(
                              'previous_anaesthetics',
                              formData.extra.previous_anaesthetics.map((r, idx) =>
                                idx === i ? { ...r, [k]: e.target.checked } : r
                              )
                            )
                          }
                          className="accent-secondary w-4 h-4"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <CheckboxRow
              label={t('form.ponv')}
              checked={formData.extra.ponv}
              onChange={(v) => setExtra('ponv', v)}
            />
            <CheckboxRow
              label={t('form.delayedRecovery')}
              checked={formData.extra.delayed_recovery}
              onChange={(v) => setExtra('delayed_recovery', v)}
            />
            <Field label={t('form.lastAnaesthesiaBefore')}>
              <input
                value={formData.extra.last_anaesthesia_before}
                onChange={(e) => setExtra('last_anaesthesia_before', e.target.value)}
                className={inputCls}
                placeholder="e.g. 1980"
              />
            </Field>
            <Field label={t('form.details')} full>
              <input
                value={formData.extra.prev_details}
                onChange={(e) => setExtra('prev_details', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              {t('form.commonComplications')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <CheckboxRow
                label={t('form.respiratoryDistress')}
                checked={formData.extra.respiratory_distress}
                onChange={(v) => setExtra('respiratory_distress', v)}
              />
              <CheckboxRow
                label={t('form.plph')}
                checked={formData.extra.plph}
                onChange={(v) => setExtra('plph', v)}
              />
              <Field label={t('form.others')}>
                <input
                  value={formData.extra.complications_other}
                  onChange={(e) => setExtra('complications_other', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        </CollapsibleSection>

        {/* ─── Section 2: Family History of Anesthesia ─── */}
        <CollapsibleSection icon="family_restroom" title={t('form.section2')}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-on-surface-variant">
                <tr>
                  <th className="px-2 py-2 text-start">{t('form.familyMember')}</th>
                  <th className="px-2 py-2 text-start">{t('form.familyType')}</th>
                  <th className="px-2 py-2 text-start">{t('form.familyComplications')}</th>
                </tr>
              </thead>
              <tbody>
                {['father', 'mother', 'brothers', 'sisters'].map((m) => (
                  <tr key={m} className="border-t border-outline-variant">
                    <td className="px-2 py-2 font-medium">{t(`form.family.${m}`)}</td>
                    <td className="px-2 py-1">
                      <input
                        value={formData.extra.family_history[m].type}
                        onChange={(e) =>
                          setExtra('family_history', {
                            ...formData.extra.family_history,
                            [m]: { ...formData.extra.family_history[m], type: e.target.value },
                          })
                        }
                        className={inputCls}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        value={formData.extra.family_history[m].complications}
                        onChange={(e) =>
                          setExtra('family_history', {
                            ...formData.extra.family_history,
                            [m]: {
                              ...formData.extra.family_history[m],
                              complications: e.target.value,
                            },
                          })
                        }
                        className={inputCls}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>

        {/* ─── Section 3: Medical History ─── */}
        <CollapsibleSection icon="health_and_safety" title={t('form.section3')}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-on-surface-variant">
                <tr>
                  <th className="px-2 py-2 text-start">{t('form.history.disease')}</th>
                  <th className="px-2 py-2 text-center">{t('form.history.regularRx')}</th>
                  <th className="px-2 py-2 text-start">{t('form.history.duration')}</th>
                  <th className="px-2 py-2 text-start">Notes</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['hypertension', t('form.history.hypertension')],
                  ['ihd', t('form.history.ihd')],
                  ['thyroid', t('form.history.thyroid')],
                  ['bleeding', t('form.history.bleeding')],
                  ['other_disease', t('form.others')],
                ].map(([k, label]) => (
                  <tr key={k} className="border-t border-outline-variant">
                    <td className="px-2 py-2 font-medium">{label}</td>
                    <td className="px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={!!formData.extra.medical_history[k].regular_rx}
                        onChange={(e) =>
                          setExtra('medical_history', {
                            ...formData.extra.medical_history,
                            [k]: {
                              ...formData.extra.medical_history[k],
                              regular_rx: e.target.checked,
                            },
                          })
                        }
                        className="accent-secondary w-4 h-4"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        value={formData.extra.medical_history[k].duration}
                        onChange={(e) =>
                          setExtra('medical_history', {
                            ...formData.extra.medical_history,
                            [k]: {
                              ...formData.extra.medical_history[k],
                              duration: e.target.value,
                            },
                          })
                        }
                        className={inputCls}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        value={formData.extra.medical_history[k].notes}
                        onChange={(e) =>
                          setExtra('medical_history', {
                            ...formData.extra.medical_history,
                            [k]: {
                              ...formData.extra.medical_history[k],
                              notes: e.target.value,
                            },
                          })
                        }
                        className={inputCls}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <CheckboxRow
              label={t('form.history.bloodTransfusion')}
              checked={formData.extra.blood_transfusion}
              onChange={(v) => setExtra('blood_transfusion', v)}
            />
            <CheckboxRow
              label={t('form.history.pregnancy')}
              checked={formData.extra.pregnancy}
              onChange={(v) => setExtra('pregnancy', v)}
            />
            <CheckboxRow
              label={t('form.history.lactation')}
              checked={formData.extra.lactation}
              onChange={(v) => setExtra('lactation', v)}
            />
            <CheckboxRow
              label={t('form.history.ocp')}
              checked={formData.extra.ocp}
              onChange={(v) => setExtra('ocp', v)}
            />
            {formData.extra.pregnancy && (
              <>
                <Field label={t('form.history.trimester')}>
                  <select
                    value={formData.extra.trimester}
                    onChange={(e) => setExtra('trimester', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">—</option>
                    <option value="1st">1st</option>
                    <option value="2nd">2nd</option>
                    <option value="3rd">3rd</option>
                  </select>
                </Field>
                <Field label={t('form.history.regular')}>
                  <RadioRow
                    value={formData.extra.pregnancy_regular ? 'r' : 'i'}
                    onChange={(v) => setExtra('pregnancy_regular', v === 'r')}
                    options={[
                      { value: 'r', label: t('form.history.regular') },
                      { value: 'i', label: t('form.history.irregular') },
                    ]}
                  />
                </Field>
              </>
            )}
            {formData.extra.lactation && (
              <Field label={t('form.history.duration')}>
                <input
                  value={formData.extra.lactation_duration}
                  onChange={(e) => setExtra('lactation_duration', e.target.value)}
                  className={inputCls}
                />
              </Field>
            )}
          </div>
        </CollapsibleSection>

        {/* ─── Section 4: Medicines & Regimens ─── */}
        <CollapsibleSection icon="medication" title={t('form.section4')}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-on-surface-variant">
                <tr>
                  <th className="px-2 py-2 text-start">#</th>
                  <th className="px-2 py-2 text-start">{t('form.medicine.name')}</th>
                  <th className="px-2 py-2 text-start">{t('form.medicine.dose')}</th>
                  <th className="px-2 py-2 text-start">{t('form.medicine.frequency')}</th>
                  <th className="px-2 py-2 text-start">Action</th>
                </tr>
              </thead>
              <tbody>
                {formData.extra.medicines.map((row, i) => (
                  <tr key={i} className="border-t border-outline-variant">
                    <td className="px-2 py-1 text-on-surface-variant">{i + 1}</td>
                    {['name', 'dose', 'frequency'].map((k) => (
                      <td key={k} className="px-2 py-1">
                        <input
                          value={row[k]}
                          onChange={(e) =>
                            setExtra(
                              'medicines',
                              formData.extra.medicines.map((r, idx) =>
                                idx === i ? { ...r, [k]: e.target.value } : r
                              )
                            )
                          }
                          className={inputCls}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1">
                      <select
                        value={row.action}
                        onChange={(e) =>
                          setExtra(
                            'medicines',
                            formData.extra.medicines.map((r, idx) =>
                              idx === i ? { ...r, action: e.target.value } : r
                            )
                          )
                        }
                        className={inputCls}
                      >
                        <option value="">—</option>
                        <option value="Continue">{t('form.medicine.continue')}</option>
                        <option value="Discontinue">{t('form.medicine.discontinue')}</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-on-surface-variant italic mt-3">
            {t('form.medicine.note')}
          </p>
        </CollapsibleSection>

        {/* ─── Section 5: Hypersensitivity ─── */}
        <CollapsibleSection icon="warning" title={t('form.section5')}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t('form.hyper.food')}>
              <input
                value={formData.extra.hyper_food}
                onChange={(e) => setExtra('hyper_food', e.target.value)}
                className={inputCls}
                placeholder={t('form.hyper.specify')}
              />
            </Field>
            <Field label={t('form.hyper.blood')}>
              <input
                value={formData.extra.hyper_blood}
                onChange={(e) => setExtra('hyper_blood', e.target.value)}
                className={inputCls}
                placeholder={t('form.hyper.specify')}
              />
            </Field>
            <Field label={t('form.hyper.drug')}>
              <input
                value={formData.drug_allergies || ''}
                onChange={(e) => set(['drug_allergies'], e.target.value)}
                className={inputCls}
                placeholder={t('form.hyper.specify')}
              />
            </Field>
          </div>
        </CollapsibleSection>

        {/* ─── Section 6: Tobacco & Alcohol ─── */}
        <CollapsibleSection icon="smoking_rooms" title={t('form.section6')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <CheckboxRow
                label={t('form.tobacco')}
                checked={formData.extra.tobacco_used}
                onChange={(v) => setExtra('tobacco_used', v)}
              />
              {formData.extra.tobacco_used && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Field label={t('form.subst.type')}>
                    <select
                      value={formData.extra.tobacco_type}
                      onChange={(e) => setExtra('tobacco_type', e.target.value)}
                      className={inputCls}
                    >
                      <option value="">—</option>
                      <option value="Cigarettes">{t('form.tobacco.cigarettes')}</option>
                      <option value="Hookah">{t('form.tobacco.hookah')}</option>
                      <option value="Chewing">{t('form.tobacco.chewing')}</option>
                      <option value="Other">{t('form.others')}</option>
                    </select>
                  </Field>
                  <Field label={t('form.subst.amount')}>
                    <input
                      type="number"
                      value={formData.extra.tobacco_amount}
                      onChange={(e) => setExtra('tobacco_amount', e.target.value)}
                      className={inputCls}
                      placeholder={t('form.tobacco.amountHint')}
                    />
                  </Field>
                  <Field label={t('form.subst.duration')}>
                    <input
                      type="number"
                      value={formData.extra.tobacco_duration}
                      onChange={(e) => setExtra('tobacco_duration', e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label={t('form.subst.status')}>
                    <select
                      value={formData.extra.tobacco_status}
                      onChange={(e) => setExtra('tobacco_status', e.target.value)}
                      className={inputCls}
                    >
                      <option value="">—</option>
                      <option value="Current">{t('form.subst.current')}</option>
                      <option value="Former">{t('form.subst.former')}</option>
                    </select>
                  </Field>
                  {formData.extra.tobacco_status === 'Former' && (
                    <Field label={t('form.subst.quitYears')}>
                      <input
                        type="number"
                        value={formData.extra.tobacco_quit_years}
                        onChange={(e) => setExtra('tobacco_quit_years', e.target.value)}
                        className={inputCls}
                      />
                    </Field>
                  )}
                  <Field label={t('form.subst.recommendation')} full>
                    <input
                      value={formData.extra.tobacco_recommendation}
                      onChange={(e) => setExtra('tobacco_recommendation', e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                </div>
              )}
            </div>

            <div>
              <CheckboxRow
                label={t('form.alcohol')}
                checked={formData.extra.alcohol_used}
                onChange={(v) => setExtra('alcohol_used', v)}
              />
              {formData.extra.alcohol_used && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Field label={t('form.subst.type')}>
                    <select
                      value={formData.extra.alcohol_type}
                      onChange={(e) => setExtra('alcohol_type', e.target.value)}
                      className={inputCls}
                    >
                      <option value="">—</option>
                      <option value="Beer">{t('form.alcohol.beer')}</option>
                      <option value="Wine">{t('form.alcohol.wine')}</option>
                      <option value="Spirits">{t('form.alcohol.spirits')}</option>
                      <option value="Other">{t('form.others')}</option>
                    </select>
                  </Field>
                  <Field label={t('form.subst.amount')}>
                    <input
                      value={formData.extra.alcohol_amount}
                      onChange={(e) => setExtra('alcohol_amount', e.target.value)}
                      className={inputCls}
                      placeholder={t('form.alcohol.amountHint')}
                    />
                  </Field>
                  <Field label={t('form.subst.duration')}>
                    <input
                      type="number"
                      value={formData.extra.alcohol_duration}
                      onChange={(e) => setExtra('alcohol_duration', e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label={t('form.subst.status')}>
                    <select
                      value={formData.extra.alcohol_status}
                      onChange={(e) => setExtra('alcohol_status', e.target.value)}
                      className={inputCls}
                    >
                      <option value="">—</option>
                      <option value="Current">{t('form.subst.current')}</option>
                      <option value="Former">{t('form.subst.former')}</option>
                    </select>
                  </Field>
                  <Field label={t('form.subst.recommendation')} full>
                    <input
                      value={formData.extra.alcohol_recommendation}
                      onChange={(e) => setExtra('alcohol_recommendation', e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>
        </CollapsibleSection>

        {/* ─── Section 7: Clinical Examination ─── */}
        <CollapsibleSection
          icon="stethoscope"
          title={t('form.section7')}
          complete={sectionComplete.s7}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label={t('form.neckGoiter')} full>
              <input
                value={formData.extra.neck_goiter}
                onChange={(e) => setExtra('neck_goiter', e.target.value)}
                className={inputCls}
                placeholder={`${t('form.normal')} / ${t('form.abnormal')}`}
              />
            </Field>
            <Field label="SpO2 %">
              <input
                type="number"
                step="0.1"
                value={formData.oxygen_saturation ?? ''}
                onChange={(e) => set(['oxygen_saturation'], e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Temp °C">
              <input
                type="number"
                step="0.1"
                value={formData.temperature_celsius ?? ''}
                onChange={(e) => set(['temperature_celsius'], e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={t('form.nibpSystolic')}>
              <input
                type="number"
                value={formData.blood_pressure_systolic ?? ''}
                onChange={(e) => set(['blood_pressure_systolic'], e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={t('form.nibpDiastolic')}>
              <input
                type="number"
                value={formData.blood_pressure_diastolic ?? ''}
                onChange={(e) => set(['blood_pressure_diastolic'], e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="HR bpm">
              <input
                type="number"
                value={formData.heart_rate ?? ''}
                onChange={(e) => set(['heart_rate'], e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Resp. Rate">
              <input
                type="number"
                value={formData.respiratory_rate ?? ''}
                onChange={(e) => set(['respiratory_rate'], e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Rhythm">
              <RadioRow
                value={formData.extra.hr_rhythm}
                onChange={(v) => setExtra('hr_rhythm', v)}
                options={[
                  { value: 'regular', label: 'Regular' },
                  { value: 'irregular', label: 'Irregular' },
                ]}
              />
            </Field>
            <Field label={t('form.heart')} full>
              <input
                value={formData.cardiovascular_status || ''}
                onChange={(e) => set(['cardiovascular_status'], e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={t('form.chest')} full>
              <input
                value={formData.respiratory_status || ''}
                onChange={(e) => set(['respiratory_status'], e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={t('form.abdomen')} full>
              <input
                value={formData.extra.abdomen}
                onChange={(e) => setExtra('abdomen', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={`${t('form.others')} (findings)`} full>
              <input
                value={formData.extra.exam_others}
                onChange={(e) => setExtra('exam_others', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="mt-6 pt-6 border-t border-outline-variant">
            <p className="text-sm font-semibold text-on-surface mb-3">
              {t('form.heartChestHealth')}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label={t('form.echoEf')}>
                <input
                  type="number"
                  value={formData.extra.echo_ef}
                  onChange={(e) => setExtra('echo_ef', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label={t('form.ecgFindings')} full>
                <input
                  value={formData.extra.ecg_findings}
                  onChange={(e) => setExtra('ecg_findings', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label={t('form.conclusion')} full>
                <input
                  value={formData.extra.heart_conclusion}
                  onChange={(e) => setExtra('heart_conclusion', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label={t('form.recommendations')} full>
                <input
                  value={formData.extra.heart_recommendations}
                  onChange={(e) => setExtra('heart_recommendations', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        </CollapsibleSection>

        {/* ─── Section 8: Investigations ─── */}
        <CollapsibleSection icon="biotech" title={t('form.section8')}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ['bun', 'BUN'],
              ['s_creatinine', 'S. Creatinine'],
              ['b_glucose', 'B. Glucose'],
              ['k_plus', 'K+'],
              ['ca_plus', 'Ca++'],
              ['pt', 'PT'],
              ['ptt', 'PTT'],
              ['inr', 'INR'],
              ['ast', 'AST'],
              ['alt', 'ALT'],
              ['alp', 'ALP'],
              ['hbv', 'HbsAg (HBV)'],
              ['hcv', 'HCV'],
              ['hiv', 'HIV'],
              ['t3', 'T3'],
              ['t4', 'T4'],
              ['tsh', 'TSH'],
              ['free_t3', 'Free T3'],
            ].map(([k, label]) => (
              <Field key={k} label={label}>
                <input
                  value={formData.extra[k]}
                  onChange={(e) => setExtra(k, e.target.value)}
                  className={inputCls}
                />
              </Field>
            ))}
            <Field label={t('form.dentures')}>
              <select
                value={formData.extra.dentures}
                onChange={(e) => setExtra('dentures', e.target.value)}
                className={inputCls}
              >
                <option value="none">{t('form.dentures.none')}</option>
                <option value="complete">{t('form.dentures.complete')}</option>
                <option value="partial">{t('form.dentures.partial')}</option>
              </select>
            </Field>
            <Field label={t('form.mpc')}>
              <select
                value={formData.mallampati_score || ''}
                onChange={(e) => set(['mallampati_score'], e.target.value)}
                className={inputCls}
              >
                <option value="">—</option>
                <option value="I">Class I</option>
                <option value="II">Class II</option>
                <option value="III">Class III</option>
                <option value="IV">Class IV</option>
              </select>
            </Field>
          </div>
        </CollapsibleSection>

        {/* ─── Section 9: Risk Assessment ─── */}
        <CollapsibleSection
          icon="shield"
          title={t('form.section9')}
          complete={sectionComplete.s9}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t('form.asaClass')}>
              <select
                value={formData.asa_classification || ''}
                onChange={(e) => set(['asa_classification'], e.target.value)}
                className={inputCls}
              >
                {['I', 'II', 'III', 'IV', 'V', 'VI'].map((c) => (
                  <option key={c} value={c}>
                    {t(`asa.${c}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('form.recommendations')} full>
              <textarea
                value={formData.asa_justification || ''}
                onChange={(e) => set(['asa_justification'], e.target.value)}
                rows={2}
                className={inputCls}
              />
            </Field>
            <Field label={t('assessment.riskNotes')} full>
              <textarea
                value={formData.risk_notes || ''}
                onChange={(e) => set(['risk_notes'], e.target.value)}
                rows={2}
                className={inputCls}
              />
            </Field>
          </div>
        </CollapsibleSection>

        {/* ─── Section 10: Fitness / Clearance ─── */}
        <CollapsibleSection icon="verified" title={t('form.section10')}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label={t('form.fasting.food')}>
              <input
                type="time"
                value={formData.extra.fast_food}
                onChange={(e) => setExtra('fast_food', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={t('form.fasting.clearFluid')}>
              <input
                type="time"
                value={formData.extra.fast_clear_fluid}
                onChange={(e) => setExtra('fast_clear_fluid', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={t('form.fasting.breastMilk')}>
              <input
                type="time"
                value={formData.extra.fast_breast_milk}
                onChange={(e) => setExtra('fast_breast_milk', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={t('form.fasting.bottleMilk')}>
              <input
                type="time"
                value={formData.extra.fast_bottle_milk}
                onChange={(e) => setExtra('fast_bottle_milk', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={`${t('form.score')} ${t('form.scoreOf20')}`}>
              <input
                type="number"
                min={0}
                max={20}
                value={formData.extra.score}
                onChange={(e) => setExtra('score', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={t('form.consentBy')}>
              <RadioRow
                value={formData.extra.consent_by}
                onChange={(v) => setExtra('consent_by', v)}
                options={[
                  { value: 'His', label: t('form.consent.his') },
                  { value: 'Her', label: t('form.consent.her') },
                ]}
              />
            </Field>
            <Field label={t('form.anaesthetistName')}>
              <input value={assessment.created_by_name || ''} disabled className={`${inputCls} opacity-75`} />
            </Field>
            <Field label={t('form.date')}>
              <input
                value={new Date().toLocaleDateString(localeTag)}
                disabled
                className={`${inputCls} opacity-75`}
              />
            </Field>
          </div>
        </CollapsibleSection>

        {error && (
          <div className="bg-error-container text-on-error-container p-4 rounded-xl text-sm flex items-center gap-2 anim-shake">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              error
            </span>
            {error}
          </div>
        )}

        <div className="sticky bottom-0 bg-surface/95 backdrop-blur border-t border-outline-variant -mx-8 px-8 py-4 flex flex-wrap items-center justify-end gap-3">
          {canModify && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="me-auto px-5 py-2.5 border border-error text-error rounded-lg text-sm font-semibold hover:bg-error-container/40 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                delete
              </span>
              {t('common.delete')}
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(`/patients/${assessment.patient_id}`)}
            className="px-5 py-2.5 border border-outline-variant rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !canModify}
            className="px-5 py-2.5 border border-secondary text-secondary rounded-lg text-sm font-semibold hover:bg-secondary-container/40 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {saving ? <Spinner size={16} /> : (
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
            )}
            {isDraft ? t('assessment.saveDraft') : t('assessment.saveChanges')}
          </button>
          {isDraft && (
            <button
              type="submit"
              disabled={submitting || !canModify}
              className="px-5 py-2.5 bg-secondary text-on-secondary rounded-lg text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 flex items-center gap-2"
            >
              {submitting ? <Spinner size={16} /> : (
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
              )}
              {t('assessment.submitForClearance')}
            </button>
          )}
        </div>

        <Modal
          open={confirmDelete}
          onClose={() => !deleting && setConfirmDelete(false)}
          title={t('assessment.deletePrompt')}
        >
          <p className="text-sm text-on-surface">
            {t('assessment.deleteBody', { id: assessment.id })}
          </p>
          {isApproved && (
            <p className="mt-3 text-xs bg-error-container text-on-error-container px-3 py-2 rounded-lg">
              {t('assessment.deleteApprovedWarning')}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="px-4 py-2 border border-outline-variant rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-error text-on-error rounded-lg text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 flex items-center gap-2"
            >
              {deleting ? <Spinner size={16} /> : (
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  delete_forever
                </span>
              )}
              {t('assessment.deletePermanently')}
            </button>
          </div>
        </Modal>
      </form>
    </>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Helpers
 * ─────────────────────────────────────────────────────────────────────── */

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function setIn(obj, path, value) {
  if (!path.length) return value
  const [k, ...rest] = path
  return { ...obj, [k]: setIn(obj?.[k] ?? {}, rest, value) }
}
