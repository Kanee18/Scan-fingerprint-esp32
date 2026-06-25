import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Fingerprint,
  ScanLine,
  Users,
  GraduationCap,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  BarChart3,
  Cpu,
  UserCog,
  Settings,
  Menu,
  X,
  LogOut,
  School,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Avatar } from './ui'
import { Clock } from './Clock'
import { cn } from '../lib/utils'
import { ROLE_META } from '../lib/constants'
import type { Role } from '../lib/types'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  roles: Role[]
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, roles: ['admin'], end: true },
  { to: '/wali', label: 'Dashboard Kelas', icon: <LayoutDashboard className="h-5 w-5" />, roles: ['wali_kelas'], end: true },
  { to: '/kiosk', label: 'Kiosk Absensi', icon: <ScanLine className="h-5 w-5" />, roles: ['admin', 'operator'] },
  { to: '/enroll', label: 'Daftar Sidik Jari', icon: <Fingerprint className="h-5 w-5" />, roles: ['admin', 'operator'] },
  { to: '/admin/students', label: 'Data Siswa', icon: <Users className="h-5 w-5" />, roles: ['admin'] },
  { to: '/admin/classes', label: 'Kelas', icon: <GraduationCap className="h-5 w-5" />, roles: ['admin'] },
  { to: '/admin/subjects', label: 'Mata Pelajaran', icon: <BookOpen className="h-5 w-5" />, roles: ['admin'] },
  { to: '/admin/schedules', label: 'Jadwal Pelajaran', icon: <CalendarDays className="h-5 w-5" />, roles: ['admin'] },
  { to: '/admin/attendance', label: 'Absensi', icon: <ClipboardCheck className="h-5 w-5" />, roles: ['admin'] },
  { to: '/admin/reports', label: 'Laporan & Rekap', icon: <BarChart3 className="h-5 w-5" />, roles: ['admin'] },
  { to: '/admin/devices', label: 'Perangkat ESP32', icon: <Cpu className="h-5 w-5" />, roles: ['admin', 'operator'] },
  { to: '/admin/users', label: 'Pengguna', icon: <UserCog className="h-5 w-5" />, roles: ['admin'] },
  { to: '/admin/settings', label: 'Pengaturan', icon: <Settings className="h-5 w-5" />, roles: ['admin'] },
]

export function Layout() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (!profile) return null
  const items = NAV.filter((n) => n.roles.includes(profile.role))

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
          <School className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-800">Absensi Sidik Jari</p>
          <p className="truncate text-xs text-slate-400">Sistem Kehadiran SMA</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {items.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) => cn('nav-link', isActive && 'nav-link-active')}
          >
            {n.icon}
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={profile.name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-700">{profile.name}</p>
            <p className="truncate text-xs text-slate-400">{ROLE_META[profile.role].label}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Keluar"
            className="touch-target rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 animate-fade-in bg-white shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-6">
          <button
            onClick={() => setOpen(true)}
            className="touch-target rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          <Clock className="text-right" />
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// Re-export X agar tersedia bila dibutuhkan ikon close di tempat lain
export { X }
