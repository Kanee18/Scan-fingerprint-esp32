import { useEffect, useMemo, useRef, useState } from 'react'
import { orderBy, where } from 'firebase/firestore'
import {
  Fingerprint,
  Search,
  Wifi,
  WifiOff,
  CheckCircle2,
  Trash2,
  Loader2,
  FlaskConical,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useCollection } from '../hooks/useFirestore'
import { useDeviceState, useDevicesList, useEnrollStatus } from '../hooks/useDevice'
import { useDeviceId } from '../hooks/useDeviceId'
import { clearCommand, requestDeleteFingerprint, requestEnroll } from '../services/devices'
import { allocateFingerprintId, clearFingerprint, setFingerprint } from '../services/students'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { Avatar, Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select } from '../components/ui'
import { GRADES, MAJORS } from '../lib/constants'
import { cn } from '../lib/utils'
import type { EnrollStatus, SchoolClass, Student } from '../lib/types'

const STEP_LABEL: Record<EnrollStatus['step'], string> = {
  idle: 'Menunggu…',
  waiting_finger: 'Menghubungi perangkat…',
  place_first: 'Letakkan jari pada sensor',
  remove_finger: 'Angkat jari Anda',
  place_second: 'Letakkan jari yang sama sekali lagi',
  processing: 'Menyimpan template…',
  success: 'Pendaftaran berhasil!',
  failed: 'Pendaftaran gagal',
}

