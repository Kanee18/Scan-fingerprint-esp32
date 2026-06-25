import { Link } from 'react-router-dom'
import { Home, Frown } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-400 shadow-sm">
        <Frown className="h-10 w-10" />
      </div>
      <h1 className="text-3xl font-bold text-slate-800">404</h1>
      <p className="text-slate-500">Halaman yang Anda cari tidak ditemukan.</p>
      <Link to="/" className="btn btn-primary">
        <Home className="h-4 w-4" /> Kembali ke Beranda
      </Link>
    </div>
  )
}
