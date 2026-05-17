import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { changePassword } from '../api/users'
import Spinner from '../components/Spinner'

const inputClass =
  'w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all'

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
  const { t, lang, setLang, formatName } = useLanguage()
  const { theme, setTheme } = useTheme()
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
      setError(t('settings.passwordMismatch'))
      return
    }

    try {
      await changePassword(values.current_password, values.new_password)
      reset()
      setSuccess(t('settings.passwordChanged'))
      setTimeout(async () => {
        await logout()
        navigate('/login', { replace: true })
      }, 1500)
    } catch (e) {
      setError(e.response?.data?.error || t('settings.failedPassword'))
    }
  }

  const roleLabel = user?.role ? t(`role.${user.role}`) : ''

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-on-surface tracking-tight">{t('settings.title')}</h1>
        <p className="text-sm text-on-surface-variant mt-1">{t('settings.subtitle')}</p>
      </div>

      <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary">person</span>
          <h2 className="text-base font-semibold text-on-surface">{t('settings.profile')}</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <ProfileRow label={t('common.name')} value={formatName(user?.name, user?.role)} />
          <ProfileRow label={t('common.email')} value={user?.email} />
          <ProfileRow label={t('common.role')} value={roleLabel} />
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary">tune</span>
          <h2 className="text-base font-semibold text-on-surface">{t('settings.preferences')}</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-on-surface">{t('settings.language')}</p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {t('settings.languageHint')}
              </p>
            </div>
            <div className="inline-flex bg-surface-container-high rounded-full p-1">
              <button
                onClick={() => setLang('en')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                  lang === 'en'
                    ? 'bg-secondary text-on-secondary shadow-sm'
                    : 'text-on-surface-variant hover:text-secondary'
                }`}
              >
                {t('lang.english')}
              </button>
              <button
                onClick={() => setLang('ku')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                  lang === 'ku'
                    ? 'bg-secondary text-on-secondary shadow-sm'
                    : 'text-on-surface-variant hover:text-secondary'
                }`}
              >
                {t('lang.kurdish')}
              </button>
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 flex-wrap pt-6 border-t border-outline-variant">
            <div>
              <p className="text-sm font-semibold text-on-surface">{t('settings.theme')}</p>
              <p className="text-xs text-on-surface-variant mt-0.5">{t('settings.themeHint')}</p>
            </div>
            <div className="inline-flex bg-surface-container-high rounded-full p-1">
              <button
                onClick={() => setTheme('light')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors inline-flex items-center gap-2 ${
                  theme === 'light'
                    ? 'bg-secondary text-on-secondary shadow-sm'
                    : 'text-on-surface-variant hover:text-secondary'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  light_mode
                </span>
                {t('settings.themeLight')}
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors inline-flex items-center gap-2 ${
                  theme === 'dark'
                    ? 'bg-secondary text-on-secondary shadow-sm'
                    : 'text-on-surface-variant hover:text-secondary'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  dark_mode
                </span>
                {t('settings.themeDark')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary">lock</span>
          <h2 className="text-base font-semibold text-on-surface">{t('settings.password')}</h2>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5 max-w-md">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              {t('settings.currentPassword')}
            </label>
            <input
              type="password"
              autoComplete="current-password"
              {...register('current_password', { required: t('common.required') })}
              className={inputClass}
            />
            {errors.current_password && (
              <p className="mt-1 text-xs text-error">{errors.current_password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              {t('settings.newPassword')}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              {...register('new_password', {
                required: t('common.required'),
                minLength: { value: 8, message: t('common.minLength', { min: 8 }) },
              })}
              className={inputClass}
            />
            {errors.new_password && (
              <p className="mt-1 text-xs text-error">{errors.new_password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              {t('settings.confirmPassword')}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              {...register('confirm_password', { required: t('common.required') })}
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
            {isSubmitting ? (
              <Spinner size={16} />
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                save
              </span>
            )}
            {t('settings.updatePassword')}
          </button>

          <p className="text-xs text-on-surface-variant">{t('settings.passwordHint')}</p>
        </form>
      </section>

      <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary">logout</span>
          <h2 className="text-base font-semibold text-on-surface">{t('settings.session')}</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-on-surface">{t('settings.signOutTitle')}</p>
              <p className="text-xs text-on-surface-variant mt-0.5">{t('settings.signOutHint')}</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await logout()
                navigate('/login', { replace: true })
              }}
              className="px-5 py-2.5 border border-error text-error rounded-lg font-semibold text-sm hover:bg-error-container/40 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                logout
              </span>
              {t('common.signOut')}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
