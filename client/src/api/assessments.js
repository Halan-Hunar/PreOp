import client from './client'

export const listAssessments = (params = {}) =>
  client.get('/assessments', { params }).then((r) => r.data)

export const listPendingAssessments = () =>
  client.get('/assessments/pending').then((r) => r.data)

export const getAssessment = (id) =>
  client.get(`/assessments/${id}`).then((r) => r.data)

export const createAssessment = (data) =>
  client.post('/assessments', data).then((r) => r.data)

export const updateAssessment = (id, data) =>
  client.put(`/assessments/${id}`, data).then((r) => r.data)

export const deleteAssessment = (id) =>
  client.delete(`/assessments/${id}`).then((r) => r.data)

export const submitAssessment = (id) =>
  client.post(`/assessments/${id}/submit`).then((r) => r.data)

export const createClearance = (id, data) =>
  client.post(`/assessments/${id}/clearance`, data).then((r) => r.data)

export const addNote = (id, note) =>
  client.post(`/assessments/${id}/notes`, { note }).then((r) => r.data)

export const addLabResult = (id, data) =>
  client.post(`/assessments/${id}/lab-results`, data).then((r) => r.data)
