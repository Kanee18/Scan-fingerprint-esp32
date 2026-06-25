import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Fingerprint, Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Button } from '../components/ui'
import { Clock } from '../components/Clock'
import { FirebaseError } from 'firebase/app'

export default function Login() {
  const { login, firebaseUser, loading: authLoading } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : ''
      const msg =
        code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found'
          ? 'Email atau kata sandi salah.'
          : code === 'auth/too-many-requests'
            ? 'Terlalu banyak percobaan. Coba lagi nanti.'
            : code === 'auth/invalid-email'
              ? 'Format email tidak valid.'
              : 'Gagal masuk. Periksa koneksi & konfigurasi Firebase.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // Sudah login → biarkan alur "/" yang menentukan tujuan (beranda peran / setup admin)
  if (!authLoading && firebaseUser) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-screen">
      {/* Panel kiri (branding) */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Fingerprint className="h-7 w-7" />
          </div>
          <span className="text-lg font-bold">SIAP-SIDIK</span>
        </div>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight">
            Sistem Absensi
            <br />
            Sidik Jari Sekolah
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Pencatatan kehadiran siswa per jam pelajaran secara otomatis menggunakan sensor sidik jari & ESP32,
            terintegrasi penuh dengan Firebase.
          </p>
        </div>
        <Clock className="text-white/80" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-32 right-20 h-80 w-80 rounded-full bg-white/5" />
      </div>

      {/* Panel kanan (form) */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
              <Fingerprint className="h-8 w-8" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Absensi Sidik Jari</h1>
          </div>

          <h2 className="text-2xl font-bold text-slate-800">Selamat datang 👋</h2>
          <p className="mt-1 text-sm text-slate-500">Masuk untuk melanjutkan ke dashboard</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@sekolah.sch.id"
                  className="input pl-11"
                />
              </div>
            </div>
            <div>
              <label className="label">Kata Sandi</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type={show ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input px-11"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                >
                  {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <Button type="submit" loading={loading} className="w-full" size="lg" icon={<LogIn className="h-5 w-5" />}>
              Masuk
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Belum punya akses? Hubungi administrator sekolah untuk pembuatan akun.
          </p>
        </div>
      </div>
    </div>
  )
}
