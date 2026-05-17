import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import Spinner from '../components/Spinner'

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth()
  const { t, lang, setLang } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  if (isAuthenticated) {
    return <Navigate to={location.state?.from?.pathname || '/'} replace />
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
      navigate(location.state?.from?.pathname || '/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || t('auth.errorGeneric'))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-on-background px-4 py-12">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-secondary-container/30 via-background to-surface-container-high/40 pointer-events-none" />

      {/* Pre-auth controls: language + theme toggle, top-right (start-aligned in RTL). */}
      <div className="absolute top-6 end-6 flex items-center gap-2">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-full p-1 flex items-center">
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
              lang === 'en'
                ? 'bg-secondary text-on-secondary'
                : 'text-on-surface-variant hover:text-secondary'
            }`}
          >
            {t('lang.english')}
          </button>
          <button
            onClick={() => setLang('ku')}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
              lang === 'ku'
                ? 'bg-secondary text-on-secondary'
                : 'text-on-surface-variant hover:text-secondary'
            }`}
          >
            {t('lang.kurdish')}
          </button>
        </div>
        <button
          onClick={toggleTheme}
          aria-label={t('settings.theme')}
          className="w-9 h-9 rounded-full bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:text-secondary transition-colors flex items-center justify-center"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
      </div>

      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center text-on-secondary shadow-md">
            <span className="material-symbols-outlined" style={{ fontSize: 28 }}>
              medical_services
            </span>
          </div>
          <div className="text-start">
            <h1 className="text-2xl font-bold text-on-surface leading-tight">
              {t('auth.brandTitle')}
            </h1>
            <p className="text-xs text-on-surface-variant">{t('auth.brandSubtitle')}</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-8">
          <h2 className="text-2xl font-semibold text-on-surface mb-2">{t('auth.title')}</h2>
          <p className="text-sm text-on-surface-variant mb-6">{t('auth.subtitle')}</p>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2"
              >
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder={t('auth.emailPlaceholder')}
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2"
              >
                {t('auth.password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all"
              />
            </div>

            {error && (
              <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  error
                </span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-secondary text-on-secondary rounded-lg font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <Spinner size={18} /> : t('auth.signInButton')}
            </button>
          </form>
        </div>

        <p className="text-xs text-center text-on-surface-variant mt-6">{t('auth.footer')}</p>
      </div>
    </div>
  )
}
