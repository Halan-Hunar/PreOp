import { useEffect, useState } from 'react'
import { listActivityLogs } from '../api/users'
import Spinner from '../components/Spinner'
import { useLanguage } from '../context/LanguageContext'

const ACTION_ICONS = {
  login: 'login',
  logout: 'logout',
  create_patient: 'person_add',
  update_patient: 'edit',
  delete_patient: 'person_remove',
  create_appointment: 'event_available',
  update_appointment: 'event_repeat',
  create_assessment: 'note_add',
  update_assessment: 'edit_note',
  submit_assessment: 'send',
  delete_assessment: 'delete',
  create_user: 'manage_accounts',
  update_user: 'manage_accounts',
  assign_doctor: 'assignment_ind',
  record_clock_in: 'login',
  clearance_cleared: 'check_circle',
  clearance_conditional: 'warning',
  clearance_not_cleared: 'block',
}

export default function AdminLogs() {
  const { t, lang, formatName } = useLanguage()
  const localeTag = lang === 'ku' ? 'ku' : undefined
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const r = await listActivityLogs({ page, limit: 50 })
        if (!cancelled) setLogs(r.logs || [])
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || t('common.failedLoad'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [page, t])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-on-surface tracking-tight">
          {t('admin.logs.title')}
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">{t('admin.logs.subtitle')}</p>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Spinner size={28} />
          </div>
        ) : error ? (
          <div className="p-6 bg-error-container text-on-error-container">{error}</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant">{t('admin.logs.empty')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-container-low border-b border-outline-variant text-xs uppercase tracking-wider text-on-surface-variant">
              <tr>
                <th className="px-6 py-4 text-start font-semibold">{t('admin.logs.when')}</th>
                <th className="px-6 py-4 text-start font-semibold">{t('admin.logs.user')}</th>
                <th className="px-6 py-4 text-start font-semibold">{t('admin.logs.action')}</th>
                <th className="px-6 py-4 text-start font-semibold">{t('admin.logs.target')}</th>
                <th className="px-6 py-4 text-start font-semibold">{t('admin.logs.ip')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4 text-xs text-on-surface-variant tabular-nums">
                    {new Date(l.created_at).toLocaleString(localeTag)}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-on-surface">
                      {l.user_name ? formatName(l.user_name, l.user_role) : '—'}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {l.user_role ? t(`role.${l.user_role}`) : ''}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-2 text-on-surface">
                      <span
                        className="material-symbols-outlined text-secondary"
                        style={{ fontSize: 18 }}
                      >
                        {ACTION_ICONS[l.action] || 'bolt'}
                      </span>
                      <span className="font-medium">{l.action.replace(/_/g, ' ')}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-on-surface-variant font-mono">
                    {l.target_table ? `${l.target_table}#${l.target_id}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-xs text-on-surface-variant font-mono">
                    {l.ip_address || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-on-surface-variant">
          {t('common.page')} {page}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface disabled:opacity-50 hover:bg-surface-container-high transition-colors"
          >
            {t('common.previous')}
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={logs.length < 50}
            className="px-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface disabled:opacity-50 hover:bg-surface-container-high transition-colors"
          >
            {t('common.next')}
          </button>
        </div>
      </div>
    </div>
  )
}