export default function Enroll() {
  const { profile } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [deviceId, setDeviceId] = useDeviceId()
  const { isOnline } = useDeviceState(deviceId)
  const { devices } = useDevicesList()
  const enrollStatus = useEnrollStatus(deviceId)

  const [grade, setGrade] = useState('')
  const [major, setMajor] = useState('')
  const [classId, setClassId] = useState('')
  const [search, setSearch] = useState('')
  const [simMode, setSimMode] = useState(false)

  const { data: classes } = useCollection<SchoolClass>('classes', [orderBy('name')])
  const { data: students, loading } = useCollection<Student>(
    classId ? 'students' : null,
    [where('classId', '==', classId)],
    [classId],
  )

  const filteredClasses = useMemo(
    () => classes.filter((c) => (!grade || c.grade === grade) && (!major || c.major === major)),
    [classes, grade, major],
  )
  const filteredStudents = useMemo(() => {
    const s = search.toLowerCase()
    return students
      .filter((st) => !s || st.name.toLowerCase().includes(s) || st.nis.includes(s))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [students, search])

  // ---- Enrollment state ----
  const [target, setTarget] = useState<Student | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const allocatedId = useRef<number | null>(null)
  const handled = useRef(false)

  // Reaksi terhadap perubahan status dari perangkat
  useEffect(() => {
    if (!enrolling || !target || !enrollStatus || handled.current) return
    if (enrollStatus.step === 'success') {
      handled.current = true
      const fid = allocatedId.current ?? enrollStatus.fingerprintId
      if (fid) {
        setFingerprint(target.id, fid, deviceId)
          .then(() => toast.success(`Sidik jari ${target.name} terdaftar (slot #${fid}).`))
          .catch(() => toast.error('Gagal menyimpan ke database.'))
          .finally(() => finishEnroll())
      }
    } else if (enrollStatus.step === 'failed') {
      handled.current = true
      toast.error(enrollStatus.message || 'Pendaftaran gagal.')
      finishEnroll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollStatus, enrolling, target])

  const finishEnroll = () => {
    setTimeout(() => {
      setEnrolling(false)
      setTarget(null)
      allocatedId.current = null
      handled.current = false
      clearCommand(deviceId).catch(() => {})
    }, 1500)
  }

  const startEnroll = async (student: Student) => {
    try {
      const fid = await allocateFingerprintId(deviceId)
      allocatedId.current = fid
      handled.current = false
      setTarget(student)
      setEnrolling(true)

      if (simMode) {
        // Mode simulasi: langsung tulis ke database tanpa perangkat
        await setFingerprint(student.id, fid, deviceId)
        toast.success(`(Simulasi) Sidik jari ${student.name} terdaftar (slot #${fid}).`)
        finishEnroll()
        return
      }
      if (!isOnline) {
        toast.warning('Perangkat offline. Aktifkan ESP32 atau gunakan mode simulasi.')
      }
      await requestEnroll(deviceId, fid, student.id, student.name, profile?.uid)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Gagal memulai pendaftaran.')
      setEnrolling(false)
      setTarget(null)
    }
  }

  const removeFingerprint = async (student: Student) => {
    const ok = await confirm({
      title: 'Hapus Sidik Jari',
      message: `Hapus sidik jari milik ${student.name}? Slot template akan dikosongkan.`,
      danger: true,
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      if (!simMode && student.fingerprintId) {
        await requestDeleteFingerprint(deviceId, student.fingerprintId)
      }
      await clearFingerprint(student.id)
      toast.success('Sidik jari dihapus.')
    } catch {
      toast.error('Gagal menghapus.')
    }
  }

  return (
    <div>
      <PageHeader
        title="Daftar Sidik Jari"
        desc="Daftarkan template sidik jari siswa ke sensor melalui perangkat ESP32."
        actions={
          <div
            className={cn(
              'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold',
              isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
            )}
          >
            {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {deviceId} · {isOnline ? 'Online' : 'Offline'}
          </div>
        }
      />

      <Card className="mb-4 p-4">
        <div className="mb-3">
          <Select
            label="Perangkat (alat tempat sidik jari disimpan)"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            hint="Daftarkan siswa pada alat kelasnya. Slot template tersimpan di sensor alat ini."
          >
            <option value={deviceId}>{deviceId}</option>
            {devices.filter((d) => d.id !== deviceId).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name ? `${d.name} (${d.id})` : d.id}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Tingkat" value={grade} onChange={(e) => { setGrade(e.target.value); setClassId('') }}>
            <option value="">Semua tingkat</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                Kelas {g}
              </option>
            ))}
          </Select>
          <Select label="Jurusan" value={major} onChange={(e) => { setMajor(e.target.value); setClassId('') }}>
            <option value="">Semua jurusan</option>
            {MAJORS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </Select>
          <Select label="Kelas" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Pilih kelas…</option>
            {filteredClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input
            label="Cari siswa"
            placeholder="Nama atau NIS"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={simMode} onChange={(e) => setSimMode(e.target.checked)} className="h-4 w-4 rounded" />
          <FlaskConical className="h-4 w-4 text-violet-500" />
          Mode simulasi (uji tanpa perangkat ESP32)
        </label>
      </Card>

      {!classId ? (
        <Card>
          <EmptyState icon={<Fingerprint className="h-8 w-8" />} title="Pilih kelas terlebih dahulu" desc="Pilih kelas untuk menampilkan daftar siswa." />
        </Card>
      ) : loading ? (
        <Card>
          <EmptyState icon={<Loader2 className="h-8 w-8 animate-spin" />} title="Memuat siswa…" />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredStudents.map((st) => (
            <Card key={st.id} className="flex items-center gap-3 p-4">
              <Avatar name={st.name} photoUrl={st.photoUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-800">{st.name}</p>
                <p className="truncate text-xs text-slate-400">NIS {st.nis}</p>
                <div className="mt-1.5">
                  {st.fingerprintId ? (
                    <Badge className="bg-green-100 text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Terdaftar #{st.fingerprintId}
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-500">
                      <XCircle className="h-3.5 w-3.5" /> Belum terdaftar
                    </Badge>
                  )}
                </div>
              </div>
              {st.fingerprintId ? (
                <Button variant="ghost" size="sm" onClick={() => removeFingerprint(st)} title="Hapus sidik jari">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              ) : (
                <Button size="sm" onClick={() => startEnroll(st)} icon={<Fingerprint className="h-4 w-4" />}>
                  Daftar
                </Button>
              )}
            </Card>
          ))}
          {filteredStudents.length === 0 && (
            <Card className="sm:col-span-2 xl:col-span-3">
              <EmptyState icon={<Search className="h-8 w-8" />} title="Tidak ada siswa" desc="Coba ubah filter atau kata kunci." />
            </Card>
          )}
        </div>
      )}

      {/* Modal progres pendaftaran */}
      <Modal open={enrolling} onClose={() => {}} title="Pendaftaran Sidik Jari" size="sm">
        {target && (
          <div className="flex flex-col items-center text-center">
            <Avatar name={target.name} photoUrl={target.photoUrl} size="xl" />
            <p className="mt-3 text-lg font-bold text-slate-800">{target.name}</p>
            <p className="text-sm text-slate-400">{target.className}</p>

            <EnrollAnimation step={enrollStatus?.step ?? 'waiting_finger'} />

            <p className="text-lg font-semibold text-slate-700">
              {STEP_LABEL[enrollStatus?.step ?? 'waiting_finger']}
            </p>
            <p className="mt-1 min-h-[20px] text-sm text-slate-400">{enrollStatus?.message}</p>

            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: `${enrollStatus?.progress ?? 0}%` }}
              />
            </div>
            {allocatedId.current && (
              <p className="mt-3 text-xs text-slate-400">Slot template: #{allocatedId.current}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

function EnrollAnimation({ step }: { step: EnrollStatus['step'] }) {
  const isSuccess = step === 'success'
  const isFailed = step === 'failed'
  return (
    <div className="relative my-6 flex h-32 w-32 items-center justify-center">
      {!isSuccess && !isFailed && (
        <span className="absolute h-full w-full rounded-full bg-brand-500/20 animate-pulse-ring" />
      )}
      <div
        className={cn(
          'relative flex h-28 w-28 items-center justify-center rounded-full text-white shadow-lg transition-colors',
          isSuccess ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-brand-600',
        )}
      >
        {isSuccess ? (
          <CheckCircle2 className="h-14 w-14" />
        ) : isFailed ? (
          <XCircle className="h-14 w-14" />
        ) : (
          <Fingerprint className="h-14 w-14 animate-pulse" />
        )}
      </div>
    </div>
  )
}
