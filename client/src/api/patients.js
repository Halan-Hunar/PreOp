import client from './client'

export const listPatients = (params = {}) =>
  client.get('/patients', { params }).then((r) => r.data)

export const getPatient = (id) =>
  client.get(`/patients/${id}`).then((r) => r.data)

export const createPatient = (data) =>
  client.post('/patients', data).then((r) => r.data)

export const updatePatient = (id, data) =>
  client.put(`/patients/${id}`, data).then((r) => r.data)

export const deletePatient = (id) =>
  client.delete(`/patients/${id}`).then((r) => r.data)

export const assignDoctor = (id, doctor_id) =>
  client.put(`/patients/${id}/assign-doctor`, { doctor_id }).then((r) => r.data)
