import { useEffect, useMemo, useState } from 'react'
import { orderBy, where } from 'firebase/firestore'
import { ClipboardCheck, CalendarX, Eraser, Wand2 } from 'lucide-react'
import { useCollection } from '../../hooks/useFirestore'
import { getSettings } from '../../services/settings'
import { upsertAttendance, attendanceDocId } from '../../services/attendance'
import { removeOne } from '../../services/db'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Avatar, Button, Card, EmptyState, Modal, PageHeader, Select, StatusBadge } from '../../components/ui'
import { ATTENDANCE_STATUSES, STATUS_META } from '../../lib/constants'
import { cn, dateKey, isoDay } from '../../lib/utils'
import type { AttendanceRecord, AttendanceStatus, Schedule, SchoolClass, SchoolSettings, Student } from '../../lib/types'

export default function Attendance() {
  const { profile } = useAuth()
  const toast = useToast()
  const [settings, setSettings] = useState<SchoolSettings | null>(null)
  const [date, setDate] = useState(dateKey())
  const [classId, setClassId] = useState('')

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error)
  }, [])

  const { data: classes } = useCollection<SchoolClass>('classes', [orderBy('name')])
  const day = isoDay(new Date(date + 'T00:00:00'))

  const { data: schedules } = useCollection<Schedule>(
    classId ? 'schedules' : null,
    [where('classId', '==', classId), where('dayOfWeek', '==', day)],
    [classId, day],
  )
  const { data: studentsRaw } = useCollection<Student>(
    classId ? 'students' : null,
    [where('classId', '==', classId)],
    [classId],
  )
  const students = useMemo(
    () => [...studentsRaw].sort((a, b) => a.name.localeCompare(b.name)),
    [studentsRaw],
  )
  const { data: records } = useCollection<AttendanceRecord>(
    classId ? 'attendance' : null,
    [where('classId', '==', classId), where('date', '==', date)],
    [classId, date],
  )

  const sortedSchedules = useMemo(() => [...schedules].sort((a, b) => a.period - b.period), [schedules])
  const recMap = useMemo(() => {
    const m = new Map<string, AttendanceRecord>()
    records.forEach((r) => m.set(`${r.studentId}_${r.scheduleId}`, r))
    return m
  }, [records])

  // ---- Editor ----
  const [cell, setCell] = useState<{ student: Student; schedule: Schedule } | null>(null)

  const setStatus = async (status: AttendanceStatus) => {
    if (!cell) return
    const periodCfg = settings?.periods.find((p) => p.period === cell.schedule.period)
    await upsertAttendance({
      student: cell.student,
      date,
      scheduleId: cell.schedule.id,
      subjectId: cell.schedule.subjectId,
      subjectName: cell.schedule.subjectName,
      period: cell.schedule.period,
      status,
      method: 'manual',
      recordedBy: profile?.uid,
      scannedAt: new Date(`${date}T${periodCfg?.start ?? '07:00'}:00`),
    })
    toast.success(`Ditandai ${STATUS_META[status].label}.`)
    setCell(null)
  }

  const clearCell = async () => {
    if (!cell) return
    await removeOne('attendance', attendanceDocId(date, cell.student.id, cell.schedule.id))
    toast.success('Catatan dihapus.')
    setCell(null)
  }

  // Tandai alfa untuk semua siswa yang belum ada catatan pada satu jam pelajaran
  const fillAlfa = async (schedule: Schedule) => {
    const periodCfg = settings?.periods.find((p) => p.period === schedule.period)
    const targets = students.filter((s) => !recMap.has(`${s.id}_${schedule.id}`))
    if (targets.length === 0) {
      toast.info('Semua siswa sudah memiliki catatan.')
      return
    }
    await Promise.all(
      targets.map((s) =>
        upsertAttendance({
          student: s,
          date,
          scheduleId: schedule.id,
          subjectId: schedule.subjectId,
          subjectName: schedule.subjectName,
          period: schedule.period,
          status: 'alfa',
          method: 'manual',
          recordedBy: profile?.uid,
          scannedAt: new Date(`${date}T${periodCfg?.start ?? '07:00'}:00`),
        }),
      ),
    )
    toast.success(`${targets.length} siswa ditandai Alfa.`)
  }

  return (
    <div>
      <PageHeader title="Absensi" desc="Lihat & koreksi kehadiran siswa per jam pelajaran." />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Tanggal</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Select label="Kelas" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Pilih kelas…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {!classId ? (
        <Card>
          <EmptyState icon={<ClipboardCheck className="h-8 w-8" />} title="Pilih kelas & tanggal" />
        </Card>
      ) : sortedSchedules.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarX className="h-8 w-8" />} title="Tidak ada jadwal" desc="Tidak ada jadwal pelajaran untuk kelas ini di hari tersebut." />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500">
                <th className="sticky left-0 z-10 border-b border-slate-100 bg-slate-50 px-3 py-3 text-left">Siswa</th>
                {sortedSchedules.map((s) => (
                  <th key={s.id} className="border-b border-l border-slate-100 px-2 py-2 text-center">
                    <div className="font-semibold text-slate-700">Jam {s.period}</div>
                    <div className="text-[11px] font-normal text-slate-400">{s.subjectName}</div>
                    <button
                      onClick={() => fillAlfa(s)}
                      className="mt-1 inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-100"
                      title="Isi Alfa untuk yang kosong"
                    >
                      <Wand2 className="h-3 w-3" /> Alfa
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {students.map((st) => (
                <tr key={st.id} className="hover:bg-slate-50/60">
                  <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar name={st.name} photoUrl={st.photoUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700">{st.name}</p>
                        <p className="text-[11px] text-slate-400">{st.nis}</p>
                      </div>
                    </div>
                  </td>
                  {sortedSchedules.map((s) => {
                    const rec = recMap.get(`${st.id}_${s.id}`)
                    return (
                      <td key={s.id} className="border-l border-slate-100 p-1 text-center">
                        <button
                          onClick={() => setCell({ student: st, schedule: s })}
                          className={cn(
                            'h-9 w-full rounded-lg text-xs font-semibold transition',
                            rec ? `${STATUS_META[rec.status].bg} ${STATUS_META[rec.status].text}` : 'text-slate-300 hover:bg-slate-100',
                          )}
                        >
                          {rec ? STATUS_META[rec.status].label : '—'}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={!!cell}
        onClose={() => setCell(null)}
        title="Ubah Status Kehadiran"
        footer={
          <>
            <Button variant="ghost" onClick={clearCell} icon={<Eraser className="h-4 w-4" />}>
              Kosongkan
            </Button>
            <div className="flex-1" />
            <Button variant="secondary" onClick={() => setCell(null)}>
              Tutup
            </Button>
          </>
        }
      >
        {cell && (
          <div>
            <div className="mb-4 flex items-center gap-3">
              <Avatar name={cell.student.name} size="lg" />
              <div>
                <p className="font-bold text-slate-800">{cell.student.name}</p>
                <p className="text-sm text-slate-400">
                  Jam {cell.schedule.period} · {cell.schedule.subjectName}
                </p>
              </div>
            </div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              Status saat ini:{' '}
              {recMap.get(`${cell.student.id}_${cell.schedule.id}`) ? (
                <StatusBadge status={recMap.get(`${cell.student.id}_${cell.schedule.id}`)!.status} />
              ) : (
                <span className="text-slate-400">belum ada</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ATTENDANCE_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn('btn touch-target justify-start', STATUS_META[s].bg, STATUS_META[s].text, 'hover:opacity-80')}
                >
                  <span className={cn('h-2.5 w-2.5 rounded-full', STATUS_META[s].dot)} />
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
