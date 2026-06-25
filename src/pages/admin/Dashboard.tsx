import { useEffect, useState } from 'react'
import { collection, getCountFromServer, query, where } from 'firebase/firestore'
import {
  Users,
  GraduationCap,
  Fingerprint,
  ClipboardCheck,
  Cpu,
  Wifi,
  WifiOff,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { db } from '../../lib/firebase'
import { Card, PageHeader, StatCard, Skeleton } from '../../components/ui'
import { useDevicesList } from '../../hooks/useDevice'
import { ATTENDANCE_STATUSES, STATUS_META } from '../../lib/constants'
import { dateKey, formatPercent } from '../../lib/utils'
import { subDays, format } from 'date-fns'
import { id as localeID } from 'date-fns/locale'
import type { AttendanceStatus } from '../../lib/types'

async function countWhere(col: string, ...filters: [string, '==', unknown][]) {
  const q = query(collection(db, col), ...filters.map((f) => where(f[0], f[1], f[2])))
  const snap = await getCountFromServer(q)
  return snap.data().count
}

export default function Dashboard() {
  const { devices } = useDevicesList()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ students: 0, classes: 0, enrolled: 0, today: 0 })
  const [statusToday, setStatusToday] = useState<{ name: string; value: number; color: string }[]>([])
  const [trend, setTrend] = useState<{ day: string; hadir: number; telat: number }[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const today = dateKey()
        const [students, classes, enrolled] = await Promise.all([
          countWhere('students'),
          countWhere('classes'),
          // siswa dengan fingerprintId terisi
          getCountFromServer(query(collection(db, 'students'), where('fingerprintId', '>', 0))).then((s) => s.data().count),
        ])

        // Breakdown status hari ini
        const statusCounts = await Promise.all(
          ATTENDANCE_STATUSES.map((s) => countWhere('attendance', ['date', '==', today], ['status', '==', s])),
        )
        const todayTotal = statusCounts.reduce((a, b) => a + b, 0)
        setStatusToday(
          ATTENDANCE_STATUSES.map((s, i) => ({
            name: STATUS_META[s].label,
            value: statusCounts[i],
            color: STATUS_COLORS[s],
          })).filter((d) => d.value > 0),
        )

        // Tren 7 hari terakhir
        const days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i))
        const trendData = await Promise.all(
          days.map(async (d) => {
            const dk = dateKey(d)
            const [hadir, telat] = await Promise.all([
              countWhere('attendance', ['date', '==', dk], ['status', '==', 'hadir']),
              countWhere('attendance', ['date', '==', dk], ['status', '==', 'telat']),
            ])
            return { day: format(d, 'EEE', { locale: localeID }), hadir, telat }
          }),
        )
        setTrend(trendData)
        setStats({ students, classes, enrolled, today: todayTotal })
      } catch (e) {
        console.error('Gagal memuat dashboard:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const onlineCount = devices.filter((d) => d.status === 'online').length

  return (
    <div>
      <PageHeader title="Dashboard" desc="Ringkasan kehadiran & status sistem hari ini." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatCard label="Total Siswa" value={stats.students.toLocaleString('id-ID')} icon={<Users className="h-6 w-6" />} accent="brand" />
            <StatCard label="Total Kelas" value={stats.classes} icon={<GraduationCap className="h-6 w-6" />} accent="violet" />
            <StatCard
              label="Sidik Jari Terdaftar"
              value={stats.enrolled.toLocaleString('id-ID')}
              sub={stats.students ? formatPercent(stats.enrolled / stats.students) + ' dari siswa' : undefined}
              icon={<Fingerprint className="h-6 w-6" />}
              accent="green"
            />
            <StatCard label="Tercatat Hari Ini" value={stats.today.toLocaleString('id-ID')} icon={<ClipboardCheck className="h-6 w-6" />} accent="amber" />
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Tren 7 hari */}
        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-800">
            <TrendingUp className="h-5 w-5 text-brand-600" /> Tren Kehadiran 7 Hari Terakhir
          </h3>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trend} barGap={2}>
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={32} />
                <Tooltip />
                <Legend />
                <Bar dataKey="hadir" name="Hadir" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="telat" name="Terlambat" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Distribusi status hari ini */}
        <Card className="p-5">
          <h3 className="mb-4 font-semibold text-slate-800">Status Hari Ini</h3>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : statusToday.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-400">Belum ada absensi hari ini.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusToday} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {statusToday.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Perangkat */}
      <Card className="mt-4 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-slate-800">
            <Cpu className="h-5 w-5 text-brand-600" /> Perangkat ESP32
          </h3>
          <span className="text-sm text-slate-500">
            {onlineCount}/{devices.length} online
          </span>
        </div>
        {devices.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Belum ada perangkat terdeteksi. Hidupkan ESP32 agar muncul di sini.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {devices.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    d.status === 'online' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                  }`}
                >
                  {d.status === 'online' ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-700">{d.name || d.id}</p>
                  <p className="truncate text-xs text-slate-400">{d.location || 'Tanpa lokasi'} · mode: {d.mode || '—'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  hadir: '#22c55e',
  telat: '#f59e0b',
  izin: '#3b82f6',
  sakit: '#a855f7',
  alfa: '#ef4444',
}
