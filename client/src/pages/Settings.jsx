import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import { changePassword } from '../api/users'
import Spinner from '../components/Spinner'

const inputClass =
  'w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all'

function ProfileRow({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-outline mb-1">
        {label}
      </p>
      <p className="text-sm text-on-surface">{value || '—'}</p>
    </div>
  )
}

export default function Settings() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (values) => {
    setError('')
    setSuccess('')

    if (values.new_password !== values.confirm_password) {
      setError('New password and confirmation do not match.')
      return
    }

    try {
      await changePassword(values.current_password, values.new_password)
      reset()
      setSuccess('Password changed. You will be signed out in a moment.')
      setTimeout(async () => {
        await logout()
        navigate('/login', { replace: true })
      }, 1500)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to change password')
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-on-surface tracking-tight">Settings</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Manage your account and security preferences.
        </p>
      </div>

      <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary">person</span>
          <h2 className="text-base font-semibold text-on-surface">Profile</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <ProfileRow label="Name" value={user?.name} />
          <ProfileRow label="Email" value={user?.email} />
          <ProfileRow label="Role" value={user?.role && user.role.charAt(0).toUpperCase() + user.role.slice(1)} />
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary">lock</span>
          <h2 className="text-base font-semibold text-on-surface">Change Password</h2>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5 max-w-md">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              Current Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              {...register('current_password', { required: 'Required' })}
              className={inputClass}
            />
            {errors.current_password && (
              <p className="mt-1 text-xs text-error">{errors.current_password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              New Password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              {...register('new_password', {
                required: 'Required',
                minLength: { value: 8, message: 'Must be at least 8 characters' },
              })}
              className={inputClass}
            />
            {errors.new_password && (
              <p className="mt-1 text-xs text-error">{errors.new_password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              {...register('confirm_password', { required: 'Required' })}
              className={inputClass}
            />
            {errors.confirm_password && (
              <p className="mt-1 text-xs text-error">{errors.confirm_password.message}</p>
            )}
          </div>

          {error && (
            <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                error
              </span>
              {error}
            </div>
          )}

          {success && (
            <div className="bg-secondary-container text-on-secondary-container px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                check_circle
              </span>
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !!success}
            className="px-5 py-2.5 bg-secondary text-on-secondary rounded-lg font-semibold text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 flex items-center gap-2"
          >
            {isSubmitting ? <Spinner size={16} /> : (
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
            )}
            Update Password
          </button>

          <p className="text-xs text-on-surface-variant">
            Changing your password signs you out of all sessions including this one.
          </p>
        </form>
      </section>
    </div>
  )
}
