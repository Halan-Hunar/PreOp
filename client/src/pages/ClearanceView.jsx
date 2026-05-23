import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { getAssessment, createClearance } from '../api/assessments'
import Spinner from '../components/Spinner'
import StatusBadge, { asaVariant } from '../components/StatusBadge'
import ExportMenu from '../components/ExportMenu'
import AssessmentPrintForm from '../components/AssessmentPrintForm'
import {
  exportNodeAsImage,
  exportNodeAsPdf,
  printNode,
  exportSheetsAsExcel,
} from '../utils/exportHelpers'
import { buildAssessmentSheets } from '../utils/assessmentExcel'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'

const inputClass =
  'w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all'

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
  const { t, lang, dr, formatName } = useLanguage()
  const { user } = useAuth()
  const printRef = useRef(null)
  const localeTag = lang === 'ku' ? 'ku' : undefined

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
      setError(e.response?.data?.error || t('common.failedLoad'))
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
      setError(e.response?.data?.error || t('clearance.failed'))
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
        {error || t('assessment.notFound')}
      </div>
    )
  }

  const { assessment, lab_results, clearance } = data
  const hasDecision = !!clearance

  // Parse the JSON-encoded extras (mirrors AssessmentForm's storage) so the
  // print form can render the full paper-replica. Prefer the new
  // `extra_data` column; fall back to legacy storage in `special_notes`.
  let extra = {}
  const extraSrc = assessment.extra_data || assessment.special_notes
  if (extraSrc) {
    try {
      const parsed = typeof extraSrc === 'string' ? JSON.parse(extraSrc) : extraSrc
      if (parsed && typeof parsed === 'object') {
        const { __extra: _ignored, ...rest } = parsed
        extra = rest
      }
    } catch {
      /* legacy free-text — leave extra empty */
    }
  }

  // Doctor name shown on the print form: when the logged-in user is the
  // anaesthetist, treat them as the signing doctor on this page. Admins fall
  // back to the creator's name from the DB.
  const doctorDisplayName = user?.role === 'anaesthetist'
    ? formatName(user?.name, user?.role)
    : formatName(assessment.created_by_name, 'anaesthetist')

  const filenameBase = `Assessment_${assessment.id}_${(assessment.patient_name || 'patient').replace(/\s+/g, '_')}`
  const handleExportPdf = () => exportNodeAsPdf(printRef.current, `${filenameBase}.pdf`)
  const handleExportImage = () => exportNodeAsImage(printRef.current, `${filenameBase}.png`)
  const handlePrint = () => printNode(printRef.current)
  const handleExportExcel = () => {
    const sheets = buildAssessmentSheets({
      assessment,
      extra,
      doctorName: doctorDisplayName,
      t,
    })
    if (clearance) {
      // Append the clearance decision as its own sheet of label/value pairs.
      sheets.push({
        name: 'Clearance',
        rows: [
          { Field: t('clearance.decision'), Value: t(`status.${clearance.decision}`) },
          { Field: t('clearance.decidedBy'), Value: doctorDisplayName },
          { Field: t('clearance.decidedAt'), Value: clearance.decided_at || '' },
          { Field: t('clearance.conditions'), Value: clearance.conditions || '' },
          { Field: t('clearance.reason'), Value: clearance.reason || '' },
          { Field: t('clearance.followUpNotes'), Value: clearance.follow_up_notes || '' },
        ],
      })
    }
    exportSheetsAsExcel(sheets, `${filenameBase}.xlsx`)
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <AssessmentPrintForm
        ref={printRef}
        data={{ ...assessment, extra }}
        doctorDisplayName={doctorDisplayName}
      />
      {/* relative + z-index so the ExportMenu dropdown paints above the
          summary cards below (each card creates its own stacking context). */}
      <div className="relative z-30">
        <button
          onClick={() => navigate(`/patients/${assessment.patient_id}`)}
          className="text-sm text-on-surface-variant hover:text-secondary inline-flex items-center gap-1 mb-3"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            arrow_back
          </span>
          {t('assessment.backToPatient')}
        </button>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-on-surface tracking-tight">
              {t('clearance.title')}
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">
              {t('clearance.subtitle', { name: assessment.patient_name || '', id: assessment.id })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={assessment.status} />
            {assessment.asa_classification && (
              <StatusBadge
                variant={asaVariant(assessment.asa_classification)}
                label={`ASA ${assessment.asa_classification}`}
              />
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant">
              <h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">summarize</span>
                {t('clearance.summary')}
              </h2>
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-5">
              <SummaryItem
                label={t('clearance.summary.asa')}
                value={assessment.asa_classification && `ASA ${assessment.asa_classification}`}
              />
              <SummaryItem
                label={t('clearance.summary.plan')}
                value={
                  assessment.anaesthetic_plan
                    ? t(`technique.${assessment.anaesthetic_plan}`)
                    : ''
                }
              />
              <SummaryItem
                label={t('clearance.summary.mallampati')}
                value={
                  assessment.mallampati_score
                    ? t('assessment.mallampatiClass', { n: assessment.mallampati_score })
                    : ''
                }
              />
              <SummaryItem label={t('clearance.summary.bmi')} value={assessment.bmi} />
              <SummaryItem
                label={t('clearance.summary.bp')}
                value={
                  assessment.blood_pressure_systolic &&
                  `${assessment.blood_pressure_systolic}/${assessment.blood_pressure_diastolic || '—'}`
                }
              />
              <SummaryItem label={t('clearance.summary.heartRate')} value={assessment.heart_rate} />
              <SummaryItem
                label={t('clearance.summary.spo2')}
                value={assessment.oxygen_saturation && `${assessment.oxygen_saturation}%`}
              />
              <SummaryItem label={t('clearance.summary.allergies')} value={assessment.drug_allergies} />
              <SummaryItem
                label={t('clearance.summary.severity')}
                value={assessment.allergy_severity && t(`severity.${assessment.allergy_severity}`)}
              />
              <SummaryItem
                label={t('clearance.summary.smoking')}
                value={assessment.smoking_status && t(`smoking.${assessment.smoking_status}`)}
              />
              <SummaryItem
                label={t('clearance.summary.alcohol')}
                value={assessment.alcohol_use && t(`alcohol.${assessment.alcohol_use}`)}
              />
              <SummaryItem
                label={t('clearance.summary.npoConfirmed')}
                value={assessment.npo_confirmed ? t('common.yes') : t('common.no')}
              />
            </div>

            {assessment.chief_complaint && (
              <div className="px-6 pb-6">
                <SummaryItem
                  label={t('clearance.summary.chiefComplaint')}
                  value={assessment.chief_complaint}
                />
              </div>
            )}
            {assessment.risk_notes && (
              <div className="px-6 pb-6 border-t border-outline-variant pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-error mb-1">
                  {t('clearance.summary.riskNotes')}
                </p>
                <p className="text-sm text-on-surface">{assessment.risk_notes}</p>
              </div>
            )}
          </section>

          {lab_results && lab_results.length > 0 && (
            <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant">
                <h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">biotech</span>
                  {t('clearance.labResults')}
                </h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-surface-container-low text-xs uppercase tracking-wider text-on-surface-variant">
                  <tr>
                    <th className="px-6 py-3 text-start font-semibold">{t('clearance.test')}</th>
                    <th className="px-6 py-3 text-start font-semibold">{t('clearance.result')}</th>
                    <th className="px-6 py-3 text-start font-semibold">{t('clearance.reference')}</th>
                    <th className="px-6 py-3 text-start font-semibold">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {lab_results.map((l) => (
                    <tr key={l.id}>
                      <td className="px-6 py-3 font-medium text-on-surface">{l.test_name}</td>
                      <td
                        className={`px-6 py-3 font-semibold ${
                          l.is_abnormal ? 'text-error' : 'text-on-surface'
                        }`}
                      >
                        {l.result_value} {l.unit}
                      </td>
                      <td className="px-6 py-3 text-on-surface-variant">
                        {l.reference_range || '—'}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={
                            l.is_abnormal
                              ? 'text-error font-semibold'
                              : 'text-on-success-container font-semibold'
                          }
                        >
                          {l.is_abnormal ? t('clearance.abnormal') : t('clearance.normal')}
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
                {hasDecision ? t('clearance.decisionRecorded') : t('clearance.decision')}
              </h2>
            </div>

            {hasDecision ? (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <StatusBadge status={clearance.decision} />
                </div>
                <SummaryItem
                  label={t('clearance.decidedBy')}
                  value={clearance.decided_by_name ? dr(clearance.decided_by_name) : ''}
                />
                <SummaryItem
                  label={t('clearance.decidedAt')}
                  value={
                    clearance.decided_at &&
                    new Date(clearance.decided_at).toLocaleString(localeTag)
                  }
                />
                {clearance.conditions && (
                  <SummaryItem label={t('clearance.conditions')} value={clearance.conditions} />
                )}
                {clearance.reason && (
                  <SummaryItem label={t('clearance.reason')} value={clearance.reason} />
                )}
                {clearance.follow_up_required && (
                  <SummaryItem
                    label={t('clearance.followUp')}
                    value={clearance.follow_up_notes || t('common.required')}
                  />
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
                    {t('clearance.decision')}
                  </label>
                  <div className="space-y-2">
                    {['cleared', 'conditional', 'not_cleared'].map((opt) => (
                      <label
                        key={opt}
                        className={`flex items-center gap-3 px-4 py-3 border rounded-lg cursor-pointer transition-colors ${
                          decision === opt
                            ? 'border-secondary bg-secondary-container/30 text-on-secondary-container font-semibold'
                            : 'border-outline-variant text-on-surface hover:bg-surface-container-low'
                        }`}
                      >
                        <input
                          type="radio"
                          value={opt}
                          {...register('decision')}
                          className="accent-secondary"
                        />
                        {t(`status.${opt}`)}
                      </label>
                    ))}
                  </div>
                </div>

                {decision === 'conditional' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
                      {t('clearance.conditions')}
                    </label>
                    <textarea {...register('conditions')} rows={3} className={inputClass} />
                  </div>
                )}

                {decision === 'not_cleared' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
                      {t('clearance.reason')}
                    </label>
                    <textarea {...register('reason')} rows={3} className={inputClass} />
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('follow_up_required')}
                    className="accent-secondary"
                  />
                  {t('clearance.requiresFollowUp')}
                </label>

                {watch('follow_up_required') && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
                      {t('clearance.followUpNotes')}
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
                  {submitting ? (
                    <Spinner size={16} />
                  ) : (
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                      gavel
                    </span>
                  )}
                  {t('clearance.recordDecision')}
                </button>
              </form>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
