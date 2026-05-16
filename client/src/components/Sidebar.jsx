import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const DASH = { to: '/', label: 'Dashboard', icon: 'dashboard', end: true }
const PATIENTS = { to: '/patients', label: 'Patient Profiles', icon: 'group' }
const APPOINTMENTS = { to: '/appointments', label: 'Surgical Schedule', icon: 'calendar_month' }
const ATTENDANCE = { to: '/attendance', label: 'Staff Attendance', icon: 'badge' }
const REPORTS = { to: '/reports', label: 'Reports', icon: 'analytics' }

// role -> nav items shown in the main section
const NAV_BY_ROLE = {
  admin: [DASH],
  anaesthetist: [DASH, PATIENTS, APPOINTMENTS],
  receptionist: [DASH, PATIENTS, APPOINTMENTS],
  nurse: [DASH, PATIENTS, APPOINTMENTS],
}

// Sections that appear below the primary nav, keyed by role.
const STAFF_SECTION = {
  admin: [ATTENDANCE],
  receptionist: [ATTENDANCE],
  nurse: [],
  anaesthetist: [],
}

const ADMIN_ITEMS = [
  { to: '/admin/users', label: 'Staff Accounts', icon: 'manage_accounts' },
  { to: '/admin/logs', label: 'Activity Logs', icon: 'fact_check' },
  REPORTS,
]

function Item({ to, label, icon, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-6 py-3 transition-all cursor-pointer ${
          isActive
            ? 'text-secondary font-bold border-r-4 border-secondary bg-surface-container-high'
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
  const navigate = useNavigate()
  const isAdmin = hasRole('admin')
  const navItems = NAV_BY_ROLE[user?.role] || []
  const staffItems = STAFF_SECTION[user?.role] || []

  return (
    <aside className="fixed left-0 top-0 h-full w-[280px] bg-surface-container-low border-r border-outline-variant flex flex-col z-40">
      <div className="px-6 py-5 flex items-center gap-3 border-b border-outline-variant">
        <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center text-on-secondary shrink-0">
          <span className="material-symbols-outlined">medical_services</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-on-surface truncate">PreOp Clinic</h1>
          <p className="text-xs text-on-surface-variant">ENT Surgical Services</p>
        </div>
      </div>

      <nav className="flex-1 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => (
          <Item key={item.to} {...item} />
        ))}

        {staffItems.length > 0 && (
          <>
            <div className="px-6 pt-6 pb-2 text-xs font-semibold uppercase tracking-wider text-outline">
              Staff
            </div>
            {staffItems.map((item) => (
              <Item key={item.to} {...item} />
            ))}
          </>
        )}

        {isAdmin && (
          <>
            <div className="px-6 pt-6 pb-2 text-xs font-semibold uppercase tracking-wider text-outline">
              Admin
            </div>
            {ADMIN_ITEMS.map((item) => (
              <Item key={item.to} {...item} />
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
          Settings
        </button>
        <div className="flex items-center gap-3 px-6 py-3 text-on-surface-variant hover:text-secondary transition-colors cursor-pointer text-sm">
          <span className="material-symbols-outlined">help</span>
          Support
        </div>
      </div>
    </aside>
  )
}
