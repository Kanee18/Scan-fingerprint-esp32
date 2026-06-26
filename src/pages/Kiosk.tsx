import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import {
  Fingerprint,
  Wifi,
  WifiOff,
  LogOut,
  CheckCircle2,
  XCircle,
  Clock3,
  CalendarX,
  Settings2,
  ScanLine,
} from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useDeviceState, useDevicesList, useScans } from '../hooks/useDevice'
import { useDeviceId } from '../hooks/useDeviceId'
import { setDeviceMode, simulateScan } from '../services/devices'
import { getStudentByFingerprint } from '../services/students'
import { recordFingerprintAttendance } from '../services/attendance'
import { getSettings } from '../services/settings'
import { Avatar, StatusBadge } from '../components/ui'
import { useNow } from '../components/Clock'
import {
  cn,
  computeStatus,
  dateKey,
  formatDateID,
  formatTime,
  getActivePeriod,
  isoDay,
} from '../lib/utils'
import { beep } from '../lib/sound'
import { defaultRouteFor } from '../components/ProtectedRoute'
import type { AttendanceStatus, Schedule, SchoolSettings, Student } from '../lib/types'

type ResultType = 'success' | 'late' | 'duplicate' | 'unknown' | 'no_schedule' | 'error'
interface ScanResult {
  type: ResultType
  student?: Student
  subjectName?: string
  period?: number
  status?: AttendanceStatus
  time: string
  message: string
}

