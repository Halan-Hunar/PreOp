import client from './client'

export const listAppointments = (params = {}) =>
  client.get('/appointments', { params }).then((r) => r.data)

export const getTodayAppointments = () =>
  client.get('/appointments/today').then((r) => r.data)

export const getAppointment = (id) =>
  client.get(`/appointments/${id}`).then((r) => r.data)

export const createAppointment = (data) =>
  client.post('/appointments', data).then((r) => r.data)

export const updateAppointment = (id, data) =>
  client.put(`/appointments/${id}`, data).then((r) => r.data)
