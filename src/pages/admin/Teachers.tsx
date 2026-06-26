import { useMemo, useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Contact, Plus, Pencil, Trash2, Search, Mail, BookOpen } from 'lucide-react'
import { useCollection } from '../../hooks/useFirestore'
import { createOne, updateOne, removeOne } from '../../services/db'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Avatar, Badge, Button, Card, EmptyState, Input, Modal, PageHeader } from '../../components/ui'
import { cn } from '../../lib/utils'
import type { Subject, Teacher } from '../../lib/types'

interface FormState {
  name: string
  nip: string
  email: string
  phone: string
  subjectIds: string[]
  active: boolean
}
const EMPTY: FormState = { name: '', nip: '', email: '', phone: '', subjectIds: [], active: true }

export default function Teachers() {
  const toast = useToast()
  const confirm = useConfirm()
  const { data: teachers, loading } = useCollection<Teacher>('teachers', [orderBy('name')])
  const { data: subjects } = useCollection<Subject>('subjects', [orderBy('name')])
  const [search, setSearch] = useState('')

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? id

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return teachers.filter(
      (t) => !s || t.name.toLowerCase().includes(s) || t.email.toLowerCase().includes(s) || (t.nip ?? '').includes(s),
    )
  }, [teachers, search])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  const openEdit = (t: Teacher) => {
    setEditing(t)
    setForm({
      name: t.name,
      nip: t.nip ?? '',
      email: t.email,
      phone: t.phone ?? '',
      subjectIds: t.subjectIds ?? [],
      active: t.active,
    })
    setOpen(true)
  }

  const toggleSubject = (id: string) => {
    setForm((f) => ({
      ...f,
      subjectIds: f.subjectIds.includes(id) ? f.subjectIds.filter((x) => x !== id) : [...f.subjectIds, id],
    }))
  }

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Nama dan email wajib diisi.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error('Format email tidak valid.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        nip: form.nip.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        subjectIds: form.subjectIds,
        active: form.active,
      }
      if (editing) {
        await updateOne('teachers', editing.id, payload)
        toast.success('Data guru diperbarui.')
      } else {
        await createOne('teachers', payload)
        toast.success('Guru ditambahkan.')
      }
      setOpen(false)
    } catch {
      toast.error('Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  const del = async (t: Teacher) => {
    const ok = await confirm({ title: 'Hapus Guru', message: `Hapus data ${t.name}?`, danger: true, confirmText: 'Hapus' })
    if (!ok) return
    await removeOne('teachers', t.id)
    toast.success('Guru dihapus.')
  }

  return (
    <div>
      <PageHeader
        title="Data Guru"
        desc={`${teachers.length} guru terdaftar`}
        actions={
          <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
            Tambah Guru
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input className="input pl-11" placeholder="Cari nama / email / NIP…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      {loading ? (
        <Card className="p-10 text-center text-slate-400">Memuat…</Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Contact className="h-8 w-8" />}
            title="Belum ada data guru"
            desc="Tambahkan guru beserta email & mata pelajaran yang diampu."
          />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((t) => (
            <Card key={t.id} className="group flex items-start gap-3 p-4">
              <Avatar name={t.name} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-slate-800">{t.name}</p>
                  {!t.active && <Badge className="bg-red-100 text-red-600">Nonaktif</Badge>}
                </div>
                {t.nip && <p className="text-xs text-slate-400">NIP {t.nip}</p>}
                <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-slate-500">
                  <Mail className="h-3.5 w-3.5 shrink-0" /> {t.email}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(t.subjectIds ?? []).length === 0 ? (
                    <span className="text-xs text-slate-400">Belum ada mapel diampu</span>
                  ) : (
                    t.subjectIds.map((id) => (
                      <Badge key={id} className="bg-violet-50 text-violet-700">
                        {subjectName(id)}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                <button onClick={() => openEdit(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => del(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit Guru' : 'Tambah Guru'}
        size="lg"
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
          <Input label="Nama Lengkap (dengan gelar)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. Budi Santoso, S.Pd." />
          <div className="grid grid-cols-2 gap-3">
            <Input label="NIP" value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} />
            <Input label="No. HP (opsional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            hint="Dipakai untuk menerima rekap absensi bulanan."
          />
          <div>
            <label className="label flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Mata Pelajaran yang Diampu
            </label>
            {subjects.length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada mata pelajaran. Tambahkan di menu Mata Pelajaran.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {subjects.map((s) => {
                  const on = form.subjectIds.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSubject(s.id)}
                      className={cn(
                        'touch-target rounded-xl px-3 py-2 text-sm font-medium transition',
                        on ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                      )}
                    >
                      {s.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 rounded" />
            Guru aktif
          </label>
        </div>
      </Modal>
    </div>
  )
}
