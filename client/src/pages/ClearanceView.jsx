import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { getAssessment, createClearance } from '../api/assessments'
import Spinner from '../components/Spinner'
import StatusBadge, { asaVariant } from '../components/StatusBadge'

const inputClass =
  'w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all'

function SummaryItem({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-outline mb-1">{label}</p>
      <p className="text-sm text-on-surface">{value || '—'}</p>
    </div>
  )
}

export default function ClearanceView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, watch } = useForm({
    defaultValues: { decision: 'cleared', follow_up_required: false },
  })
  const decision = watch('decision')

  const load = async () => {
    setLoading(true)
    try {
      const r = await getAssessment(id)
      setData(r)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load assessment')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const onSubmit = async (values) => {
    setSubmitting(true)
    setError('')
    try {
      await createClearance(id, {
        ...values,
        follow_up_required: !!values.follow_up_required,
      })
      await load()
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to record clearance')
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

  if (!data) {
    return (
      <div className="bg-error-container text-on-error-container p-6 rounded-xl">
        {error || 'Assessment not found'}
      </div>
    )
  }

  const { assessment, lab_results, clearance } = data
  const hasDecision = !!clearance

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <button
          onClick={() => navigate(`/patients/${assessment.patient_id}`)}
          className="text-sm text-on-surface-variant hover:text-secondary inline-flex items-center gap-1 mb-3"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          Back to patient
        </button>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-on-surface tracking-tight">Clearance Review</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              {assessment.patient_name} • Assessment #{assessment.id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={assessment.status} />
            {assessment.asa_classification && (
              <StatusBadge variant={asaVariant(assessment.asa_classification)} label={`ASA ${assessment.asa_classification}`} />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant">
              <h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">summarize</span>
                Assessment Summary
              </h2>
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-5">
              <SummaryItem label="ASA" value={assessment.asa_classification && `ASA ${assessment.asa_classification}`} />
              <SummaryItem label="Anaesthetic Plan" value={assessment.anaesthetic_plan} />
              <SummaryItem label="Mallampati" value={assessment.mallampati_score && `Class ${assessment.mallampati_score}`} />
              <SummaryItem label="BMI" value={assessment.bmi} />
              <SummaryItem label="BP" value={assessment.blood_pressure_systolic && `${assessment.blood_pressure_systolic}/${assessment.blood_pressure_diastolic || '—'}`} />
              <SummaryItem label="Heart Rate" value={assessment.heart_rate} />
              <SummaryItem label="SpO₂" value={assessment.oxygen_saturation && `${assessment.oxygen_saturation}%`} />
              <SummaryItem label="Allergies" value={assessment.drug_allergies} />
              <SummaryItem label="Severity" value={assessment.allergy_severity} />
              <SummaryItem label="Smoking" value={assessment.smoking_status} />
              <SummaryItem label="Alcohol" value={assessment.alcohol_use} />
              <SummaryItem label="NPO Confirmed" value={assessment.npo_confirmed ? 'Yes' : 'No'} />
            </div>

            {assessment.chief_complaint && (
              <div className="px-6 pb-6">
                <SummaryItem label="Chief Complaint" value={assessment.chief_complaint} />
              </div>
            )}
            {assessment.risk_notes && (
              <div className="px-6 pb-6 border-t border-outline-variant pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-error mb-1">Risk Notes</p>
                <p className="text-sm text-on-surface">{assessment.risk_notes}</p>
              </div>
            )}
          </section>

          {lab_results && lab_results.length > 0 && (
            <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant">
                <h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">biotech</span>
                  Lab Results
                </h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-surface-container-low text-xs uppercase tracking-wider text-on-surface-variant">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold">Test</th>
                    <th className="px-6 py-3 text-left font-semibold">Result</th>
                    <th className="px-6 py-3 text-left font-semibold">Reference</th>
                    <th className="px-6 py-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {lab_results.map((l) => (
                    <tr key={l.id}>
                      <td className="px-6 py-3 font-medium">{l.test_name}</td>
                      <td className={`px-6 py-3 font-semibold ${l.is_abnormal ? 'text-error' : 'text-on-surface'}`}>
                        {l.result_value} {l.unit}
                      </td>
                      <td className="px-6 py-3 text-on-surface-variant">{l.reference_range || '—'}</td>
                      <td className="px-6 py-3">
                        <span className={l.is_abnormal ? 'text-error font-semibold' : 'text-on-success-container font-semibold'}>
                          {l.is_abnormal ? 'Abnormal' : 'Normal'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>

        <aside>
          <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden sticky top-20">
            <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant">
              <h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">verified</span>
                {hasDecision ? 'Decision Recorded' : 'Clearance Decision'}
              </h2>
            </div>

            {hasDecision ? (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <StatusBadge status={clearance.decision} />
                </div>
                <SummaryItem label="Decided By" value={clearance.decided_by_name} />
                <SummaryItem label="Decided At" value={clearance.decided_at && new Date(clearance.decided_at).toLocaleString()} />
                {clearance.conditions && <SummaryItem label="Conditions" value={clearance.conditions} />}
                {clearance.reason && <SummaryItem label="Reason" value={clearance.reason} />}
                {clearance.follow_up_required && (
                  <SummaryItem label="Follow-Up" value={clearance.follow_up_notes || 'Required'} />
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
                    Decision
                  </label>
                  <div className="space-y-2">
                    {['cleared', 'conditional', 'not_cleared'].map((opt) => (
                      <label
                        key={opt}
                        className={`flex items-center gap-3 px-4 py-3 border rounded-lg cursor-pointer transition-colors capitalize ${
                          decision === opt
                            ? 'border-secondary bg-secondary-container/30 text-on-secondary-container font-semibold'
                            : 'border-outline-variant hover:bg-surface-container-low'
                        }`}
                      >
                        <input
                          type="radio"
                          value={opt}
                          {...register('decision')}
                          className="accent-secondary"
                        />
                        {opt.replace('_', ' ')}
                      </label>
                    ))}
                  </div>
                </div>

                {decision === 'conditional' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
                      Conditions
                    </label>
                    <textarea {...register('conditions')} rows={3} className={inputClass} />
                  </div>
                )}

                {decision === 'not_cleared' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
                      Reason
                    </label>
                    <textarea {...register('reason')} rows={3} className={inputClass} />
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" {...register('follow_up_required')} className="accent-secondary" />
                  Requires follow-up
                </label>

                {watch('follow_up_required') && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
                      Follow-Up Notes
                    </label>
                    <textarea {...register('follow_up_notes')} rows={2} className={inputClass} />
                  </div>
                )}

                {error && (
                  <div className="bg-error-container text-on-error-container px-3 py-2 rounded-lg text-xs">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-secondary text-on-secondary rounded-lg text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? <Spinner size={16} /> : (
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>gavel</span>
                  )}
                  Record Decision
                </button>
              </form>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
