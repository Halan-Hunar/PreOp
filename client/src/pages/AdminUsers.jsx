import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { listUsers, createUser, updateUser } from '../api/users'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import { useLanguage } from '../context/LanguageContext'

const inputClass =
  'w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all'

const ROLES = ['admin', 'anaesthetist', 'receptionist', 'nurse']

function RoleBadge({ role }) {
  const { t } = useLanguage()
  const map = {
    admin: 'bg-error-container text-on-error-container',
    anaesthetist: 'bg-secondary-container text-on-secondary-container',
    receptionist: 'bg-surface-container-high text-on-surface-variant',
    nurse: 'bg-warning-container text-on-warning-container',
  }
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
        map[role] || 'bg-surface-container-high'
      }`}
    >
      {t(`role.${role}`)}
    </span>
  )
}

export default function AdminUsers() {
  const { t, lang, formatName } = useLanguage()
  const localeTag = lang === 'ku' ? 'ku' : undefined
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await listUsers()
      setUsers(r.users || [])
    } catch (e) {
      setError(e.response?.data?.error || t('common.failedLoad'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleActive = async (u) => {
    const action = u.is_active ? t('admin.users.deactivate') : t('admin.users.activate')
    const displayName = formatName(u.name, u.role)
    if (!confirm(t('admin.users.toggleConfirm', { action, name: displayName }))) return
    try {
      await updateUser(u.id, { is_active: !u.is_active })
      load()
    } catch (e) {
      alert(e.response?.data?.error || t('admin.users.failedUpdate'))
    }
  }

  const countLabel =
    users.length === 1 ? t('admin.users.countOne') : t('admin.users.count', { count: users.length })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface tracking-tight">
            {t('admin.users.title')}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">{countLabel}</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2.5 bg-secondary text-on-secondary rounded-lg font-semibold text-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            person_add
          </span>
          {t('admin.users.new')}
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Spinner size={28} />
          </div>
        ) : error ? (
          <div className="p-6 bg-error-container text-on-error-container">{error}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-container-low border-b border-outline-variant text-xs uppercase tracking-wider text-on-surface-variant">
              <tr>
                <th className="px-6 py-4 text-start font-semibold">{t('common.name')}</th>
                <th className="px-6 py-4 text-start font-semibold">{t('common.email')}</th>
                <th className="px-6 py-4 text-start font-semibold">{t('common.role')}</th>
                <th className="px-6 py-4 text-start font-semibold">{t('common.status')}</th>
                <th className="px-6 py-4 text-start font-semibold">{t('common.lastLogin')}</th>
                <th className="px-6 py-4 text-end font-semibold">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4 font-semibold text-on-surface">
                    {formatName(u.name, u.role)}
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">{u.email}</td>
                  <td className="px-6 py-4">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs font-semibold ${
                        u.is_active ? 'text-on-success-container' : 'text-on-surface-variant'
                      }`}
                    >
                      {u.is_active ? `● ${t('common.active')}` : `○ ${t('common.inactive')}`}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-on-surface-variant">
                    {u.last_login
                      ? new Date(u.last_login).toLocaleString(localeTag)
                      : t('common.never')}
                  </td>
                  <td className="px-6 py-4 text-end space-x-3">
                    <button
                      onClick={() => setEditing(u)}
                      className="text-xs text-secondary font-semibold hover:underline"
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      onClick={() => toggleActive(u)}
                      className="text-xs text-on-surface-variant font-semibold hover:text-secondary hover:underline"
                    >
                      {u.is_active ? t('admin.users.deactivate') : t('admin.users.activate')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {createOpen && (
        <CreateUserModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            load()
          }}
        />
      )}

      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function CreateUserModal({ onClose, onSaved }) {
  const { t } = useLanguage()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { role: 'receptionist' },
  })
  const [err, setErr] = useState('')

  const onSubmit = async (values) => {
    setErr('')
    try {
      await createUser(values)
      onSaved()
    } catch (e) {
      setErr(e.response?.data?.error || t('admin.users.failedCreate'))
    }
  }

  return (
    <Modal open onClose={onClose} title={t('admin.users.create')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            {t('admin.users.fullName')}
          </label>
          <input
            {...register('name', { required: t('common.required') })}
            className={inputClass}
          />
          {errors.name && <p className="mt-1 text-xs text-error">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            {t('common.email')}
          </label>
          <input
            type="email"
            {...register('email', { required: t('common.required') })}
            className={inputClass}
          />
          {errors.email && <p className="mt-1 text-xs text-error">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            {t('admin.users.password')}
          </label>
          <input
            type="password"
            {...register('password', {
              required: t('common.required'),
              minLength: { value: 8, message: t('common.minLength', { min: 8 }) },
            })}
            className={inputClass}
          />
          {errors.password && <p className="mt-1 text-xs text-error">{errors.password.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            {t('common.role')}
          </label>
          <select {...register('role', { required: true })} className={inputClass}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`role.${r}`)}
              </option>
            ))}
          </select>
        </div>
        {err && (
          <div className="bg-error-container text-on-error-container px-3 py-2 rounded-lg text-sm">
            {err}
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-outline-variant rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-secondary text-on-secondary rounded-lg text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 flex items-center gap-2"
          >
            {isSubmitting ? <Spinner size={16} /> : null}
            {t('admin.users.create.button')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function EditUserModal({ user, onClose, onSaved }) {
  const { t, formatName } = useLanguage()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: !!user.is_active,
    },
  })
  const [err, setErr] = useState('')

  const onSubmit = async (values) => {
    setErr('')
    const payload = {}
    if (values.name !== user.name) payload.name = values.name
    if (values.email !== user.email) payload.email = values.email
    if (values.role !== user.role) payload.role = values.role
    if (values.is_active !== !!user.is_active) payload.is_active = values.is_active

    if (Object.keys(payload).length === 0) {
      onClose()
      return
    }

    try {
      await updateUser(user.id, payload)
      onSaved()
    } catch (e) {
      setErr(e.response?.data?.error || t('admin.users.failedUpdate'))
    }
  }

  return (
    <Modal open onClose={onClose} title={t('admin.users.edit', { name: formatName(user.name, user.role) })}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            {t('admin.users.fullName')}
          </label>
          <input
            {...register('name', { required: t('common.required') })}
            className={inputClass}
          />
          {errors.name && <p className="mt-1 text-xs text-error">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            {t('common.email')}
          </label>
          <input
            type="email"
            {...register('email', { required: t('common.required') })}
            className={inputClass}
          />
          {errors.email && <p className="mt-1 text-xs text-error">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            {t('common.role')}
          </label>
          <select {...register('role', { required: true })} className={inputClass}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`role.${r}`)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-on-surface-variant">{t('admin.users.roleChangeHint')}</p>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer text-on-surface">
          <input type="checkbox" {...register('is_active')} className="accent-secondary" />
          {t('admin.users.accountActive')}
        </label>
        <p className="text-xs text-on-surface-variant -mt-2">{t('admin.users.deactivateHint')}</p>

        {err && (
          <div className="bg-error-container text-on-error-container px-3 py-2 rounded-lg text-sm">
            {err}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-outline-variant rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-secondary text-on-secondary rounded-lg text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 flex items-center gap-2"
          >
            {isSubmitting ? (
              <Spinner size={16} />
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                save
              </span>
            )}
            {t('admin.users.saveChanges')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
