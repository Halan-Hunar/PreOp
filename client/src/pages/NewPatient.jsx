import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { createPatient } from '../api/patients'
import Spinner from '../components/Spinner'

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
  'w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all'

export default function NewPatient() {
  const navigate = useNavigate()
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
    // strip empty optional fields
    const payload = {}
    Object.entries(values).forEach(([k, v]) => {
      if (v !== '' && v !== undefined && v !== null) payload[k] = v
    })

    try {
      const result = await createPatient(payload)
      navigate(`/patients/${result.id}`)
    } catch (e) {
      setSubmitError(e.response?.data?.error || 'Failed to register patient')
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
          Back
        </button>
        <h1 className="text-3xl font-bold text-on-surface tracking-tight">Register New Patient</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Capture demographic and contact details before scheduling an evaluation.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-8 space-y-8"
      >
        <section>
          <h2 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">person</span>
            Patient Identity
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Full Name *" error={errors.full_name?.message} full>
              <input
                {...register('full_name', { required: 'Full name is required' })}
                className={inputClass}
                placeholder="e.g. Jonathan Smith"
              />
            </Field>
            <Field label="Date of Birth *" error={errors.dob?.message}>
              <input
                type="date"
                {...register('dob', { required: 'DOB is required' })}
                className={inputClass}
              />
            </Field>
            <Field label="Gender *" error={errors.gender?.message}>
              <select {...register('gender', { required: true })} className={inputClass}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </Field>
            <Field label="National ID">
              <input
                {...register('national_id')}
                className={inputClass}
                placeholder="National identification number"
              />
            </Field>
            <Field label="Blood Type">
              <select {...register('blood_type')} className={inputClass}>
                {BLOOD_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {b === 'unknown' ? 'Unknown' : b}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">contact_page</span>
            Contact
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Phone">
              <input {...register('phone')} className={inputClass} placeholder="+20 ..." />
            </Field>
            <Field label="Email">
              <input
                type="email"
                {...register('email')}
                className={inputClass}
                placeholder="patient@email.com"
              />
            </Field>
            <Field label="Address" full>
              <textarea
                {...register('address')}
                rows={2}
                className={inputClass}
                placeholder="Street, city, governorate"
              />
            </Field>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">emergency</span>
            Emergency Contact
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Field label="Name">
              <input {...register('emergency_contact_name')} className={inputClass} />
            </Field>
            <Field label="Phone">
              <input {...register('emergency_contact_phone')} className={inputClass} />
            </Field>
            <Field label="Relation">
              <input
                {...register('emergency_contact_relation')}
                className={inputClass}
                placeholder="Spouse, parent, etc."
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
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-secondary text-on-secondary rounded-lg font-semibold text-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? <Spinner size={16} /> : (
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
            )}
            Register Patient
          </button>
        </div>
      </form>
    </div>
  )
}
