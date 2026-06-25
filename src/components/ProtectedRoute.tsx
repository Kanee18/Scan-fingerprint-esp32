import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingScreen, Button } from './ui'
import { setOne, serverTimestamp } from '../services/db'
import { useToast } from '../contexts/ToastContext'
import type { Role } from '../lib/types'
import { ShieldAlert, LogOut, ShieldCheck } from 'lucide-react'

export function ProtectedRoute({
  children,
  roles,
}: {
  children: JSX.Element
  roles?: Role[]
}) {
  const { firebaseUser, profile, loading, noProfile, logout } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen label="Memeriksa sesi…" />

  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  // Login berhasil tetapi belum punya dokumen profil/role
  if (noProfile || !profile) {
    return <NoProfileScreen email={firebaseUser.email ?? ''} uid={firebaseUser.uid} onLogout={logout} />
  }

  if (profile.active === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-6 text-center">
        <h1 className="text-xl font-bold text-slate-800">Akun dinonaktifkan</h1>
        <p className="text-sm text-slate-500">Akun Anda sedang tidak aktif. Hubungi administrator.</p>
        <button type="button" onClick={logout} className="btn btn-secondary">
          <LogOut className="h-4 w-4" /> Keluar
        </button>
      </div>
    )
  }

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to={defaultRouteFor(profile.role)} replace />
  }

  return children
}

/**
 * Layar untuk pengguna yang sudah login tapi belum punya profil/role.
 * Menyediakan tombol "Jadikan saya Admin" untuk setup awal (hanya berhasil
 * bila aturan Firestore masih mengizinkan, mis. saat pertama setup).
 */
function NoProfileScreen({ email, uid, onLogout }: { email: string; uid: string; onLogout: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const becomeAdmin = async () => {
    setBusy(true)
    try {
      await setOne(
        'users',
        uid,
        { email, name: email.split('@')[0], role: 'admin', classId: null, active: true, createdAt: serverTimestamp() },
        false,
      )
      toast.success('Berhasil! Memuat ulang…')
      setTimeout(() => window.location.reload(), 800)
    } catch {
      toast.error('Gagal. Buat dokumen admin lewat Firebase Console (lihat README).')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h1 className="text-xl font-bold text-slate-800">Akun belum memiliki akses</h1>
      <p className="max-w-md text-sm text-slate-500">
        Akun <b>{email}</b> sudah terdaftar di Firebase Authentication, namun belum memiliki dokumen profil/role di
        koleksi <code>users</code>.
      </p>
      <div className="flex flex-col items-center gap-2">
        <Button onClick={becomeAdmin} loading={busy} icon={<ShieldCheck className="h-4 w-4" />}>
          Jadikan saya Admin (setup awal)
        </Button>
        <p className="max-w-sm text-xs text-slate-400">
          Tombol ini hanya untuk konfigurasi pertama kali. Setelah aturan keamanan diterapkan, pembuatan admin dilakukan
          lewat Firebase Console / oleh admin lain.
        </p>
        <button type="button" onClick={onLogout} className="btn btn-ghost mt-2">
          <LogOut className="h-4 w-4" /> Keluar
        </button>
      </div>
    </div>
  )
}

export function defaultRouteFor(role: Role): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'operator':
      return '/kiosk'
    case 'wali_kelas':
      return '/wali'
    default:
      return '/login'
  }
}
