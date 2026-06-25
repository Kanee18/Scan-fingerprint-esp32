import { Fingerprint, KeyRound, Copy, ExternalLink } from 'lucide-react'

/** Ditampilkan ketika kredensial Firebase di .env masih placeholder/kosong. */
export function SetupScreen() {
  const envTemplate = `VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...`

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
            <Fingerprint className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Konfigurasi Firebase diperlukan</h1>
            <p className="text-sm text-slate-500">Aplikasi belum bisa berjalan karena kredensial Firebase belum diisi.</p>
          </div>
        </div>

        <div className="card space-y-5 p-6">
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              File <code className="rounded bg-amber-100 px-1">.env</code> masih berisi nilai contoh
              (<code>AIzaSyXXXX…</code>, <code>nama-project</code>). Ganti dengan kredensial project Firebase Anda.
            </p>
          </div>

          <ol className="list-decimal space-y-3 pl-5 text-sm text-slate-700">
            <li>
              Buka{' '}
              <a
                href="https://console.firebase.google.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline"
              >
                Firebase Console <ExternalLink className="h-3.5 w-3.5" />
              </a>{' '}
              → buat / pilih project.
            </li>
            <li>
              Aktifkan <b>Authentication</b> (Email/Password), <b>Firestore</b>, dan <b>Realtime Database</b>.
            </li>
            <li>
              <b>Project Settings → Your apps → Web (&lt;/&gt;)</b> untuk mendapatkan nilai konfigurasi.
            </li>
            <li>
              Isi file <code className="rounded bg-slate-100 px-1">.env</code> di root proyek:
            </li>
          </ol>

          <div className="relative">
            <pre className="overflow-auto rounded-xl bg-slate-900 px-4 py-3 text-xs text-slate-200">{envTemplate}</pre>
            <button
              onClick={() => navigator.clipboard?.writeText(envTemplate)}
              className="absolute right-2 top-2 rounded-lg bg-white/10 p-2 text-slate-300 hover:bg-white/20"
              title="Salin"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm text-slate-500">
            Setelah menyimpan <code>.env</code>, <b>hentikan & jalankan ulang</b> <code>npm run dev</code> (perubahan .env
            tidak ter-hot-reload). Halaman ini akan otomatis menjadi halaman login.
          </p>
        </div>
      </div>
    </div>
  )
}
