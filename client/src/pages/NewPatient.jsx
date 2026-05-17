import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { createPatient } from '../api/patients'
import Spinner from '../components/Spinner'
import { useLanguage } from '../context/LanguageContext'

const BLOOD_TYPES = ['unknown', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

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

const inputClass =
  'w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all'

export default function NewPatient() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      blood_type: 'unknown',
      gender: 'male',
    },
  })
  const [submitError, setSubmitError] = useState('')

  const onSubmit = async (values) => {
    setSubmitError('')
    const payload = {}
    Object.entries(values).forEach(([k, v]) => {
      if (v !== '' && v !== undefined && v !== null) payload[k] = v
    })

    try {
      const result = await createPatient(payload)
      navigate(`/patients/${result.id}`)
    } catch (e) {
      setSubmitError(e.response?.data?.error || t('newPatient.failed'))
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-on-surface-variant hover:text-secondary inline-flex items-center gap-1 mb-3"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            arrow_back
          </span>
          {t('common.back')}
        </button>
        <h1 className="text-3xl font-bold text-on-surface tracking-tight">
          {t('newPatient.title')}
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">{t('newPatient.subtitle')}</p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-8 space-y-8"
      >
        <section>
          <h2 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">person</span>
            {t('newPatient.section.identity')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label={`${t('newPatient.fullName')} *`} error={errors.full_name?.message} full>
              <input
                {...register('full_name', { required: t('newPatient.fullNameRequired') })}
                className={inputClass}
                placeholder={t('newPatient.fullNamePlaceholder')}
              />
            </Field>
            <Field label={`${t('newPatient.dob')} *`} error={errors.dob?.message}>
              <input
                type="date"
                {...register('dob', { required: t('newPatient.dobRequired') })}
                className={inputClass}
              />
            </Field>
            <Field label={`${t('newPatient.gender')} *`} error={errors.gender?.message}>
              <select {...register('gender', { required: true })} className={inputClass}>
                <option value="male">{t('gender.male')}</option>
                <option value="female">{t('gender.female')}</option>
              </select>
            </Field>
            <Field label={t('newPatient.nationalId')}>
              <input
                {...register('national_id')}
                className={inputClass}
                placeholder={t('newPatient.nationalIdPlaceholder')}
              />
            </Field>
            <Field label={t('newPatient.bloodType')}>
              <select {...register('blood_type')} className={inputClass}>
                {BLOOD_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {b === 'unknown' ? t('blood.unknown') : b}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">contact_page</span>
            {t('newPatient.section.contact')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label={t('newPatient.phone')}>
              <input {...register('phone')} className={inputClass} />
            </Field>
            <Field label={t('newPatient.email')}>
              <input
                type="email"
                {...register('email')}
                className={inputClass}
                placeholder={t('newPatient.emailPlaceholder')}
              />
            </Field>
            <Field label={t('newPatient.address')} full>
              <textarea
                {...register('address')}
                rows={2}
                className={inputClass}
                placeholder={t('newPatient.addressPlaceholder')}
              />
            </Field>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">emergency</span>
            {t('newPatient.section.emergency')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Field label={t('newPatient.ecName')}>
              <input {...register('emergency_contact_name')} className={inputClass} />
            </Field>
            <Field label={t('newPatient.ecPhone')}>
              <input {...register('emergency_contact_phone')} className={inputClass} />
            </Field>
            <Field label={t('newPatient.ecRelation')}>
              <input
                {...register('emergency_contact_relation')}
                className={inputClass}
                placeholder={t('newPatient.ecRelationPlaceholder')}
              />
            </Field>
          </div>
        </section>

        {submitError && (
          <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              error
            </span>
            {submitError}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 border border-outline-variant rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-secondary text-on-secondary rounded-lg font-semibold text-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? (
              <Spinner size={16} />
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                save
              </span>
            )}
            {t('newPatient.register')}
          </button>
        </div>
      </form>
    </div>
  )
}
