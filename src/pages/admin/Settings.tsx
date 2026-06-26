import { useEffect, useState } from 'react'
import { Save, Plus, Trash2, Database, AlertTriangle, Loader2, Sparkles } from 'lucide-react'
import { getSettings, saveSettings } from '../../services/settings'
import { seedAll, wipeData, type SeedProgress } from '../../services/seed'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Button, Card, Input, Modal, PageHeader } from '../../components/ui'
import { DAYS, DEFAULT_PERIODS, DEFAULT_SETTINGS, STUDENTS_PER_CLASS } from '../../lib/constants'
import type { PeriodConfig, SchoolSettings } from '../../lib/types'

export default function Settings() {
  const toast = useToast()
  const confirm = useConfirm()
  const [settings, setSettings] = useState<SchoolSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSettings().then(setSettings).catch(() => setSettings(DEFAULT_SETTINGS as SchoolSettings))
  }, [])

  const update = (patch: Partial<SchoolSettings>) => setSettings((s) => (s ? { ...s, ...patch } : s))

  const updatePeriod = (i: number, patch: Partial<PeriodConfig>) => {
    if (!settings) return
    const periods = settings.periods.map((p, idx) => (idx === i ? { ...p, ...patch } : p))
    update({ periods })
  }
  const addPeriod = () => {
    if (!settings) return
    const n = settings.periods.length + 1
    update({ periods: [...settings.periods, { period: n, label: `Jam ke-${n}`, start: '07:00', end: '07:45' }] })
  }
  const removePeriod = (i: number) => {
    if (!settings) return
    update({ periods: settings.periods.filter((_, idx) => idx !== i) })
  }
  const toggleDay = (d: number) => {
    if (!settings) return
    const current = settings.activeDays ?? []
    const active = current.includes(d) ? current.filter((x) => x !== d) : [...current, d].sort()
    update({ activeDays: active })
  }

  const save = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const periods = settings.periods.map((p, i) => ({ ...p, period: i + 1 }))
      await saveSettings({ ...settings, periods })
      toast.success('Pengaturan disimpan.')
    } catch {
      toast.error('Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  // ---- Seed ----
  const [seedOpen, setSeedOpen] = useState(false)
  const [seedOpts, setSeedOpts] = useState({ includeStudents: true, includeSchedules: true, studentsPerClass: STUDENTS_PER_CLASS })
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ phase: string; current: number; total: number } | null>(null)

  const onProgress: SeedProgress = (info) => setProgress(info)

  const runSeed = async () => {
    setBusy(true)
    setProgress({ phase: 'Memulai…', current: 0, total: 1 })
    try {
      const res = await seedAll(
        { ...seedOpts, academicYear: settings?.academicYear ?? DEFAULT_SETTINGS.academicYear },
        onProgress,
      )
      toast.success(`Seed selesai: ${res.classes} kelas, ${res.students} siswa, ${res.schedules} jadwal.`)
      setSeedOpen(false)
      const s = await getSettings()
      setSettings(s)
    } catch (e) {
      console.error(e)
      toast.error('Gagal melakukan seeding.')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const runWipe = async () => {
    const ok = await confirm({
      title: 'Hapus Semua Data',
      message: 'Ini akan menghapus SELURUH data kelas, siswa, mapel, jadwal, dan absensi. Lanjutkan?',
      danger: true,
      confirmText: 'Hapus Semua',
    })
    if (!ok) return
    setBusy(true)
    try {
      await wipeData(onProgress)
      toast.success('Semua data dihapus.')
    } catch {
      toast.error('Gagal menghapus data.')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  if (!settings) return <Card className="p-10 text-center text-slate-400">Memuat pengaturan…</Card>

  return (
    <div>
      <PageHeader
        title="Pengaturan"
        desc="Konfigurasi sekolah, jam pelajaran, dan alat data."
        actions={
          <Button onClick={save} loading={saving} icon={<Save className="h-4 w-4" />}>
            Simpan Pengaturan
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Info sekolah */}
        <Card className="p-5">
          <h3 className="mb-4 font-semibold text-slate-800">Identitas Sekolah</h3>
          <div className="space-y-3">
            <Input label="Nama Sekolah" value={settings.schoolName} onChange={(e) => update({ schoolName: e.target.value })} />
            <Input label="Tahun Ajaran" value={settings.academicYear} onChange={(e) => update({ academicYear: e.target.value })} />
            <Input
              label="Toleransi Keterlambatan (menit)"
              type="number"
              min={0}
              value={settings.lateThresholdMinutes}
              onChange={(e) => update({ lateThresholdMinutes: parseInt(e.target.value) || 0 })}
              hint="Scan setelah jam mulai + toleransi dianggap Terlambat."
            />
            <div>
              <label className="label">Hari Aktif Sekolah</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => toggleDay(d.value)}
                    className={`touch-target rounded-xl px-3 py-2 text-sm font-medium transition ${
                      (settings.activeDays ?? []).includes(d.value) ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {d.short}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Jam pelajaran */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Jam Pelajaran</h3>
            <Button variant="secondary" size="sm" onClick={addPeriod} icon={<Plus className="h-4 w-4" />}>
              Tambah
            </Button>
          </div>
          <div className="space-y-2">
            {(settings.periods ?? []).map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-8 text-center text-sm font-semibold text-slate-400">{i + 1}</span>
                <input className="input flex-1 py-2" value={p.label} onChange={(e) => updatePeriod(i, { label: e.target.value })} />
                <input type="time" className="input w-28 py-2" value={p.start} onChange={(e) => updatePeriod(i, { start: e.target.value })} />
                <input type="time" className="input w-28 py-2" value={p.end} onChange={(e) => updatePeriod(i, { end: e.target.value })} />
                <button onClick={() => removePeriod(i)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Alat data */}
      <Card className="mt-4 p-5">
        <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-800">
          <Database className="h-5 w-5 text-brand-600" /> Alat Data
        </h3>
        <p className="mb-4 text-sm text-slate-500">Isi data contoh untuk uji coba, atau bersihkan seluruh data.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setSeedOpen(true)} icon={<Sparkles className="h-4 w-4" />}>
            Isi Data Contoh (Seed)
          </Button>
          <Button variant="danger" onClick={runWipe} loading={busy} icon={<AlertTriangle className="h-4 w-4" />}>
            Hapus Semua Data
          </Button>
        </div>
        {progress && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>{progress.phase}</span>
              <span>
                {progress.current}/{progress.total}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-brand-600 transition-all" style={{ width: `${(progress.current / Math.max(1, progress.total)) * 100}%` }} />
            </div>
          </div>
        )}
      </Card>

      {/* Modal seed */}
      <Modal
        open={seedOpen}
        onClose={() => !busy && setSeedOpen(false)}
        title="Isi Data Contoh"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSeedOpen(false)} disabled={busy}>
              Batal
            </Button>
            <Button onClick={runSeed} loading={busy} icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}>
              Mulai Seed
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Akan dibuat <b>39 kelas</b> (X/XI/XII × MIPA 5, IPS 5, Bahasa 3), mata pelajaran, dan opsi di bawah.
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={seedOpts.includeStudents}
              onChange={(e) => setSeedOpts({ ...seedOpts, includeStudents: e.target.checked })}
              className="h-4 w-4 rounded"
            />
            Buat siswa
          </label>
          {seedOpts.includeStudents && (
            <Input
              label="Siswa per kelas"
              type="number"
              min={1}
              max={40}
              value={seedOpts.studentsPerClass}
              onChange={(e) => setSeedOpts({ ...seedOpts, studentsPerClass: parseInt(e.target.value) || 1 })}
              hint={`Total ± ${(39 * (seedOpts.studentsPerClass || 0)).toLocaleString('id-ID')} siswa`}
            />
          )}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={seedOpts.includeSchedules}
              onChange={(e) => setSeedOpts({ ...seedOpts, includeSchedules: e.target.checked })}
              className="h-4 w-4 rounded"
            />
            Buat jadwal pelajaran (Senin-Jumat, 8 jam/hari)
          </label>
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Proses dapat memakan waktu beberapa menit untuk data besar. Jangan tutup halaman selama proses berjalan.
          </div>
        </div>
      </Modal>
    </div>
  )
}
