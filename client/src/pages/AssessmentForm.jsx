import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  getAssessment,
  updateAssessment,
  submitAssessment,
  deleteAssessment,
} from '../api/assessments'
import Spinner from '../components/Spinner'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'

const inputClass =
  'w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all'

function Field({ label, error, children, full = false }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  )
}

function Section({ icon, title, subtitle, children }) {
  return (
    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant flex items-center gap-3">
        <span className="material-symbols-outlined text-secondary">{icon}</span>
        <div>
          <h2 className="text-base font-semibold text-on-surface">{title}</h2>
          {subtitle && <p className="text-xs text-on-surface-variant">{subtitle}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  )
}

const cleanPayload = (values) => {
  const out = {}
  Object.entries(values).forEach(([k, v]) => {
    if (v === '' || v === undefined || v === null) return
    out[k] = v
  })
  return out
}

export default function AssessmentForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()
  const [loading, setLoading] = useState(true)
  const [assessment, setAssessment] = useState(null)
  const [error, setError] = useState('')
  const [savingDraft, setSavingDraft] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const r = await getAssessment(id)
        if (cancelled) return
        setAssessment(r.assessment)
        reset(r.assessment)
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || 'Failed to load assessment')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, reset])

  const saveDraft = async (values) => {
    setSavingDraft(true)
    setSavedMsg('')
    try {
      await updateAssessment(id, cleanPayload(values))
      setSavedMsg('Draft saved')
      setTimeout(() => setSavedMsg(''), 2500)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save')
    } finally {
      setSavingDraft(false)
    }
  }

  const onSubmit = async (values) => {
    setSubmitting(true)
    setError('')
    try {
      await updateAssessment(id, cleanPayload(values))
      await submitAssessment(id)
      navigate(`/assessments/${id}/clearance`)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to submit assessment')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={32} />
      </div>
    )
  }

  if (!assessment) {
    return (
      <div className="bg-error-container text-on-error-container p-6 rounded-xl">
        {error || 'Assessment not found'}
      </div>
    )
  }

  // Creator or admin may modify; everyone else gets a read-only view.
  const canModify =
    hasRole('admin') || (hasRole('anaesthetist') && assessment.created_by === user?.id)
  const isDraft = assessment.status === 'draft'
  const isApproved = assessment.status === 'approved'

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      await deleteAssessment(id)
      navigate(`/patients/${assessment.patient_id}`)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete assessment')
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate(`/patients/${assessment.patient_id}`)}
            className="text-sm text-on-surface-variant hover:text-secondary inline-flex items-center gap-1 mb-3"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            Back to patient
          </button>
          <h1 className="text-3xl font-bold text-on-surface tracking-tight">
            Pre-Op Evaluation
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {assessment.patient_name} • Assessment #{assessment.id}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={assessment.status} />
          {savedMsg && <span className="text-xs text-on-success-container bg-success-container px-3 py-1 rounded-full">{savedMsg}</span>}
        </div>
      </div>

      <Section icon="monitor_heart" title="Vitals & Anthropometry">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Weight (kg)">
            <input type="number" step="0.1" {...register('weight_kg', { valueAsNumber: true })} className={inputClass} />
          </Field>
          <Field label="Height (cm)">
            <input type="number" step="0.1" {...register('height_cm', { valueAsNumber: true })} className={inputClass} />
          </Field>
          <Field label="BMI">
            <input value={assessment.bmi || ''} readOnly disabled className={`${inputClass} opacity-70`} />
          </Field>
          <Field label="Temp (°C)">
            <input type="number" step="0.1" {...register('temperature_celsius', { valueAsNumber: true })} className={inputClass} />
          </Field>
          <Field label="BP Systolic">
            <input type="number" {...register('blood_pressure_systolic', { valueAsNumber: true })} className={inputClass} />
          </Field>
          <Field label="BP Diastolic">
            <input type="number" {...register('blood_pressure_diastolic', { valueAsNumber: true })} className={inputClass} />
          </Field>
          <Field label="Heart Rate (bpm)">
            <input type="number" {...register('heart_rate', { valueAsNumber: true })} className={inputClass} />
          </Field>
          <Field label="Resp. Rate">
            <input type="number" {...register('respiratory_rate', { valueAsNumber: true })} className={inputClass} />
          </Field>
          <Field label="SpO₂ (%)">
            <input type="number" step="0.1" {...register('oxygen_saturation', { valueAsNumber: true })} className={inputClass} />
          </Field>
        </div>
      </Section>

      <Section icon="history_edu" title="Medical History">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Chief Complaint" full>
            <textarea {...register('chief_complaint')} rows={2} className={inputClass} />
          </Field>
          <Field label="Current Medications">
            <textarea {...register('current_medications')} rows={2} className={inputClass} />
          </Field>
          <Field label="Drug Allergies">
            <textarea {...register('drug_allergies')} rows={2} className={inputClass} />
          </Field>
          <Field label="Allergy Severity">
            <select {...register('allergy_severity')} className={inputClass}>
              <option value="">—</option>
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
              <option value="unknown">Unknown</option>
            </select>
          </Field>
          <Field label="Smoking Status">
            <select {...register('smoking_status')} className={inputClass}>
              <option value="">—</option>
              <option value="never">Never</option>
              <option value="former">Former</option>
              <option value="current">Current</option>
            </select>
          </Field>
          <Field label="Alcohol Use">
            <select {...register('alcohol_use')} className={inputClass}>
              <option value="">—</option>
              <option value="none">None</option>
              <option value="occasional">Occasional</option>
              <option value="moderate">Moderate</option>
              <option value="heavy">Heavy</option>
            </select>
          </Field>
          <Field label="Previous Surgeries" full>
            <textarea {...register('previous_surgeries')} rows={2} className={inputClass} />
          </Field>
          <Field label="Previous Anaesthesia Issues">
            <textarea {...register('previous_anaesthesia_issues')} rows={2} className={inputClass} />
          </Field>
          <Field label="Family Anaesthesia History">
            <textarea {...register('family_anaesthesia_history')} rows={2} className={inputClass} />
          </Field>
        </div>
      </Section>

      <Section icon="stethoscope" title="Systems Review">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Cardiovascular Status">
            <input {...register('cardiovascular_status')} className={inputClass} />
          </Field>
          <Field label="Cardiovascular Conditions">
            <input {...register('cardiovascular_conditions')} className={inputClass} />
          </Field>
          <Field label="Respiratory Status">
            <input {...register('respiratory_status')} className={inputClass} />
          </Field>
          <Field label="Respiratory Conditions">
            <input {...register('respiratory_conditions')} className={inputClass} />
          </Field>
          <Field label="Neurological Status">
            <input {...register('neurological_status')} className={inputClass} />
          </Field>
          <Field label="Renal Status">
            <input {...register('renal_status')} className={inputClass} />
          </Field>
          <Field label="Hepatic Status">
            <input {...register('hepatic_status')} className={inputClass} />
          </Field>
          <Field label="Endocrine Conditions">
            <input {...register('endocrine_conditions')} className={inputClass} />
          </Field>
        </div>
      </Section>

      <Section icon="hearing" title="ENT-Specific">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="ENT Complaint" full>
            <textarea {...register('ent_complaint')} rows={2} className={inputClass} />
          </Field>
          <Field label="Nasal Obstruction">
            <input {...register('nasal_obstruction')} className={inputClass} placeholder="None / Partial / Complete" />
          </Field>
          <Field label="Previous ENT Surgery">
            <select {...register('previous_ent_surgery')} className={inputClass}>
              <option value="">—</option>
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </Field>
          <Field label="Previous ENT Surgery Details" full>
            <textarea {...register('previous_ent_surgery_details')} rows={2} className={inputClass} />
          </Field>
        </div>
      </Section>

      <Section icon="clinical_notes" title="Airway Assessment">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Mallampati Score">
            <select {...register('mallampati_score')} className={inputClass}>
              <option value="">—</option>
              <option value="I">Class I</option>
              <option value="II">Class II</option>
              <option value="III">Class III</option>
              <option value="IV">Class IV</option>
            </select>
          </Field>
          <Field label="Mouth Opening (cm)">
            <input type="number" step="0.1" {...register('mouth_opening_cm', { valueAsNumber: true })} className={inputClass} />
          </Field>
          <Field label="Thyromental Dist (cm)">
            <input type="number" step="0.1" {...register('thyromental_distance_cm', { valueAsNumber: true })} className={inputClass} />
          </Field>
          <Field label="Neck Mobility">
            <select {...register('neck_mobility')} className={inputClass}>
              <option value="">—</option>
              <option value="full">Full</option>
              <option value="limited">Limited</option>
              <option value="very_limited">Very Limited</option>
            </select>
          </Field>
          <Field label="Dental Issues" full>
            <input {...register('dental_issues')} className={inputClass} />
          </Field>
          <Field label="Airway Notes" full>
            <textarea {...register('airway_notes')} rows={2} className={inputClass} />
          </Field>
        </div>
      </Section>

      <Section icon="shield" title="ASA Classification">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="ASA Class *" error={errors.asa_classification?.message}>
            <select
              {...register('asa_classification', { required: 'ASA classification is required' })}
              className={inputClass}
            >
              <option value="I">I — Healthy</option>
              <option value="II">II — Mild systemic disease</option>
              <option value="III">III — Severe systemic disease</option>
              <option value="IV">IV — Constant threat to life</option>
              <option value="V">V — Moribund</option>
              <option value="VI">VI — Brain-dead, organ donor</option>
            </select>
          </Field>
          <Field label="Justification" full>
            <textarea {...register('asa_justification')} rows={2} className={inputClass} />
          </Field>
        </div>
      </Section>

      <Section icon="no_food" title="NPO Status">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="NPO Solids Since">
            <input type="datetime-local" {...register('npo_solids_since')} className={inputClass} />
          </Field>
          <Field label="NPO Liquids Since">
            <input type="datetime-local" {...register('npo_liquids_since')} className={inputClass} />
          </Field>
          <Field label="NPO Confirmed">
            <select {...register('npo_confirmed')} className={inputClass}>
              <option value="">—</option>
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section icon="medication" title="Anaesthetic Plan">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Technique">
            <select {...register('anaesthetic_plan')} className={inputClass}>
              <option value="">—</option>
              <option value="general">General</option>
              <option value="regional">Regional</option>
              <option value="local">Local</option>
              <option value="sedation">Sedation</option>
              <option value="combined">Combined</option>
            </select>
          </Field>
          <Field label="Premedication Given">
            <input {...register('premedication_given')} className={inputClass} />
          </Field>
          <Field label="Premedication Details" full>
            <textarea {...register('premedication_details')} rows={2} className={inputClass} />
          </Field>
          <Field label="Plan Details" full>
            <textarea {...register('anaesthetic_plan_details')} rows={3} className={inputClass} />
          </Field>
          <Field label="Special Notes">
            <textarea {...register('special_notes')} rows={2} className={inputClass} />
          </Field>
          <Field label="Risk Notes">
            <textarea {...register('risk_notes')} rows={2} className={inputClass} />
          </Field>
        </div>
      </Section>

      {error && (
        <div className="bg-error-container text-on-error-container p-4 rounded-xl text-sm flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
          {error}
        </div>
      )}

      <div className="sticky bottom-0 bg-surface/95 backdrop-blur border-t border-outline-variant -mx-8 px-8 py-4 flex flex-wrap items-center justify-end gap-3">
        {canModify && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="mr-auto px-5 py-2.5 border border-error text-error rounded-lg text-sm font-semibold hover:bg-error-container/40 transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              delete
            </span>
            Delete
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate(`/patients/${assessment.patient_id}`)}
          className="px-5 py-2.5 border border-outline-variant rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit(saveDraft)}
          disabled={savingDraft || !canModify}
          className="px-5 py-2.5 border border-secondary text-secondary rounded-lg text-sm font-semibold hover:bg-secondary-container/40 transition-colors disabled:opacity-60 flex items-center gap-2"
        >
          {savingDraft ? <Spinner size={16} /> : (
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
          )}
          {isDraft ? 'Save Draft' : 'Save Changes'}
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
            Submit for Clearance
          </button>
        )}
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        title="Delete assessment?"
      >
        <p className="text-sm text-on-surface">
          This will permanently remove assessment #{assessment.id} along with any lab
          results, clinical notes, and clearance decisions attached to it.
        </p>
        {isApproved && (
          <p className="mt-3 text-xs bg-error-container text-on-error-container px-3 py-2 rounded-lg">
            This assessment is currently <strong>approved</strong>. Deleting it removes a
            finalised clinical record.
          </p>
        )}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            disabled={deleting}
            className="px-4 py-2 border border-outline-variant rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            Cancel
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
            Delete permanently
          </button>
        </div>
      </Modal>
    </form>
  )
}
