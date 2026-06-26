import { useEffect, useMemo, useState } from 'react'
import { orderBy, where } from 'firebase/firestore'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { useCollection } from '../../hooks/useFirestore'
import { setOne, removeOne } from '../../services/db'
import { getSettings } from '../../services/settings'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Button, Card, EmptyState, Modal, PageHeader, Select } from '../../components/ui'
import { DAYS } from '../../lib/constants'
import { cn } from '../../lib/utils'
import type { PeriodConfig, Schedule, SchoolClass, SchoolSettings, Subject, Teacher } from '../../lib/types'

function scheduleId(classId: string, day: number, period: number) {
  return `${classId}_${day}_${period}`
}

export default function Schedules() {
  const toast = useToast()
  const confirm = useConfirm()
  const { data: classes } = useCollection<SchoolClass>('classes', [orderBy('name')])
  const { data: subjects } = useCollection<Subject>('subjects', [orderBy('name')])
  const { data: teachers } = useCollection<Teacher>('teachers', [orderBy('name')])
  const [settings, setSettings] = useState<SchoolSettings | null>(null)
  const [classId, setClassId] = useState('')

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error)
  }, [])

  const { data: schedules } = useCollection<Schedule>(
    classId ? 'schedules' : null,
    [where('classId', '==', classId)],
    [classId],
  )

  const map = useMemo(() => {
    const m = new Map<string, Schedule>()
    schedules.forEach((s) => m.set(`${s.dayOfWeek}_${s.period}`, s))
    return m
  }, [schedules])

  const activeDays = settings?.activeDays ?? [1, 2, 3, 4, 5]
  const periods = settings?.periods ?? []
  const days = DAYS.filter((d) => activeDays.includes(d.value))
  const selectedClass = classes.find((c) => c.id === classId)

  // ---- Cell editor ----
  const [editCell, setEditCell] = useState<{ day: number; period: PeriodConfig } | null>(null)
  const [subjectId, setSubjectId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [saving, setSaving] = useState(false)

  // Guru yang relevan untuk mapel terpilih (yang mengampu mapel itu), fallback semua guru
  const teacherOptions = useMemo(() => {
    const matched = teachers.filter((t) => (t.subjectIds ?? []).includes(subjectId))
    return matched.length > 0 ? matched : teachers
  }, [teachers, subjectId])

  const openCell = (day: number, period: PeriodConfig) => {
    const existing = map.get(`${day}_${period.period}`)
    setSubjectId(existing?.subjectId ?? '')
    setTeacherId(existing?.teacherId ?? '')
    setEditCell({ day, period })
  }

  const saveCell = async () => {
    if (!editCell || !selectedClass || !subjectId) {
      toast.error('Pilih mata pelajaran.')
      return
    }
    const subj = subjects.find((s) => s.id === subjectId)
    if (!subj) return
    const teacher = teachers.find((t) => t.id === teacherId)
    setSaving(true)
    try {
      const id = scheduleId(classId, editCell.day, editCell.period.period)
      await setOne(
        'schedules',
        id,
        {
          classId,
          className: selectedClass.name,
          dayOfWeek: editCell.day,
          period: editCell.period.period,
          subjectId: subj.id,
          subjectName: subj.name,
          teacherId: teacher?.id ?? null,
          teacherName: teacher?.name ?? null,
        },
        false,
      )
      toast.success('Jadwal disimpan.')
      setEditCell(null)
    } catch {
      toast.error('Gagal menyimpan jadwal.')
    } finally {
      setSaving(false)
    }
  }

  const deleteCell = async () => {
    if (!editCell) return
    const ok = await confirm({ title: 'Hapus Jadwal', message: 'Kosongkan slot jadwal ini?', danger: true, confirmText: 'Hapus' })
    if (!ok) return
    await removeOne('schedules', scheduleId(classId, editCell.day, editCell.period.period))
    toast.success('Jadwal dihapus.')
    setEditCell(null)
  }

  return (
    <div>
      <PageHeader title="Jadwal Pelajaran" desc="Atur jadwal per kelas. Jadwal dipakai untuk menentukan absensi tiap jam pelajaran." />

      <Card className="mb-4 p-4">
        <Select label="Pilih Kelas" value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Pilih kelas…</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Card>

      {!classId ? (
        <Card>
          <EmptyState icon={<CalendarDays className="h-8 w-8" />} title="Pilih kelas" desc="Pilih kelas untuk melihat & mengatur jadwalnya." />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase text-slate-500">
                <th className="sticky left-0 z-10 border-b border-slate-100 bg-slate-50 px-3 py-3 text-left">Jam</th>
                {days.map((d) => (
                  <th key={d.value} className="border-b border-l border-slate-100 px-3 py-3 text-center">
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.period}>
                  <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-2">
                    <div className="font-semibold text-slate-700">{p.label}</div>
                    <div className="text-xs text-slate-400">
                      {p.start}-{p.end}
                    </div>
                  </td>
                  {days.map((d) => {
                    const cell = map.get(`${d.value}_${p.period}`)
                    return (
                      <td key={d.value} className="border-b border-l border-slate-100 p-1.5 align-top">
                        <button
                          onClick={() => openCell(d.value, p)}
                          className={cn(
                            'flex h-full min-h-[56px] w-full flex-col items-start justify-center rounded-lg px-2.5 py-1.5 text-left transition',
                            cell ? 'bg-brand-50 hover:bg-brand-100' : 'text-slate-300 hover:bg-slate-50',
                          )}
                        >
                          {cell ? (
                            <>
                              <span className="text-sm font-semibold text-brand-800">{cell.subjectName}</span>
                              {cell.teacherName && <span className="text-xs text-brand-600">{cell.teacherName}</span>}
                            </>
                          ) : (
                            <Plus className="mx-auto h-4 w-4" />
                          )}
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
        open={!!editCell}
        onClose={() => setEditCell(null)}
        title={editCell ? `${DAYS.find((d) => d.value === editCell.day)?.label} · ${editCell.period.label}` : ''}
        footer={
          <>
            {editCell && map.get(`${editCell.day}_${editCell.period.period}`) && (
              <Button variant="danger" onClick={deleteCell} icon={<Trash2 className="h-4 w-4" />}>
                Hapus
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="secondary" onClick={() => setEditCell(null)}>
              Batal
            </Button>
            <Button onClick={saveCell} loading={saving}>
              Simpan
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select label="Mata Pelajaran" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Pilih mapel…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select label="Guru Pengampu" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} disabled={!subjectId}>
            <option value="">— Belum ditentukan —</option>
            {teacherOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          {subjectId && teacherOptions.length === 0 && (
            <p className="text-xs text-amber-600">Belum ada guru. Tambahkan di menu Data Guru.</p>
          )}
        </div>
      </Modal>
    </div>
  )
}
