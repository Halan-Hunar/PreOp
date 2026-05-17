import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  getAttendance,
  recordAttendance,
  updateAttendance,
  clockOut,
} from '../api/attendance'
import { listUsers } from '../api/users'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import { useLanguage } from '../context/LanguageContext'

const inputClass =
  'w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function fmtTime(t) {
  if (!t) return '—'
  return t.slice(0, 5)
}

function fmtHours(hms) {
  if (!hms) return '—'
  const [h, m] = hms.split(':')
  return `${parseInt(h, 10)}h ${parseInt(m, 10)}m`
}

export default function Attendance() {
  const { t, lang, formatName } = useLanguage()
  const localeTag = lang === 'ku' ? 'ku' : undefined

  const [date, setDate] = useState(todayIso())
  const [staffFilter, setStaffFilter] = useState('')
  const [users, setUsers] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)

  const loadUsers = async () => {
    try {
      const r = await listUsers({ active: 'true' })
      setUsers(r.users || [])
    } catch (_e) {
      /* non-fatal */
    }
  }

  const month = parseInt(date.slice(5, 7), 10)
  const year = parseInt(date.slice(0, 4), 10)

  const loadRecords = async () => {
    setLoading(true)
    setError('')
    try {
      const params = { month, year }
      if (staffFilter) params.user_id = staffFilter
      const r = await getAttendance(params)
      setRecords(r.records || [])
    } catch (e) {
      setError(e.response?.data?.error || t('common.failedLoad'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, staffFilter])

  const dayRecords = useMemo(
    () => records.filter((r) => (r.work_date || '').slice(0, 10) === date),
    [records, date]
  )

  const dayLabel = new Date(date + 'T00:00:00').toLocaleDateString(localeTag, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const countLabel =
    dayRecords.length === 1
      ? t('attendance.recordsCountOne')
      : t('attendance.recordsCount', { count: dayRecords.length })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface tracking-tight">
            {t('attendance.title')}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">{t('attendance.subtitle')}</p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="px-4 py-2.5 bg-secondary text-on-secondary rounded-lg font-semibold text-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            more_time
          </span>
          {t('attendance.record')}
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            {t('attendance.date')}
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${inputClass} max-w-[200px]`}
          />
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            {t('attendance.staffMember')}
          </label>
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className={inputClass}
          >
            <option value="">{t('attendance.allStaff')}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {formatName(u.name, u.role)} — {t(`role.${u.role}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
          <h2 className="text-base font-semibold text-on-surface">{dayLabel}</h2>
          <span className="text-xs text-on-surface-variant">{countLabel}</span>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Spinner size={28} />
          </div>
        ) : error ? (
          <div className="p-6 bg-error-container text-on-error-container">{error}</div>
        ) : dayRecords.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant">{t('attendance.empty')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-container-low border-b border-outline-variant text-xs uppercase tracking-wider text-on-surface-variant">
              <tr>
                <th className="px-6 py-4 text-start font-semibold">{t('attendance.staff')}</th>
                <th className="px-6 py-4 text-start font-semibold">{t('common.role')}</th>
                <th className="px-6 py-4 text-start font-semibold">{t('attendance.date')}</th>
                <th className="px-6 py-4 text-start font-semibold">{t('attendance.timeIn')}</th>
                <th className="px-6 py-4 text-start font-semibold">{t('attendance.timeOut')}</th>
                <th className="px-6 py-4 text-start font-semibold">{t('attendance.hours')}</th>
                <th className="px-6 py-4 text-end font-semibold">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {dayRecords.map((r) => (
                <tr key={r.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4 font-semibold text-on-surface">
                    {r.staff_name ? formatName(r.staff_name, r.staff_role) : '—'}
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">
                    {r.staff_role ? t(`role.${r.staff_role}`) : ''}
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant tabular-nums">
                    {(r.work_date || '').slice(0, 10)}
                  </td>
                  <td className="px-6 py-4 font-mono tabular-nums text-on-surface">
                    {fmtTime(r.time_in)}
                  </td>
                  <td className="px-6 py-4 font-mono tabular-nums text-on-surface">
                    {r.time_out ? (
                      fmtTime(r.time_out)
                    ) : (
                      <span className="text-warning font-semibold">
                        {t('attendance.stillIn')}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 tabular-nums text-on-surface">
                    {fmtHours(r.hours_worked)}
                  </td>
                  <td className="px-6 py-4 text-end space-x-3">
                    {!r.time_out && (
                      <button
                        onClick={() => setModal({ mode: 'clockout', record: r })}
                        className="text-xs text-secondary font-semibold hover:underline"
                      >
                        {t('attendance.clockOut')}
                      </button>
                    )}
                    <button
                      onClick={() => setModal({ mode: 'edit', record: r })}
                      className="text-xs text-on-surface-variant font-semibold hover:text-secondary hover:underline"
                    >
                      {t('attendance.edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <AttendanceModal
          mode={modal.mode}
          record={modal.record}
          users={users}
          defaultDate={date}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            loadRecords()
          }}
        />
      )}
    </div>
  )
}

function AttendanceModal({ mode, record, users, defaultDate, onClose, onSaved }) {
  const { t, formatName } = useLanguage()
  const isEdit = mode === 'edit'
  const isCreate = mode === 'create'
  const isClockOut = mode === 'clockout'

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: isCreate
      ? { user_id: '', work_date: defaultDate, time_in: '', notes: '' }
      : {
          time_in: record?.time_in?.slice(0, 5) || '',
          time_out: record?.time_out?.slice(0, 5) || '',
          notes: record?.notes || '',
        },
  })
  const [err, setErr] = useState('')

  const onSubmit = async (values) => {
    setErr('')
    try {
      if (isCreate) {
        await recordAttendance({
          user_id: parseInt(values.user_id, 10),
          work_date: values.work_date,
          time_in: values.time_in,
          notes: values.notes || undefined,
        })
      } else if (isClockOut) {
        await clockOut(record.id, { time_out: values.time_out })
      } else {
        const payload = {}
        if (values.time_in) payload.time_in = values.time_in
        if (values.time_out) payload.time_out = values.time_out
        if (values.notes !== undefined) payload.notes = values.notes
        await updateAttendance(record.id, payload)
      }
      onSaved()
    } catch (e) {
      setErr(e.response?.data?.error || t('common.failedSave'))
    }
  }

  const title = isCreate
    ? t('attendance.modal.create')
    : isClockOut
    ? t('attendance.modal.clockOut')
    : t('attendance.modal.edit')

  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {isCreate && (
          <>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
                {t('attendance.staffMember')}
              </label>
              <select
                {...register('user_id', { required: t('common.required') })}
                className={inputClass}
              >
                <option value="">{t('attendance.selectStaff')}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {formatName(u.name, u.role)} — {t(`role.${u.role}`)}
                  </option>
                ))}
              </select>
              {errors.user_id && (
                <p className="mt-1 text-xs text-error">{errors.user_id.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
                {t('attendance.date')}
              </label>
              <input
                type="date"
                {...register('work_date', { required: true })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
                {t('attendance.timeIn')}
              </label>
              <input
                type="time"
                {...register('time_in', { required: t('common.required') })}
                className={inputClass}
              />
              {errors.time_in && (
                <p className="mt-1 text-xs text-error">{errors.time_in.message}</p>
              )}
            </div>
          </>
        )}

        {isEdit && (
          <>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
                {t('attendance.timeIn')}
              </label>
              <input type="time" {...register('time_in')} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
                {t('attendance.timeOut')}
              </label>
              <input type="time" {...register('time_out')} className={inputClass} />
            </div>
          </>
        )}

        {isClockOut && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              {t('attendance.timeOut')}
            </label>
            <input
              type="time"
              defaultValue={new Date().toTimeString().slice(0, 5)}
              {...register('time_out', { required: t('common.required') })}
              className={inputClass}
            />
            {errors.time_out && (
              <p className="mt-1 text-xs text-error">{errors.time_out.message}</p>
            )}
          </div>
        )}

        {!isClockOut && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              {t('attendance.notes')}
            </label>
            <textarea rows={2} {...register('notes')} className={inputClass} />
          </div>
        )}

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
            {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
