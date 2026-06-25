import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { Users, Fingerprint, ClipboardCheck, UserX, Download } from 'lucide-react'
import { db } from '../../lib/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import { Avatar, Button, Card, EmptyState, PageHeader, Select, StatCard } from '../../components/ui'
import { ATTENDANCE_STATUSES, STATUS_META } from '../../lib/constants'
import { cn, dateKey, downloadCSV, formatDateID, formatPercent, isoDay, toCSV } from '../../lib/utils'
import { subDays } from 'date-fns'
import type { AttendanceRecord, AttendanceStatus, Schedule, SchoolClass, Student } from '../../lib/types'

export default function WaliDashboard() {
  const { profile } = useAuth()
  const { data: classes } = useCollection<SchoolClass>('classes', [orderBy('name')])
  const [pickClass, setPickClass] = useState('')

  // Wali kelas memakai kelas binaannya; admin bisa memilih
  const classId = profile?.role === 'wali_kelas' ? profile.classId ?? '' : pickClass
  const cls = classes.find((c) => c.id === classId)
  const today = dateKey()
  const day = isoDay()

  const { data: studentsRaw } = useCollection<Student>(
    classId ? 'students' : null,
    [where('classId', '==', classId)],
    [classId],
  )
  const students = useMemo(
    () => [...studentsRaw].sort((a, b) => a.name.localeCompare(b.name)),
    [studentsRaw],
  )
  const { data: schedules } = useCollection<Schedule>(
    classId ? 'schedules' : null,
    [where('classId', '==', classId), where('dayOfWeek', '==', day)],
    [classId, day],
  )
  const { data: todayRecords } = useCollection<AttendanceRecord>(
    classId ? 'attendance' : null,
    [where('classId', '==', classId), where('date', '==', today)],
    [classId, today],
  )

  // Rekap mingguan (7 hari)
  const [weekRecap, setWeekRecap] = useState<Map<string, Record<AttendanceStatus, number>>>(new Map())
  useEffect(() => {
    if (!classId) return
    const start = dateKey(subDays(new Date(), 6))
    getDocs(
      query(collection(db, 'attendance'), where('classId', '==', classId), where('date', '>=', start), where('date', '<=', today)),
    ).then((snap) => {
      const m = new Map<string, Record<AttendanceStatus, number>>()
      snap.forEach((d) => {
        const r = d.data() as AttendanceRecord
        if (!m.has(r.studentId)) m.set(r.studentId, { hadir: 0, telat: 0, izin: 0, sakit: 0, alfa: 0 })
        m.get(r.studentId)![r.status]++
      })
      setWeekRecap(m)
    })
  }, [classId, today])

  const sortedSchedules = useMemo(() => [...schedules].sort((a, b) => a.period - b.period), [schedules])
  const recMap = useMemo(() => {
    const m = new Map<string, AttendanceRecord>()
    todayRecords.forEach((r) => m.set(`${r.studentId}_${r.scheduleId}`, r))
    return m
  }, [todayRecords])

  const stats = useMemo(() => {
    const enrolled = students.filter((s) => s.fingerprintId).length
    const alfa = todayRecords.filter((r) => r.status === 'alfa').length
    return { total: students.length, enrolled, recorded: todayRecords.length, alfa }
  }, [students, todayRecords])

  const exportWeek = () => {
    const rows = students.map((s) => {
      const c = weekRecap.get(s.id) ?? { hadir: 0, telat: 0, izin: 0, sakit: 0, alfa: 0 }
      const total = ATTENDANCE_STATUSES.reduce((a, k) => a + c[k], 0)
      return {
        nis: s.nis,
        nama: s.name,
        hadir: c.hadir,
        terlambat: c.telat,
        izin: c.izin,
        sakit: c.sakit,
        alfa: c.alfa,
        persen_hadir: formatPercent(total ? (c.hadir + c.telat) / total : 0),
      }
    })
    downloadCSV(`rekap-mingguan-${cls?.name ?? 'kelas'}.csv`, toCSV(rows))
  }

  return (
    <div>
      <PageHeader
        title={cls ? `Wali Kelas · ${cls.name}` : 'Dashboard Wali Kelas'}
        desc={formatDateID()}
        actions={
          classId ? (
            <Button variant="secondary" onClick={exportWeek} icon={<Download className="h-4 w-4" />}>
              Ekspor Rekap Mingguan
            </Button>
          ) : undefined
        }
      />

      {profile?.role !== 'wali_kelas' && (
        <Card className="mb-4 p-4">
          <Select label="Pilih Kelas (mode admin)" value={pickClass} onChange={(e) => setPickClass(e.target.value)}>
            <option value="">Pilih kelas…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Card>
      )}

      {!classId ? (
        <Card>
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title={profile?.role === 'wali_kelas' ? 'Belum ada kelas binaan' : 'Pilih kelas'}
            desc={
              profile?.role === 'wali_kelas'
                ? 'Akun Anda belum dikaitkan dengan kelas. Hubungi administrator.'
                : 'Pilih kelas untuk melihat data.'
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Jumlah Siswa" value={stats.total} icon={<Users className="h-6 w-6" />} accent="brand" />
            <StatCard label="Sidik Jari" value={stats.enrolled} icon={<Fingerprint className="h-6 w-6" />} accent="green" />
            <StatCard label="Tercatat Hari Ini" value={stats.recorded} icon={<ClipboardCheck className="h-6 w-6" />} accent="amber" />
            <StatCard label="Alfa Hari Ini" value={stats.alfa} icon={<UserX className="h-6 w-6" />} accent="red" />
          </div>

          {/* Kehadiran hari ini per jam pelajaran */}
          <Card className="mt-4 overflow-x-auto p-0">
            <div className="p-4">
              <h3 className="font-semibold text-slate-800">Kehadiran Hari Ini</h3>
              <p className="text-xs text-slate-400">Status per jam pelajaran (otomatis dari sidik jari).</p>
            </div>
            {sortedSchedules.length === 0 ? (
              <EmptyState title="Tidak ada jadwal hari ini" />
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-500">
                    <th className="sticky left-0 z-10 border-y border-slate-100 bg-slate-50 px-3 py-3 text-left">Siswa</th>
                    {sortedSchedules.map((s) => (
                      <th key={s.id} className="border-y border-l border-slate-100 px-2 py-2 text-center">
                        <div className="font-semibold text-slate-700">Jam {s.period}</div>
                        <div className="text-[11px] font-normal text-slate-400">{s.subjectName}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {students.map((st) => (
                    <tr key={st.id}>
                      <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar name={st.name} size="sm" />
                          <span className="truncate text-sm font-medium text-slate-700">{st.name}</span>
                        </div>
                      </td>
                      {sortedSchedules.map((s) => {
                        const rec = recMap.get(`${st.id}_${s.id}`)
                        return (
                          <td key={s.id} className="border-l border-slate-100 p-1 text-center">
                            <span
                              className={cn(
                                'inline-block w-full rounded-md py-1.5 text-xs font-semibold',
                                rec ? `${STATUS_META[rec.status].bg} ${STATUS_META[rec.status].text}` : 'text-slate-300',
                              )}
                            >
                              {rec ? STATUS_META[rec.status].label : '—'}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Rekap mingguan */}
          <Card className="mt-4 overflow-x-auto">
            <div className="p-4">
              <h3 className="font-semibold text-slate-800">Rekap 7 Hari Terakhir</h3>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Siswa</th>
                  {ATTENDANCE_STATUSES.map((s) => (
                    <th key={s} className="px-3 py-3 text-center">
                      {STATUS_META[s].label}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center">% Hadir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {students.map((st) => {
                  const c = weekRecap.get(st.id) ?? { hadir: 0, telat: 0, izin: 0, sakit: 0, alfa: 0 }
                  const total = ATTENDANCE_STATUSES.reduce((a, k) => a + c[k], 0)
                  return (
                    <tr key={st.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 font-medium text-slate-700">{st.name}</td>
                      {ATTENDANCE_STATUSES.map((s) => (
                        <td key={s} className="px-3 py-2.5 text-center text-slate-600">
                          {c[s] || '-'}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-center font-semibold text-brand-700">
                        {formatPercent(total ? (c.hadir + c.telat) / total : 0)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  )
}
