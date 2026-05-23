import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PatientList from './pages/PatientList'
import PatientProfile from './pages/PatientProfile'
import PatientForm from './pages/PatientForm'
import AppointmentCalendar from './pages/AppointmentCalendar'
import AssessmentForm from './pages/AssessmentForm'
import ClearanceView from './pages/ClearanceView'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Attendance from './pages/Attendance'
import AdminUsers from './pages/AdminUsers'
import AdminLogs from './pages/AdminLogs'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/patients" element={<PatientList />} />
        <Route
          path="/patients/new"
          element={
            <ProtectedRoute roles={['receptionist', 'nurse']}>
              <PatientForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:id/edit"
          element={
            <ProtectedRoute roles={['admin', 'anaesthetist', 'receptionist', 'nurse']}>
              <PatientForm />
            </ProtectedRoute>
          }
        />
        <Route path="/patients/:id" element={<PatientProfile />} />
        <Route path="/appointments" element={<AppointmentCalendar />} />
        <Route
          path="/assessments/:id"
          element={
            <ProtectedRoute roles={['anaesthetist']}>
              <AssessmentForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assessments/:id/clearance"
          element={
            <ProtectedRoute roles={['anaesthetist']}>
              <ClearanceView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute roles={['admin', 'receptionist']}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/attendance"
          element={
            <ProtectedRoute roles={['admin', 'receptionist']}>
              <Attendance />
            </ProtectedRoute>
          }
        />
        <Route path="/settings" element={<Settings />} />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminLogs />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
