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
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${map[role] || 'bg-surface-container-high'}`}>
      {role}
    </span>
  )
}

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [submitErr, setSubmitErr] = useState('')

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { role: 'receptionist' },
  })

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

  const onCreate = async (values) => {
    setSubmitErr('')
    try {
      await createUser(values)
      setModalOpen(false)
      reset()
      load()
    } catch (e) {
      setSubmitErr(e.response?.data?.error || 'Failed to create user')
    }
  }

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
          onClick={() => setModalOpen(true)}
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
                <th className="px-6 py-4"></th>
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
                    <span className={`text-xs font-semibold ${u.is_active ? 'text-on-success-container' : 'text-on-surface-variant'}`}>
                      {u.is_active ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-on-surface-variant">
                    {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => toggleActive(u)}
                      className="text-xs text-secondary font-semibold hover:underline"
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Staff Account"
      >
        <form id="user-form" onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              Full Name
            </label>
            <input {...register('name', { required: true })} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              Email
            </label>
            <input type="email" {...register('email', { required: true })} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              Password (min 8)
            </label>
            <input type="password" {...register('password', { required: true, minLength: 8 })} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              Role
            </label>
            <select {...register('role', { required: true })} className={inputClass}>
              {ROLES.map((r) => (
                <option key={r} value={r} className="capitalize">{r}</option>
              ))}
            </select>
          </div>
          {submitErr && (
            <div className="bg-error-container text-on-error-container px-3 py-2 rounded-lg text-sm">
              {submitErr}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
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
    </div>
  )
}