export default function Kiosk() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const now = useNow()
  const [deviceId, setDeviceId] = useDeviceId()
  const { device, isOnline } = useDeviceState(deviceId)
  const { devices } = useDevicesList()
  const scans = useScans(deviceId, 10)

  const [settings, setSettings] = useState<SchoolSettings | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [processing, setProcessing] = useState(false)
  const [recent, setRecent] = useState<ScanResult[]>([])
  const [showSim, setShowSim] = useState(false)
  const [simId, setSimId] = useState('')

  const mountTime = useRef(Date.now())
  const processedIds = useRef<Set<string>>(new Set())
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>()

  // Muat pengaturan & set perangkat ke mode absensi
  useEffect(() => {
    getSettings().then(setSettings).catch(console.error)
    setDeviceMode(deviceId, 'attendance').catch(() => {})
    return () => {
      setDeviceMode(deviceId, 'idle').catch(() => {})
    }
  }, [deviceId])

  const showResult = useCallback((r: ScanResult) => {
    setResult(r)
    setRecent((prev) => (r.student ? [r, ...prev].slice(0, 8) : prev))
    if (r.type === 'success') beep.success()
    else if (r.type === 'late') beep.warning()
    else beep.error()
    clearTimeout(dismissTimer.current)
    dismissTimer.current = setTimeout(() => setResult(null), 5000)
  }, [])

  const processScan = useCallback(
    async (fingerprintId: number) => {
      if (!settings) return
      setProcessing(true)
      const time = formatTime()
      try {
        const student = await getStudentByFingerprint(fingerprintId, deviceId)
        if (!student) {
          showResult({ type: 'unknown', time, message: `Sidik jari #${fingerprintId} tidak dikenali.` })
          return
        }
        // Tentukan jam pelajaran aktif
        const period = getActivePeriod(settings)
        if (!period) {
          showResult({ type: 'no_schedule', student, time, message: 'Saat ini di luar jam pelajaran.' })
          return
        }
        // Ambil jadwal kelas siswa untuk hari & jam ini
        const snap = await getDocs(
          query(
            collection(db, 'schedules'),
            where('classId', '==', student.classId),
            where('dayOfWeek', '==', isoDay()),
            where('period', '==', period.period),
          ),
        )
        if (snap.empty) {
          showResult({ type: 'no_schedule', student, time, message: `Tidak ada jadwal pada ${period.label}.` })
          return
        }
        const schedule = { id: snap.docs[0].id, ...(snap.docs[0].data() as object) } as Schedule
        const { status, lateMinutes } = computeStatus(period.start, new Date(), settings.lateThresholdMinutes)

        const res = await recordFingerprintAttendance({
          student,
          date: dateKey(),
          scheduleId: schedule.id,
          subjectId: schedule.subjectId,
          subjectName: schedule.subjectName,
          period: period.period,
          status,
          method: 'fingerprint',
          lateMinutes,
          deviceId,
          recordedBy: profile?.uid,
        })

        if (res.duplicate) {
          showResult({
            type: 'duplicate',
            student,
            subjectName: schedule.subjectName,
            period: period.period,
            status: res.status,
            time,
            message: `Sudah absen ${schedule.subjectName} (${period.label}).`,
          })
        } else {
          showResult({
            type: status === 'telat' ? 'late' : 'success',
            student,
            subjectName: schedule.subjectName,
            period: period.period,
            status,
            time,
            message:
              status === 'telat'
                ? `Terlambat ${lateMinutes} menit - ${schedule.subjectName}`
                : `${schedule.subjectName} - ${period.label}`,
          })
        }
      } catch (e) {
        console.error(e)
        showResult({ type: 'error', time, message: 'Terjadi kesalahan saat memproses.' })
      } finally {
        setProcessing(false)
      }
    },
    [settings, deviceId, profile, showResult],
  )

  // Proses event scan baru dari ESP32
  useEffect(() => {
    if (scans.length === 0) return
    const latest = scans[0]
    const id = latest.id ?? String(latest.timestamp)
    if (latest.timestamp < mountTime.current) return
    if (processedIds.current.has(id)) return
    processedIds.current.add(id)
    void processScan(latest.fingerprintId)
  }, [scans, processScan])

  const activePeriod = settings ? getActivePeriod(settings) : null

  const handleExit = async () => {
    if (profile?.role === 'operator') {
      await logout()
      navigate('/login', { replace: true })
    } else {
      navigate(defaultRouteFor(profile!.role))
    }
  }

  const handleSimulate = async () => {
    const fid = parseInt(simId, 10)
    if (!fid) return
    await simulateScan(deviceId, fid)
    setSimId('')
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold">{settings?.schoolName ?? 'Absensi Sekolah'}</h1>
          <p className="text-sm text-white/60">{formatDateID(now)}</p>
        </div>
        <div className="flex items-center gap-3">
          {devices.length > 1 && (
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 focus:outline-none"
              title="Pilih perangkat / kelas"
            >
              <option className="text-slate-800" value={deviceId}>
                {deviceId}
              </option>
              {devices.filter((d) => d.id !== deviceId).map((d) => (
                <option key={d.id} className="text-slate-800" value={d.id}>
                  {d.name ? `${d.name} (${d.id})` : d.id}
                </option>
              ))}
            </select>
          )}
          <div
            className={cn(
              'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold',
              isOnline ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300',
            )}
          >
            {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {deviceId} · {isOnline ? 'Online' : 'Offline'}
          </div>
          <button
            onClick={() => setShowSim((s) => !s)}
            className="rounded-full bg-white/10 p-2 text-white/70 hover:bg-white/20"
            title="Simulasi scan (uji tanpa hardware)"
          >
            <Settings2 className="h-5 w-5" />
          </button>
          <button onClick={handleExit} className="rounded-full bg-white/10 p-2 text-white/70 hover:bg-white/20" title="Keluar">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Panel simulasi (uji tanpa perangkat) */}
      {showSim && (
        <div className="mx-6 mb-2 flex items-center gap-2 rounded-xl bg-white/10 p-3">
          <ScanLine className="h-5 w-5 text-white/70" />
          <input
            value={simId}
            onChange={(e) => setSimId(e.target.value)}
            placeholder="Masukkan ID sidik jari, mis. 1"
            inputMode="numeric"
            className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleSimulate()}
          />
          <button onClick={handleSimulate} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold hover:bg-brand-400">
            Kirim Scan
          </button>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 gap-6 overflow-hidden px-6 pb-6">
        {/* Area scan / hasil */}
        <div className="relative flex flex-1 items-center justify-center">
          {result ? (
            <ResultCard result={result} />
          ) : (
            <IdleScanner clock={formatTime(now)} period={activePeriod?.label} processing={processing} />
          )}
        </div>

        {/* Sidebar absensi terakhir */}
        <aside className="hidden w-80 shrink-0 flex-col rounded-2xl bg-white/5 p-4 backdrop-blur lg:flex">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/80">
            <Clock3 className="h-4 w-4" /> Absensi Terakhir
          </h2>
          <div className="flex-1 space-y-2 overflow-y-auto">
            {recent.length === 0 && <p className="py-8 text-center text-sm text-white/40">Belum ada absensi.</p>}
            {recent.map((r, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
                <Avatar name={r.student!.name} photoUrl={r.student!.photoUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.student!.name}</p>
                  <p className="truncate text-xs text-white/50">
                    {r.student!.className} · {r.time}
                  </p>
                </div>
                {r.status && <StatusBadge status={r.status} />}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

function IdleScanner({ clock, period, processing }: { clock: string; period?: string; processing: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative mb-8 flex h-56 w-56 items-center justify-center">
        <span className="absolute h-full w-full rounded-full bg-brand-500/30 animate-pulse-ring" />
        <span className="absolute h-full w-full rounded-full bg-brand-500/20 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
        <div className="relative flex h-44 w-44 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 shadow-2xl">
          <Fingerprint className={cn('h-24 w-24', processing ? 'animate-pulse text-white' : 'text-white')} />
        </div>
      </div>
      <h2 className="text-3xl font-bold">{processing ? 'Memproses…' : 'Tempelkan Jari Anda'}</h2>
      <p className="mt-2 text-white/60">Letakkan jari pada sensor untuk mencatat kehadiran</p>
      <div className="mt-6 font-mono text-5xl font-bold tabular-nums">{clock}</div>
      <p className="mt-2 rounded-full bg-white/10 px-4 py-1.5 text-sm">
        {period ? `Jam pelajaran aktif: ${period}` : 'Di luar jam pelajaran'}
      </p>
    </div>
  )
}

const RESULT_STYLE: Record<ResultType, { ring: string; icon: JSX.Element; title: string }> = {
  success: { ring: 'from-green-500 to-emerald-600', icon: <CheckCircle2 className="h-16 w-16" />, title: 'Berhasil!' },
  late: { ring: 'from-amber-500 to-orange-600', icon: <Clock3 className="h-16 w-16" />, title: 'Tercatat Terlambat' },
  duplicate: { ring: 'from-sky-500 to-blue-600', icon: <CheckCircle2 className="h-16 w-16" />, title: 'Sudah Absen' },
  unknown: { ring: 'from-red-500 to-rose-600', icon: <XCircle className="h-16 w-16" />, title: 'Tidak Dikenali' },
  no_schedule: { ring: 'from-slate-500 to-slate-600', icon: <CalendarX className="h-16 w-16" />, title: 'Tidak Ada Jadwal' },
  error: { ring: 'from-red-500 to-rose-600', icon: <XCircle className="h-16 w-16" />, title: 'Gagal' },
}

function ResultCard({ result }: { result: ScanResult }) {
  const s = RESULT_STYLE[result.type]
  return (
    <div className="flex w-full max-w-xl animate-scale-in flex-col items-center rounded-3xl bg-white/10 p-10 text-center backdrop-blur">
      <div className={cn('mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-xl', s.ring)}>
        {s.icon}
      </div>
      <h2 className="text-3xl font-bold">{s.title}</h2>
      {result.student ? (
        <>
          <div className="mt-6 flex flex-col items-center gap-3">
            <Avatar name={result.student.name} photoUrl={result.student.photoUrl} size="xl" />
            <div>
              <p className="text-2xl font-bold">{result.student.name}</p>
              <p className="text-white/60">
                {result.student.className} · NIS {result.student.nis}
              </p>
            </div>
          </div>
          {result.status && (
            <div className="mt-4">
              <StatusBadge status={result.status} />
            </div>
          )}
        </>
      ) : null}
      <p className="mt-5 text-lg text-white/80">{result.message}</p>
      <p className="mt-1 font-mono text-sm text-white/50">{result.time}</p>
    </div>
  )
}
