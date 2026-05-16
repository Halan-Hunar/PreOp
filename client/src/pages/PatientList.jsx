import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { listPatients } from '../api/patients'
import Spinner from '../components/Spinner'
import { useAuth } from '../context/AuthContext'

function calcAge(dob) {
  if (!dob) return ''
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
}

export default function PatientList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { hasRole } = useAuth()
  // Only front-desk staff register patients. Admins are read-only here,
  // anaesthetists view patients but don't create them.
  const canCreate = hasRole('receptionist', 'nurse')

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10))
  const [data, setData] = useState({ patients: [], total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await listPatients({ search: search || undefined, page, limit: 20 })
        if (!cancelled) setData(result)
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || 'Failed to load patients')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [search, page])

  const onSearch = (e) => {
    e.preventDefault()
    setPage(1)
    const params = {}
    if (search) params.search = search
    setSearchParams(params)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface tracking-tight">Patient Profiles</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {data.total} total patient{data.total === 1 ? '' : 's'}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => navigate('/patients/new')}
            className="px-4 py-2.5 bg-secondary text-on-secondary rounded-lg font-semibold text-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              person_add
            </span>
            Register Patient
          </button>
        )}
      </div>

      <form onSubmit={onSearch} className="relative max-w-md">
        <span
          className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
          style={{ fontSize: 20 }}
        >
          search
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, national ID or phone..."
          className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
        />
      </form>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Spinner size={28} />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-on-error-container bg-error-container">{error}</div>
        ) : data.patients.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-outline-variant" style={{ fontSize: 48 }}>
              person_search
            </span>
            <p className="text-on-surface-variant mt-2">No patients found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  <th className="px-6 py-4">Patient</th>
                  <th className="px-6 py-4">Age / Sex</th>
                  <th className="px-6 py-4">National ID</th>
                  <th className="px-6 py-4">Blood</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Registered</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant text-sm">
                {data.patients.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/patients/${p.id}`)}
                    className="cursor-pointer hover:bg-surface-container-low transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-on-surface">{p.full_name}</p>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant capitalize">
                      {calcAge(p.dob)}y • {p.gender}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-on-surface-variant">
                      {p.national_id || '—'}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant uppercase">
                      {p.blood_type === 'unknown' ? '—' : p.blood_type || '—'}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">
                      <p>{p.phone || '—'}</p>
                      {p.email && <p className="text-xs">{p.email}</p>}
                    </td>
                    <td className="px-6 py-4 text-xs text-on-surface-variant">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="material-symbols-outlined text-outline-variant group-hover:text-secondary">
                        chevron_right
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-on-surface-variant">
            Page {data.page} of {data.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm disabled:opacity-50 hover:bg-surface-container-high transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages}
              className="px-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm disabled:opacity-50 hover:bg-surface-container-high transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
