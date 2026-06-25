import { useMemo, useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { GraduationCap, Plus, Pencil, Trash2, Search } from 'lucide-react'
import { useCollection } from '../../hooks/useFirestore'
import { setOne, updateOne, removeOne } from '../../services/db'
import { classId as makeClassId, className as makeClassName } from '../../services/seed'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select } from '../../components/ui'
import { GRADES, MAJORS, DEFAULT_SETTINGS } from '../../lib/constants'
import type { Grade, Major, SchoolClass, UserProfile } from '../../lib/types'

interface FormState {
  grade: Grade
  major: Major
  number: number
  academicYear: string
  homeroomTeacherId: string
}

const EMPTY: FormState = { grade: 'X', major: 'MIPA', number: 1, academicYear: DEFAULT_SETTINGS.academicYear, homeroomTeacherId: '' }

export default function Classes() {
  const toast = useToast()
  const confirm = useConfirm()
  const { data: classes, loading } = useCollection<SchoolClass>('classes', [orderBy('name')])
  const { data: teachers } = useCollection<UserProfile>('users', [])

  const [gradeF, setGradeF] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SchoolClass | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  const wali = teachers.filter((t) => t.role === 'wali_kelas')
  const teacherName = (uid?: string | null) => teachers.find((t) => t.uid === uid)?.name

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return classes.filter((c) => (!gradeF || c.grade === gradeF) && (!s || c.name.toLowerCase().includes(s)))
  }, [classes, gradeF, search])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  const openEdit = (c: SchoolClass) => {
    setEditing(c)
    setForm({
      grade: c.grade,
      major: c.major,
      number: c.number,
      academicYear: c.academicYear,
      homeroomTeacherId: c.homeroomTeacherId ?? '',
    })
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const name = makeClassName(form.grade, form.major, form.number)
      if (editing) {
        await updateOne('classes', editing.id, {
          grade: form.grade,
          major: form.major,
          number: form.number,
          name,
          academicYear: form.academicYear,
          homeroomTeacherId: form.homeroomTeacherId || null,
        })
        toast.success('Kelas diperbarui.')
      } else {
        const id = makeClassId(form.grade, form.major, form.number)
        if (classes.some((c) => c.id === id)) {
          toast.error('Kelas dengan kombinasi tersebut sudah ada.')
          setSaving(false)
          return
        }
        await setOne(
          'classes',
          id,
          {
            grade: form.grade,
            major: form.major,
            number: form.number,
            name,
            academicYear: form.academicYear,
            homeroomTeacherId: form.homeroomTeacherId || null,
          },
          false,
        )
        toast.success('Kelas ditambahkan.')
      }
      setOpen(false)
    } catch (e) {
      console.error(e)
      toast.error('Gagal menyimpan kelas.')
    } finally {
      setSaving(false)
    }
  }

  const del = async (c: SchoolClass) => {
    const ok = await confirm({
      title: 'Hapus Kelas',
      message: `Hapus kelas ${c.name}? Pastikan tidak ada siswa/jadwal yang masih terhubung.`,
      danger: true,
      confirmText: 'Hapus',
    })
    if (!ok) return
    await removeOne('classes', c.id)
    toast.success('Kelas dihapus.')
  }

  return (
    <div>
      <PageHeader
        title="Data Kelas"
        desc={`${classes.length} kelas terdaftar`}
        actions={
          <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
            Tambah Kelas
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Select label="Tingkat" value={gradeF} onChange={(e) => setGradeF(e.target.value)}>
            <option value="">Semua tingkat</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                Kelas {g}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-2">
            <label className="label">Cari</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input className="input pl-11" placeholder="Nama kelas…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-10 text-center text-slate-400">Memuat…</Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon={<GraduationCap className="h-8 w-8" />} title="Belum ada kelas" desc="Tambahkan kelas atau jalankan Seed Data di Pengaturan." />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c) => (
            <Card key={c.id} className="group relative p-4">
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => del(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="mt-3 text-lg font-bold text-slate-800">{c.name}</p>
              <p className="text-xs text-slate-400">TA {c.academicYear}</p>
              <div className="mt-2">
                {c.homeroomTeacherId ? (
                  <Badge className="bg-brand-50 text-brand-700">Wali: {teacherName(c.homeroomTeacherId) ?? '—'}</Badge>
                ) : (
                  <Badge className="bg-slate-100 text-slate-400">Belum ada wali</Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit Kelas' : 'Tambah Kelas'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={save} loading={saving}>
              Simpan
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Select label="Tingkat" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value as Grade })}>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
            <Select label="Jurusan" value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value as Major })}>
              {MAJORS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
            <Input
              label="No. Rombel"
              type="number"
              min={1}
              value={form.number}
              onChange={(e) => setForm({ ...form, number: parseInt(e.target.value) || 1 })}
            />
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Nama kelas: <b>{makeClassName(form.grade, form.major, form.number)}</b>
          </div>
          <Input label="Tahun Ajaran" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} />
          <Select
            label="Wali Kelas (opsional)"
            value={form.homeroomTeacherId}
            onChange={(e) => setForm({ ...form, homeroomTeacherId: e.target.value })}
          >
            <option value="">— Tidak ada —</option>
            {wali.map((w) => (
              <option key={w.uid} value={w.uid}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>
      </Modal>
    </div>
  )
}
