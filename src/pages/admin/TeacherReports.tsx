import { useState } from 'react'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { endOfMonth, format } from 'date-fns'
import { id as localeID } from 'date-fns/locale'
import { Mail, Download, Printer, Search, Loader2, FileText } from 'lucide-react'
import { db } from '../../lib/firebase'
import { useCollection } from '../../hooks/useFirestore'
import { Button, Card, EmptyState, PageHeader, Select } from '../../components/ui'
import { ATTENDANCE_STATUSES, STATUS_META } from '../../lib/constants'
import { dateKey, downloadCSV, formatPercent, toCSV } from '../../lib/utils'
import type { AttendanceRecord, AttendanceStatus, Schedule, Student, Teacher } from '../../lib/types'

interface StudentRow {
  studentId: string
  name: string
  nis: string
  counts: Record<AttendanceStatus, number>
  total: number
}
interface RecapGroup {
  classId: string
  className: string
  subjectId: string
  subjectName: string
  students: StudentRow[]
}

function emptyCounts(): Record<AttendanceStatus, number> {
  return { hadir: 0, telat: 0, izin: 0, sakit: 0, alfa: 0 }
}

export default function TeacherReports() {
  const { data: teachers } = useCollection<Teacher>('teachers', [orderBy('name')])
  const [teacherId, setTeacherId] = useState('')
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState<RecapGroup[] | null>(null)

  const teacher = teachers.find((t) => t.id === teacherId)
  const monthLabel = format(new Date(month + '-01'), 'MMMM yyyy', { locale: localeID })

  const generate = async () => {
    if (!teacherId) return
    setLoading(true)
    setGroups(null)
    try {
      const start = `${month}-01`
      const end = dateKey(endOfMonth(new Date(month + '-01')))

      // 1) Slot jadwal yang diampu guru ini -> pasangan unik (kelas, mapel)
      const slotSnap = await getDocs(query(collection(db, 'schedules'), where('teacherId', '==', teacherId)))
      const slots = slotSnap.docs.map((d) => d.data() as Schedule)
      const pairMap = new Map<string, { classId: string; className: string; subjectId: string; subjectName: string }>()
      slots.forEach((s) =>
        pairMap.set(`${s.classId}__${s.subjectId}`, {
          classId: s.classId,
          className: s.className,
          subjectId: s.subjectId,
          subjectName: s.subjectName,
        }),
      )
      const pairs = [...pairMap.values()]
      if (pairs.length === 0) {
        setGroups([])
        return
      }

      // 2) Ambil siswa & absensi per kelas (query equality tunggal -> tanpa composite index)
      const classIds = [...new Set(pairs.map((p) => p.classId))]
      const studentsByClass = new Map<string, Student[]>()
      const attByClass = new Map<string, AttendanceRecord[]>()
      await Promise.all(
        classIds.map(async (cid) => {
          const [stSnap, atSnap] = await Promise.all([
            getDocs(query(collection(db, 'students'), where('classId', '==', cid))),
            getDocs(query(collection(db, 'attendance'), where('classId', '==', cid))),
          ])
          studentsByClass.set(
            cid,
            stSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as Student),
          )
          attByClass.set(
            cid,
            atSnap.docs.map((d) => d.data() as AttendanceRecord).filter((r) => r.date >= start && r.date <= end),
          )
        }),
      )

      // 3) Rekap per pasangan (kelas, mapel)
      const result: RecapGroup[] = pairs.map((p) => {
        const students = (studentsByClass.get(p.classId) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name))
        const recs = (attByClass.get(p.classId) ?? []).filter((r) => r.subjectId === p.subjectId)
        const byStudent = new Map<string, StudentRow>()
        students.forEach((s) => byStudent.set(s.id, { studentId: s.id, name: s.name, nis: s.nis, counts: emptyCounts(), total: 0 }))
        recs.forEach((r) => {
          const row = byStudent.get(r.studentId)
          if (row) {
            row.counts[r.status]++
            row.total++
          }
        })
        return { ...p, students: [...byStudent.values()] }
      })
      result.sort((a, b) => a.className.localeCompare(b.className) || a.subjectName.localeCompare(b.subjectName))
      setGroups(result)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const exportCSV = () => {
    if (!groups || !teacher) return
    const rows = groups.flatMap((g) =>
      g.students.map((s) => ({
        kelas: g.className,
        mapel: g.subjectName,
        nis: s.nis,
        nama: s.name,
        hadir: s.counts.hadir,
        terlambat: s.counts.telat,
        izin: s.counts.izin,
        sakit: s.counts.sakit,
        alfa: s.counts.alfa,
        persen_hadir: formatPercent(s.total ? (s.counts.hadir + s.counts.telat) / s.total : 0),
      })),
    )
    downloadCSV(`rekap-${teacher.name}-${month}.csv`, toCSV(rows))
  }

  return (
    <div>
      <PageHeader
        title="Rekap per Guru"
        desc="Rekap kehadiran siswa untuk mata pelajaran yang diampu tiap guru, per bulan."
      />

      <Card className="mb-4 p-4 print:hidden">
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Guru" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">Pilih guru…</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <div>
            <label className="label">Bulan</label>
            <input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <Button onClick={generate} loading={loading} disabled={!teacherId} icon={<Search className="h-4 w-4" />}>
            Tampilkan
          </Button>
          {groups && groups.length > 0 && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={exportCSV} icon={<Download className="h-4 w-4" />}>
                CSV
              </Button>
              <Button variant="secondary" onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>
                Cetak
              </Button>
            </div>
          )}
        </div>
        {teacher && (teacher.subjectIds?.length ?? 0) > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            Email: {teacher.email} · Mengampu {teacher.subjectIds.length} mata pelajaran
          </p>
        )}
      </Card>

      {loading ? (
        <Card className="p-10 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-600" />
        </Card>
      ) : !groups ? (
        <Card>
          <EmptyState icon={<FileText className="h-8 w-8" />} title="Pilih guru & bulan, lalu Tampilkan" />
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="Tidak ada data"
            desc="Guru ini belum memiliki jadwal mengajar (pastikan guru sudah ditetapkan di menu Jadwal)."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Kop untuk cetak */}
          <div className="hidden print:block">
            <h2 className="text-lg font-bold">Rekap Kehadiran — {teacher?.name}</h2>
            <p className="text-sm">Periode: {monthLabel}</p>
          </div>

          {groups.map((g) => (
            <Card key={`${g.classId}__${g.subjectId}`} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                <h3 className="font-semibold text-slate-800">
                  {g.className} · {g.subjectName}
                </h3>
                <span className="text-xs text-slate-400">{g.students.length} siswa</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Siswa</th>
                      {ATTENDANCE_STATUSES.map((s) => (
                        <th key={s} className="px-3 py-2 text-center">
                          {STATUS_META[s].label}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-center">% Hadir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {g.students.map((s) => (
                      <tr key={s.studentId} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2">
                          <p className="font-medium text-slate-700">{s.name}</p>
                          <p className="text-xs text-slate-400">{s.nis}</p>
                        </td>
                        {ATTENDANCE_STATUSES.map((st) => (
                          <td key={st} className="px-3 py-2 text-center text-slate-600">
                            {s.counts[st] || '-'}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center font-semibold text-brand-700">
                          {formatPercent(s.total ? (s.counts.hadir + s.counts.telat) / s.total : 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
