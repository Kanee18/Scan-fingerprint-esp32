import { useState } from 'react'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { BarChart3, Download, Loader2, Search } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db } from '../../lib/firebase'
import { useCollection } from '../../hooks/useFirestore'
import { Button, Card, EmptyState, PageHeader, Select, StatCard } from '../../components/ui'
import { ATTENDANCE_STATUSES, STATUS_META } from '../../lib/constants'
import { cn, dateKey, downloadCSV, formatPercent, toCSV } from '../../lib/utils'
import { eachDayOfInterval, format, subDays } from 'date-fns'
import type { AttendanceRecord, AttendanceStatus, SchoolClass } from '../../lib/types'

const COLORS: Record<AttendanceStatus, string> = {
  hadir: '#22c55e',
  telat: '#f59e0b',
  izin: '#3b82f6',
  sakit: '#a855f7',
  alfa: '#ef4444',
}

interface StudentRecap {
  studentId: string
  name: string
  nis: string
  counts: Record<AttendanceStatus, number>
  total: number
}

export default function Reports() {
  const { data: classes } = useCollection<SchoolClass>('classes', [orderBy('name')])
  const [tab, setTab] = useState<'kelas' | 'sekolah'>('kelas')
  const [start, setStart] = useState(dateKey(subDays(new Date(), 6)))
  const [end, setEnd] = useState(dateKey())
  const [classId, setClassId] = useState('')
  const [loading, setLoading] = useState(false)

  // Per kelas
  const [recap, setRecap] = useState<StudentRecap[] | null>(null)
  const [dailyChart, setDailyChart] = useState<Record<string, number>[]>([])
  const [className, setClassName] = useState('')

  // Sekolah
  const [totals, setTotals] = useState<Record<AttendanceStatus, number> | null>(null)
  const [schoolDaily, setSchoolDaily] = useState<Record<string, number>[]>([])

  const loadKelas = async () => {
    if (!classId) return
    setLoading(true)
    setRecap(null)
    try {
      // Query hanya berdasarkan kelas (tanpa composite index), filter tanggal di client.
      const snap = await getDocs(query(collection(db, 'attendance'), where('classId', '==', classId)))
      const records = snap.docs
        .map((d) => d.data() as AttendanceRecord)
        .filter((r) => r.date >= start && r.date <= end)
      setClassName(classes.find((c) => c.id === classId)?.name ?? '')

      // Rekap per siswa
      const byStudent = new Map<string, StudentRecap>()
      for (const r of records) {
        let s = byStudent.get(r.studentId)
        if (!s) {
          s = { studentId: r.studentId, name: r.studentName, nis: r.nis, counts: emptyCounts(), total: 0 }
          byStudent.set(r.studentId, s)
        }
        s.counts[r.status]++
        s.total++
      }
      setRecap([...byStudent.values()].sort((a, b) => a.name.localeCompare(b.name)))

      // Chart per hari
      const days = eachDayOfInterval({ start: new Date(start), end: new Date(end) })
      const byDay = new Map<string, Record<string, number>>()
      days.forEach((d) => byDay.set(dateKey(d), { day: format(d, 'dd/MM') as unknown as number, hadir: 0, telat: 0, izin: 0, sakit: 0, alfa: 0 }))
      for (const r of records) {
        const row = byDay.get(r.date)
        if (row) row[r.status]++
      }
      setDailyChart([...byDay.values()])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadSekolah = async () => {
    setLoading(true)
    setTotals(null)
    try {
      // Range pada satu field (date) memakai index otomatis - tanpa composite index.
      const snap = await getDocs(
        query(collection(db, 'attendance'), where('date', '>=', start), where('date', '<=', end)),
      )
      const recs = snap.docs.map((d) => d.data() as AttendanceRecord)

      const t = emptyCounts()
      recs.forEach((r) => t[r.status]++)
      setTotals(t)

      // per hari (hadir vs telat vs alfa) - batasi 31 hari
      const days = eachDayOfInterval({ start: new Date(start), end: new Date(end) }).slice(0, 31)
      const byDay = new Map<string, Record<string, number>>()
      days.forEach((d) =>
        byDay.set(dateKey(d), { day: format(d, 'dd/MM') as unknown as number, hadir: 0, telat: 0, alfa: 0 }),
      )
      recs.forEach((r) => {
        const row = byDay.get(r.date)
        if (row && (r.status === 'hadir' || r.status === 'telat' || r.status === 'alfa')) row[r.status]++
      })
      setSchoolDaily([...byDay.values()])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const exportRecap = () => {
    if (!recap) return
    const rows = recap.map((r) => ({
      nis: r.nis,
      nama: r.name,
      hadir: r.counts.hadir,
      terlambat: r.counts.telat,
      izin: r.counts.izin,
      sakit: r.counts.sakit,
      alfa: r.counts.alfa,
      total: r.total,
      persen_hadir: formatPercent(r.total ? (r.counts.hadir + r.counts.telat) / r.total : 0),
    }))
    downloadCSV(`rekap-${className}-${start}-${end}.csv`, toCSV(rows))
  }

  return (
    <div>
      <PageHeader title="Laporan & Rekap" desc="Rekapitulasi kehadiran berdasarkan rentang tanggal." />

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab('kelas')}
          className={cn('btn', tab === 'kelas' ? 'btn-primary' : 'btn-secondary')}
        >
          Rekap per Kelas
        </button>
        <button
          onClick={() => setTab('sekolah')}
          className={cn('btn', tab === 'sekolah' ? 'btn-primary' : 'btn-secondary')}
        >
          Ringkasan Sekolah
        </button>
      </div>

      <Card className="mb-4 p-4">
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Dari Tanggal</label>
            <input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="label">Sampai Tanggal</label>
            <input type="date" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          {tab === 'kelas' && (
            <Select label="Kelas" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Pilih kelas…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          <Button
            onClick={tab === 'kelas' ? loadKelas : loadSekolah}
            loading={loading}
            disabled={tab === 'kelas' && !classId}
            icon={<Search className="h-4 w-4" />}
          >
            Tampilkan
          </Button>
        </div>
      </Card>

      {tab === 'kelas' ? (
        loading ? (
          <Card className="p-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-600" /></Card>
        ) : !recap ? (
          <Card><EmptyState icon={<BarChart3 className="h-8 w-8" />} title="Pilih kelas & tekan Tampilkan" /></Card>
        ) : recap.length === 0 ? (
          <Card><EmptyState icon={<BarChart3 className="h-8 w-8" />} title="Tidak ada data" desc="Tidak ada catatan absensi pada rentang ini." /></Card>
        ) : (
          <>
            <Card className="mb-4 p-5">
              <h3 className="mb-4 font-semibold text-slate-800">Tren Harian - {className}</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={32} />
                  <Tooltip />
                  <Legend />
                  {ATTENDANCE_STATUSES.map((s) => (
                    <Bar key={s} dataKey={s} stackId="a" name={STATUS_META[s].label} fill={COLORS[s]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <h3 className="font-semibold text-slate-800">Rekap per Siswa ({recap.length})</h3>
                <Button variant="secondary" size="sm" onClick={exportRecap} icon={<Download className="h-4 w-4" />}>
                  Ekspor CSV
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-y border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Siswa</th>
                      {ATTENDANCE_STATUSES.map((s) => (
                        <th key={s} className="px-3 py-3 text-center">{STATUS_META[s].label}</th>
                      ))}
                      <th className="px-3 py-3 text-center">% Hadir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recap.map((r) => (
                      <tr key={r.studentId} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-slate-700">{r.name}</p>
                          <p className="text-xs text-slate-400">{r.nis}</p>
                        </td>
                        {ATTENDANCE_STATUSES.map((s) => (
                          <td key={s} className="px-3 py-2.5 text-center font-medium text-slate-600">{r.counts[s] || '-'}</td>
                        ))}
                        <td className="px-3 py-2.5 text-center font-semibold text-brand-700">
                          {formatPercent(r.total ? (r.counts.hadir + r.counts.telat) / r.total : 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )
      ) : loading ? (
        <Card className="p-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-600" /></Card>
      ) : !totals ? (
        <Card><EmptyState icon={<BarChart3 className="h-8 w-8" />} title="Tekan Tampilkan untuk memuat ringkasan" /></Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
            {ATTENDANCE_STATUSES.map((s) => (
              <StatCard
                key={s}
                label={STATUS_META[s].label}
                value={totals[s].toLocaleString('id-ID')}
                accent={s === 'hadir' ? 'green' : s === 'telat' ? 'amber' : s === 'alfa' ? 'red' : 'violet'}
              />
            ))}
          </div>
          <Card className="p-5">
            <h3 className="mb-4 font-semibold text-slate-800">Tren Harian Sekolah</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={schoolDaily}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="hadir" name="Hadir" fill={COLORS.hadir} radius={[4, 4, 0, 0]} />
                <Bar dataKey="telat" name="Terlambat" fill={COLORS.telat} radius={[4, 4, 0, 0]} />
                <Bar dataKey="alfa" name="Alfa" fill={COLORS.alfa} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  )
}

function emptyCounts(): Record<AttendanceStatus, number> {
  return { hadir: 0, telat: 0, izin: 0, sakit: 0, alfa: 0 }
}
