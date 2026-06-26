import { useEffect, useState } from 'react'
import { ChevronsUp, GraduationCap, AlertTriangle, Loader2, ArrowRight, Info } from 'lucide-react'
import { getPromotionPreview, runPromotion, type PromotionPreview } from '../../services/promotion'
import { getSettings, saveSettings } from '../../services/settings'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Button, Card, PageHeader, Input } from '../../components/ui'

export default function Promotion() {
  const toast = useToast()
  const confirm = useConfirm()
  const [preview, setPreview] = useState<PromotionPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState('')
  const [updateYear, setUpdateYear] = useState(true)
  const [clearFp, setClearFp] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ c: number; t: number } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [p, s] = await Promise.all([getPromotionPreview(), getSettings()])
      setPreview(p)
      setYear((cur) => cur || nextAcademicYear(s.academicYear))
    } catch {
      toast.error('Gagal memuat data.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const run = async () => {
    if (!preview) return
    const ok = await confirm({
      title: 'Jalankan Kenaikan Kelas?',
      danger: true,
      confirmText: 'Ya, Jalankan',
      message: (
        <div className="space-y-2">
          <p>Tindakan ini akan:</p>
          <ul className="list-disc pl-5">
            <li>Menaikkan <b>{preview.toXI}</b> siswa X → XI</li>
            <li>Menaikkan <b>{preview.toXII}</b> siswa XI → XII</li>
            <li>Meluluskan <b>{preview.graduate}</b> siswa XII (jadi alumni)</li>
          </ul>
          <p className="font-semibold text-red-600">Tidak dapat dibatalkan otomatis. Pastikan sudah backup bila perlu.</p>
        </div>
      ),
    })
    if (!ok) return

    setBusy(true)
    setProgress({ c: 0, t: preview.totalActive || 1 })
    try {
      const res = await runPromotion({ graduatedYear: year, clearGraduateFingerprint: clearFp }, (c, t) =>
        setProgress({ c, t }),
      )
      if (updateYear && year) await saveSettings({ academicYear: year })
      toast.success(`Selesai: ${res.toXI} ke XI, ${res.toXII} ke XII, ${res.graduate} lulus.`)
      await load()
    } catch (e) {
      console.error(e)
      toast.error('Gagal menjalankan kenaikan kelas.')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <div>
      <PageHeader title="Kenaikan Kelas & Kelulusan" desc="Naikkan seluruh siswa satu tingkat & luluskan kelas XII (model: alat ikut rombel)." />

      <Card className="mb-4 flex items-start gap-3 border-l-4 border-amber-400 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Lakukan ini sekali di awal tahun ajaran baru.</p>
          <p>
            Sidik jari & perangkat tiap siswa <b>tetap ikut</b> saat naik kelas, jadi tidak perlu daftar ulang. Hanya
            siswa kelas X baru yang perlu didaftarkan sidik jarinya.
          </p>
        </div>
      </Card>

      {loading ? (
        <Card className="p-10 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-600" />
        </Card>
      ) : preview ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <FlowCard from="Kelas X" to="Kelas XI" count={preview.toXI} color="bg-brand-50 text-brand-700" />
            <FlowCard from="Kelas XI" to="Kelas XII" count={preview.toXII} color="bg-violet-50 text-violet-700" />
            <Card className="p-5">
              <div className="flex items-center gap-2 text-green-700">
                <GraduationCap className="h-5 w-5" />
                <span className="font-semibold">Lulus (XII)</span>
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-800">{preview.graduate}</p>
              <p className="text-xs text-slate-400">siswa menjadi alumni</p>
            </Card>
          </div>

          <Card className="mt-4 p-5">
            <h3 className="mb-3 font-semibold text-slate-800">Opsi</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Tahun Ajaran Baru"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="mis. 2026/2027"
              />
              <div className="space-y-2 pt-6">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={updateYear} onChange={(e) => setUpdateYear(e.target.checked)} className="h-4 w-4 rounded" />
                  Perbarui tahun ajaran di Pengaturan
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={clearFp} onChange={(e) => setClearFp(e.target.checked)} className="h-4 w-4 rounded" />
                  Kosongkan sidik jari siswa yang lulus
                </label>
              </div>
            </div>

            {progress && (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>Memproses…</span>
                  <span>
                    {progress.c}/{progress.t}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-brand-600 transition-all" style={{ width: `${(progress.c / Math.max(1, progress.t)) * 100}%` }} />
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <Button variant="danger" onClick={run} loading={busy} icon={<ChevronsUp className="h-4 w-4" />}>
                Jalankan Kenaikan Kelas
              </Button>
            </div>
          </Card>

          <Card className="mt-4 flex items-start gap-3 p-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <div className="text-sm text-slate-600">
              <p className="font-semibold text-slate-800">Langkah setelah kenaikan kelas:</p>
              <ol className="list-decimal pl-5">
                <li>Untuk tiap alat bekas kelas XII (yang lulus), buka <b>Perangkat ESP32 → Kosongkan Sensor</b> agar slot template bebas.</li>
                <li>Tambahkan data siswa baru kelas X, lalu daftarkan sidik jarinya di alat-alat tersebut.</li>
              </ol>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function FlowCard({ from, to, count, color }: { from: string; to: string; count: number; color: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className={`rounded-lg px-2 py-1 ${color}`}>{from}</span>
        <ArrowRight className="h-4 w-4 text-slate-400" />
        <span className={`rounded-lg px-2 py-1 ${color}`}>{to}</span>
      </div>
      <p className="mt-2 text-3xl font-bold text-slate-800">{count}</p>
      <p className="text-xs text-slate-400">siswa naik kelas</p>
    </Card>
  )
}

/** "2025/2026" -> "2026/2027" */
function nextAcademicYear(ay: string): string {
  const m = ay.match(/(\d{4})\s*\/\s*(\d{4})/)
  if (!m) return ay
  return `${parseInt(m[1]) + 1}/${parseInt(m[2]) + 1}`
}
