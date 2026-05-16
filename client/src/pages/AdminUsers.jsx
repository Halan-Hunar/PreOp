import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { listUsers, createUser, updateUser } from '../api/users'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

const inputClass =
  'w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all'

const ROLES = ['admin', 'anaesthetist', 'receptionist', 'nurse']

function RoleBadge({ role }) {
  const map = {
    admin: 'bg-error-container text-on-error-container',
    anaesthetist: 'bg-secondary-container text-on-secondary-container',
    receptionist: 'bg-surface-container-high text-on-surface-variant',
    nurse: 'bg-warning-container text-on-warning-container',
  }
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${map[role] || 'bg-surface-container-high'}`}
    >
      {role}
    </span>
  )
}

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState(null) // user object or null

  const load = async () => {
    setLoading(true)
    try {
      const r = await listUsers()
      setUsers(r.users || [])
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const toggleActive = async (u) => {
    if (!confirm(`${u.is_active ? 'Deactivate' : 'Activate'} ${u.name}?`)) return
    try {
      await updateUser(u.id, { is_active: !u.is_active })
      load()
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to update user')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface tracking-tight">Staff Accounts</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {users.length} user{users.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2.5 bg-secondary text-on-secondary rounded-lg font-semibold text-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person_add</span>
          New Staff Account
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
                <th className="px-6 py-4 text-left font-semibold">Name</th>
                <th className="px-6 py-4 text-left font-semibold">Email</th>
                <th className="px-6 py-4 text-left font-semibold">Role</th>
                <th className="px-6 py-4 text-left font-semibold">Status</th>
                <th className="px-6 py-4 text-left font-semibold">Last Login</th>
                <th className="px-6 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4 font-semibold text-on-surface">{u.name}</td>
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
                      {u.is_active ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-on-surface-variant">
                    {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <button
                      onClick={() => setEditing(u)}
                      className="text-xs text-secondary font-semibold hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(u)}
                      className="text-xs text-on-surface-variant font-semibold hover:text-secondary hover:underline"
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
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
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { role: 'receptionist' },
  })
  const [err, setErr] = useState('')

  const onSubmit = async (values) => {
    setErr('')
    try {
      await createUser(values)
      onSaved()
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to create user')
    }
  }

  return (
    <Modal open onClose={onClose} title="Create Staff Account">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            Full Name
          </label>
          <input
            {...register('name', { required: 'Required' })}
            className={inputClass}
          />
          {errors.name && <p className="mt-1 text-xs text-error">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            Email
          </label>
          <input
            type="email"
            {...register('email', { required: 'Required' })}
            className={inputClass}
          />
          {errors.email && <p className="mt-1 text-xs text-error">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            Password (min 8)
          </label>
          <input
            type="password"
            {...register('password', { required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } })}
            className={inputClass}
          />
          {errors.password && <p className="mt-1 text-xs text-error">{errors.password.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            Role
          </label>
          <select {...register('role', { required: true })} className={inputClass}>
            {ROLES.map((r) => (
              <option key={r} value={r} className="capitalize">
                {r}
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
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-secondary text-on-secondary rounded-lg text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 flex items-center gap-2"
          >
            {isSubmitting ? <Spinner size={16} /> : null}
            Create
          </button>
        </div>
      </form>
    </Modal>
  )
}

function EditUserModal({ user, onClose, onSaved }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
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
    // Only send fields that actually changed — keeps the audit log clean.
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
      setErr(e.response?.data?.error || 'Failed to update user')
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit ${user.name}`}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            Full Name
          </label>
          <input
            {...register('name', { required: 'Required' })}
            className={inputClass}
          />
          {errors.name && <p className="mt-1 text-xs text-error">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            Email
          </label>
          <input
            type="email"
            {...register('email', { required: 'Required' })}
            className={inputClass}
          />
          {errors.email && <p className="mt-1 text-xs text-error">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            Role
          </label>
          <select {...register('role', { required: true })} className={inputClass}>
            {ROLES.map((r) => (
              <option key={r} value={r} className="capitalize">
                {r}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-on-surface-variant">
            Changing role takes effect immediately.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer text-on-surface">
          <input
            type="checkbox"
            {...register('is_active')}
            className="accent-secondary"
          />
          Account active
        </label>
        <p className="text-xs text-on-surface-variant -mt-2">
          Deactivating ends all of this user's open sessions immediately.
        </p>

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
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-secondary text-on-secondary rounded-lg text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 flex items-center gap-2"
          >
            {isSubmitting ? <Spinner size={16} /> : (
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
            )}
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  )
}
