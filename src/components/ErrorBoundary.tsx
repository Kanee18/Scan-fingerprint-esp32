import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertOctagon, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/** Menangkap error render agar layar tidak blank putih total. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <AlertOctagon className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Terjadi kesalahan</h1>
          <p className="max-w-md text-sm text-slate-500">
            Aplikasi mengalami error saat dijalankan. Periksa Console browser (F12) untuk detail. Penyebab paling umum
            adalah konfigurasi Firebase yang salah pada file <code>.env</code>.
          </p>
          <pre className="max-w-lg overflow-auto rounded-lg bg-slate-900 px-4 py-3 text-left text-xs text-red-300">
            {this.state.error.message}
          </pre>
          <button onClick={() => window.location.reload()} className="btn btn-primary">
            <RefreshCw className="h-4 w-4" /> Muat Ulang
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
