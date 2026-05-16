import client from './client'

export const getAttendance = (params = {}) =>
  client.get('/attendance', { params }).then((r) => r.data)

export const getAttendanceSummary = (params = {}) =>
  client.get('/attendance/summary', { params }).then((r) => r.data)

export const recordAttendance = (data) =>
  client.post('/attendance', data).then((r) => r.data)

export const updateAttendance = (id, data) =>
  client.put(`/attendance/${id}`, data).then((r) => r.data)

export const clockOut = (id, data) =>
  client.put(`/attendance/${id}/clockout`, data).then((r) => r.data)
