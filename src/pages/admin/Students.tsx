import { useMemo, useRef, useState } from 'react'
import { orderBy, where, writeBatch, doc, collection, serverTimestamp } from 'firebase/firestore'
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  Upload,
  Download,
  Fingerprint,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { db } from '../../lib/firebase'
import { useCollection } from '../../hooks/useFirestore'
import { createStudent, updateStudent, deleteStudent } from '../../services/students'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Avatar, Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select } from '../../components/ui'
import { GRADES, MAJORS } from '../../lib/constants'
import { downloadCSV, toCSV } from '../../lib/utils'
import type { Gender, Grade, Major, SchoolClass, Student } from '../../lib/types'

const PAGE_SIZE = 25

interface FormState {
  nis: string
  nisn: string
  name: string
  gender: Gender
  classId: string
  active: boolean
}
const EMPTY: FormState = { nis: '', nisn: '', name: '', gender: 'L', classId: '', active: true }

export default function Students() {
  const toast = useToast()
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: classes } = useCollection<SchoolClass>('classes', [orderBy('name')])
  const [gradeF, setGradeF] = useState('')
  const [majorF, setMajorF] = useState('')
  const [classF, setClassF] = useState('')
  const [fpF, setFpF] = useState('') // '', 'yes', 'no'
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  // Jika kelas dipilih, query lebih ringan; jika tidak, ambil semua.
  // Pengurutan dilakukan di client agar tidak butuh composite index.
  const { data: students, loading } = useCollection<Student>(
    'students',
    classF ? [where('classId', '==', classF)] : [],
    [classF],
  )

  const filteredClasses = useMemo(
    () => classes.filter((c) => (!gradeF || c.grade === gradeF) && (!majorF || c.major === majorF)),
    [classes, gradeF, majorF],
  )

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return students
      .filter(
        (st) =>
          (!gradeF || st.grade === gradeF) &&
          (!majorF || st.major === majorF) &&
          (!fpF || (fpF === 'yes' ? !!st.fingerprintId : !st.fingerprintId)) &&
          (!s || st.name.toLowerCase().includes(s) || st.nis.includes(s)),
      )
      .sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name))
  }, [students, gradeF, majorF, fpF, search])

  const pages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  // ---- Form ----
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY, classId: classF || '' })
    setOpen(true)
  }
  const openEdit = (s: Student) => {
    setEditing(s)
    setForm({ nis: s.nis, nisn: s.nisn ?? '', name: s.name, gender: s.gender, classId: s.classId, active: s.active })
    setOpen(true)
  }

  const save = async () => {
    if (!form.nis || !form.name || !form.classId) {
      toast.error('NIS, nama, dan kelas wajib diisi.')
      return
    }
    const cls = classes.find((c) => c.id === form.classId)
    if (!cls) {
      toast.error('Kelas tidak valid.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        nis: form.nis,
        nisn: form.nisn,
        name: form.name,
        gender: form.gender,
        classId: cls.id,
        grade: cls.grade,
        major: cls.major,
        className: cls.name,
        active: form.active,
      }
      if (editing) {
        await updateStudent(editing.id, payload)
        toast.success('Data siswa diperbarui.')
      } else {
        await createStudent(payload)
        toast.success('Siswa ditambahkan.')
      }
      setOpen(false)
    } catch {
      toast.error('Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  const del = async (s: Student) => {
    const ok = await confirm({ title: 'Hapus Siswa', message: `Hapus data ${s.name} (${s.nis})?`, danger: true, confirmText: 'Hapus' })
    if (!ok) return
    await deleteStudent(s.id)
    toast.success('Siswa dihapus.')
  }

  const exportCSV = () => {
    const rows = filtered.map((s) => ({
      nis: s.nis,
      nisn: s.nisn ?? '',
      nama: s.name,
      jk: s.gender,
      kelas: s.className,
      sidik_jari: s.fingerprintId ?? '',
      status: s.active ? 'aktif' : 'nonaktif',
    }))
    downloadCSV(`siswa-${Date.now()}.csv`, toCSV(rows))
    toast.success(`${rows.length} baris diekspor.`)
  }

  const downloadTemplate = () => {
    const tpl = toCSV([{ nis: '202500001', nisn: '0012345678', nama: 'Budi Santoso', jk: 'L', kelas: 'X MIPA 1' }])
    downloadCSV('template-import-siswa.csv', tpl)
  }

  const importCSV = async (file: File) => {
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) {
      toast.error('File kosong / tidak valid.')
      return
    }
    const delim = lines[0].includes(';') ? ';' : ','
    const headers = lines[0].split(delim).map((h) => h.trim().toLowerCase())
    const idx = (k: string) => headers.indexOf(k)
    const classByName = new Map(classes.map((c) => [c.name.toLowerCase(), c]))
    let ok = 0
    let fail = 0
    let batch = writeBatch(db)
    let ops = 0
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delim)
      const kelasName = (cols[idx('kelas')] || '').trim().toLowerCase()
      const cls = classByName.get(kelasName)
      const nama = (cols[idx('nama')] || '').trim()
      const nis = (cols[idx('nis')] || '').trim()
      if (!cls || !nama || !nis) {
        fail++
        continue
      }
      batch.set(doc(collection(db, 'students')), {
        nis,
        nisn: (cols[idx('nisn')] || '').trim(),
        name: nama,
        gender: ((cols[idx('jk')] || 'L').trim().toUpperCase() === 'P' ? 'P' : 'L') as Gender,
        classId: cls.id,
        grade: cls.grade,
        major: cls.major,
        className: cls.name,
        fingerprintId: null,
        fingerprintDeviceId: null,
        fingerprintEnrolledAt: null,
        active: true,
        createdAt: serverTimestamp(),
      })
      ops++
      ok++
      if (ops >= 450) {
        await batch.commit()
        batch = writeBatch(db)
        ops = 0
      }
    }
    if (ops > 0) await batch.commit()
    toast.success(`Impor selesai: ${ok} berhasil, ${fail} dilewati.`)
  }

  return (
    <div>
      <PageHeader
        title="Data Siswa"
        desc={`${filtered.length.toLocaleString('id-ID')} siswa${classF ? ' di kelas terpilih' : ''}`}
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) importCSV(f)
                e.target.value = ''
              }}
            />
            <Button variant="secondary" onClick={downloadTemplate} icon={<Download className="h-4 w-4" />}>
              Template
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} icon={<Upload className="h-4 w-4" />}>
              Impor
            </Button>
            <Button variant="secondary" onClick={exportCSV} icon={<Download className="h-4 w-4" />}>
              Ekspor
            </Button>
            <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
              Tambah
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select label="Tingkat" value={gradeF} onChange={(e) => { setGradeF(e.target.value); setClassF(''); setPage(0) }}>
            <option value="">Semua</option>
            {GRADES.map((g) => (<option key={g} value={g}>Kelas {g}</option>))}
          </Select>
          <Select label="Jurusan" value={majorF} onChange={(e) => { setMajorF(e.target.value); setClassF(''); setPage(0) }}>
            <option value="">Semua</option>
            {MAJORS.map((m) => (<option key={m.key} value={m.key}>{m.label}</option>))}
          </Select>
          <Select label="Kelas" value={classF} onChange={(e) => { setClassF(e.target.value); setPage(0) }}>
            <option value="">Semua kelas</option>
            {filteredClasses.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </Select>
          <Select label="Sidik Jari" value={fpF} onChange={(e) => { setFpF(e.target.value); setPage(0) }}>
            <option value="">Semua</option>
            <option value="yes">Sudah terdaftar</option>
            <option value="no">Belum terdaftar</option>
          </Select>
          <div>
            <label className="label">Cari</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input className="input pl-11" placeholder="Nama / NIS" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400">Memuat…</div>
        ) : pageItems.length === 0 ? (
          <EmptyState icon={<Users className="h-8 w-8" />} title="Tidak ada siswa" desc="Ubah filter atau tambahkan siswa baru." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Siswa</th>
                  <th className="px-4 py-3">NIS</th>
                  <th className="px-4 py-3">Kelas</th>
                  <th className="px-4 py-3">JK</th>
                  <th className="px-4 py-3">Sidik Jari</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pageItems.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.name} photoUrl={s.photoUrl} size="sm" />
                        <span className="font-medium text-slate-700">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{s.nis}</td>
                    <td className="px-4 py-2.5 text-slate-500">{s.className}</td>
                    <td className="px-4 py-2.5 text-slate-500">{s.gender}</td>
                    <td className="px-4 py-2.5">
                      {s.fingerprintId ? (
                        <Badge className="bg-green-100 text-green-700">
                          <Fingerprint className="h-3.5 w-3.5" /> #{s.fingerprintId}
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-400">Belum</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.active ? (
                        <Badge className="bg-green-100 text-green-700">Aktif</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-600">Nonaktif</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => del(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
            <span className="text-slate-500">
              Halaman {page + 1} dari {pages}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft className="h-4 w-4" />}>
                Sebelumnya
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                Berikutnya <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit Siswa' : 'Tambah Siswa'}
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
          <Input label="Nama Lengkap" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="NIS" value={form.nis} onChange={(e) => setForm({ ...form, nis: e.target.value })} />
            <Input label="NISN" value={form.nisn} onChange={(e) => setForm({ ...form, nisn: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Jenis Kelamin" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </Select>
            <Select label="Kelas" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
              <option value="">Pilih kelas…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 rounded" />
            Siswa aktif
          </label>
        </div>
      </Modal>
    </div>
  )
}
