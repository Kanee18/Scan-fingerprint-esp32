import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { Layout } from './components/Layout'
import { ProtectedRoute, defaultRouteFor } from './components/ProtectedRoute'
import { LoadingScreen } from './components/ui'

import Login from './pages/Login'
import Kiosk from './pages/Kiosk'
import Enroll from './pages/Enroll'
import Dashboard from './pages/admin/Dashboard'
import Students from './pages/admin/Students'
import Classes from './pages/admin/Classes'
import Subjects from './pages/admin/Subjects'
import Schedules from './pages/admin/Schedules'
import Attendance from './pages/admin/Attendance'
import Reports from './pages/admin/Reports'
import Devices from './pages/admin/Devices'
import UsersPage from './pages/admin/Users'
import SettingsPage from './pages/admin/Settings'
import WaliDashboard from './pages/wali/WaliDashboard'
import NotFound from './pages/NotFound'

// Arahkan ke beranda sesuai peran. Dibungkus ProtectedRoute agar kasus
// "sudah login tapi belum punya profil" menampilkan layar setup admin,
// bukan memantul kembali ke /login.
function RoleHome() {
  const { profile } = useAuth()
  if (!profile) return <LoadingScreen />
  return <Navigate to={defaultRouteFor(profile.role)} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RoleHome />
          </ProtectedRoute>
        }
      />

      {/* Kiosk fullscreen (tanpa sidebar) */}
      <Route
        path="/kiosk"
        element={
          <ProtectedRoute roles={['admin', 'operator']}>
            <Kiosk />
          </ProtectedRoute>
        }
      />

      {/* Area dengan layout sidebar */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/enroll" element={<ProtectedRoute roles={['admin', 'operator']}><Enroll /></ProtectedRoute>} />

        <Route path="/admin" element={<ProtectedRoute roles={['admin']}><Dashboard /></ProtectedRoute>} />
        <Route path="/admin/students" element={<ProtectedRoute roles={['admin']}><Students /></ProtectedRoute>} />
        <Route path="/admin/classes" element={<ProtectedRoute roles={['admin']}><Classes /></ProtectedRoute>} />
        <Route path="/admin/subjects" element={<ProtectedRoute roles={['admin']}><Subjects /></ProtectedRoute>} />
        <Route path="/admin/schedules" element={<ProtectedRoute roles={['admin']}><Schedules /></ProtectedRoute>} />
        <Route path="/admin/attendance" element={<ProtectedRoute roles={['admin']}><Attendance /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute roles={['admin']}><Reports /></ProtectedRoute>} />
        <Route path="/admin/devices" element={<ProtectedRoute roles={['admin', 'operator']}><Devices /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><UsersPage /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute roles={['admin']}><SettingsPage /></ProtectedRoute>} />

        <Route path="/wali" element={<ProtectedRoute roles={['wali_kelas', 'admin']}><WaliDashboard /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
