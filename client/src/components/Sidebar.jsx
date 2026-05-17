import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

const DASH = { to: '/', labelKey: 'sidebar.dashboard', icon: 'dashboard', end: true }
const PATIENTS = { to: '/patients', labelKey: 'sidebar.patients', icon: 'group' }
const APPOINTMENTS = { to: '/appointments', labelKey: 'sidebar.schedule', icon: 'calendar_month' }
const ATTENDANCE = { to: '/attendance', labelKey: 'sidebar.attendance', icon: 'badge' }
const REPORTS = { to: '/reports', labelKey: 'sidebar.reports', icon: 'analytics' }

// role -> nav items shown in the main section
const NAV_BY_ROLE = {
  admin: [DASH, REPORTS],
  anaesthetist: [DASH, PATIENTS, APPOINTMENTS],
  receptionist: [DASH, PATIENTS, APPOINTMENTS, REPORTS],
  nurse: [DASH, PATIENTS, APPOINTMENTS],
}

const STAFF_SECTION = {
  admin: [ATTENDANCE],
  receptionist: [ATTENDANCE],
  nurse: [],
  anaesthetist: [],
}

const ADMIN_ITEMS = [
  { to: '/admin/users', labelKey: 'sidebar.staffAccounts', icon: 'manage_accounts' },
  { to: '/admin/logs', labelKey: 'sidebar.activityLogs', icon: 'fact_check' },
]

function Item({ to, label, icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-6 py-3 transition-all cursor-pointer ${
          isActive
            ? 'text-secondary font-bold border-e-4 border-secondary bg-surface-container-high'
            : 'text-on-surface-variant hover:text-secondary hover:bg-surface-container-high'
        }`
      }
    >
      <span className="material-symbols-outlined">{icon}</span>
      <span className="text-sm">{label}</span>
    </NavLink>
  )
}

export default function Sidebar() {
  const { user, hasRole } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const isAdmin = hasRole('admin')
  const navItems = NAV_BY_ROLE[user?.role] || []
  const staffItems = STAFF_SECTION[user?.role] || []

  return (
    <aside className="fixed start-0 top-0 h-full w-[280px] bg-surface-container-low border-e border-outline-variant flex flex-col z-40">
      <div className="px-6 py-5 flex items-center gap-3 border-b border-outline-variant">
        <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center text-on-secondary shrink-0">
          <span className="material-symbols-outlined">medical_services</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-on-surface truncate">{t('sidebar.brand')}</h1>
          <p className="text-xs text-on-surface-variant">{t('sidebar.subtitle')}</p>
        </div>
      </div>

      <nav className="flex-1 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => (
          <Item key={item.to} {...item} label={t(item.labelKey)} />
        ))}

        {staffItems.length > 0 && (
          <>
            <div className="px-6 pt-6 pb-2 text-xs font-semibold uppercase tracking-wider text-outline">
              {t('sidebar.sectionStaff')}
            </div>
            {staffItems.map((item) => (
              <Item key={item.to} {...item} label={t(item.labelKey)} />
            ))}
          </>
        )}

        {isAdmin && (
          <>
            <div className="px-6 pt-6 pb-2 text-xs font-semibold uppercase tracking-wider text-outline">
              {t('sidebar.sectionAdmin')}
            </div>
            {ADMIN_ITEMS.map((item) => (
              <Item key={item.to} {...item} label={t(item.labelKey)} />
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-outline-variant py-3">
        <button
          onClick={() => navigate('/settings')}
          className="w-full flex items-center gap-3 px-6 py-3 text-on-surface-variant hover:text-secondary hover:bg-surface-container-high transition-colors text-sm"
        >
          <span className="material-symbols-outlined">settings</span>
          {t('sidebar.settings')}
        </button>
        <div className="flex items-center gap-3 px-6 py-3 text-on-surface-variant hover:text-secondary transition-colors cursor-pointer text-sm">
          <span className="material-symbols-outlined">help</span>
          {t('sidebar.support')}
        </div>
      </div>
    </aside>
  )
}
