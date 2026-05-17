import { Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './Sidebar'
import NotificationsBell from './NotificationsBell'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

function initials(name) {
  if (!name) return '??'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('')
}

export default function Layout() {
  const { user, logout, hasRole } = useAuth()
  const { t, formatName } = useLanguage()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')

  const onSearchSubmit = (e) => {
    e.preventDefault()
    if (search.trim()) {
      navigate(`/patients?search=${encodeURIComponent(search.trim())}`)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const canStartEvaluation = hasRole('anaesthetist')
  const roleLabel = user?.role ? t(`role.${user.role}`) : ''

  return (
    <div className="min-h-screen bg-background text-on-background">
      <Sidebar />

      <div className="ms-[280px] flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex justify-between items-center px-8 h-16 bg-surface border-b border-outline-variant">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-extrabold text-on-background">{t('header.title')}</h2>
            <form onSubmit={onSearchSubmit} className="relative">
              <span
                className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
                style={{ fontSize: 20 }}
              >
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('header.searchPlaceholder')}
                className="ps-10 pe-4 py-2 bg-surface-container-low border border-outline-variant rounded-full w-80 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all"
              />
            </form>
          </div>

          <div className="flex items-center gap-3">
            <NotificationsBell />
            {canStartEvaluation && (
              <button
                onClick={() => navigate('/patients')}
                className="px-4 py-2 bg-secondary text-on-secondary rounded-lg font-semibold text-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  add
                </span>
                {t('header.newEvaluation')}
              </button>
            )}

            <div className="relative ps-3 ms-1 border-s border-outline-variant">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-3 hover:bg-surface-container-high rounded-lg py-1 px-2 transition-colors"
              >
                <div className="text-end hidden md:block">
                  <p className="text-sm font-semibold text-on-surface leading-tight">
                    {formatName(user?.name, user?.role)}
                  </p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">
                    {roleLabel}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-semibold text-sm">
                  {initials(user?.name)}
                </div>
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute end-0 mt-2 w-48 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-lg overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-outline-variant">
                      <p className="text-sm font-semibold text-on-surface truncate">
                        {formatName(user?.name, user?.role)}
                      </p>
                      <p className="text-xs text-on-surface-variant truncate">
                        {user?.email}
                      </p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-start px-4 py-3 text-sm text-on-surface hover:bg-surface-container-high flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                        logout
                      </span>
                      {t('common.signOut')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
