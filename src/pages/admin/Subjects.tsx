import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { BookOpen, Plus, Pencil, Trash2 } from 'lucide-react'
import { useCollection } from '../../hooks/useFirestore'
import { setOne, updateOne, removeOne } from '../../services/db'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Button, Card, EmptyState, Input, Modal, PageHeader } from '../../components/ui'
import type { Subject } from '../../lib/types'

export default function Subjects() {
  const toast = useToast()
  const confirm = useConfirm()
  const { data: subjects, loading } = useCollection<Subject>('subjects', [orderBy('name')])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const openCreate = () => {
    setEditing(null)
    setCode('')
    setName('')
    setOpen(true)
  }
  const openEdit = (s: Subject) => {
    setEditing(s)
    setCode(s.code)
    setName(s.name)
    setOpen(true)
  }

  const save = async () => {
    if (!code.trim() || !name.trim()) {
      toast.error('Kode dan nama wajib diisi.')
      return
    }
    setSaving(true)
    try {
      const id = code.trim().toUpperCase()
      if (editing) {
        await updateOne('subjects', editing.id, { name: name.trim() })
        toast.success('Mata pelajaran diperbarui.')
      } else {
        if (subjects.some((s) => s.id === id)) {
          toast.error('Kode mata pelajaran sudah dipakai.')
          setSaving(false)
          return
        }
        await setOne('subjects', id, { code: id, name: name.trim() }, false)
        toast.success('Mata pelajaran ditambahkan.')
      }
      setOpen(false)
    } catch {
      toast.error('Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  const del = async (s: Subject) => {
    const ok = await confirm({ title: 'Hapus Mapel', message: `Hapus mata pelajaran ${s.name}?`, danger: true, confirmText: 'Hapus' })
    if (!ok) return
    await removeOne('subjects', s.id)
    toast.success('Mata pelajaran dihapus.')
  }

  return (
    <div>
      <PageHeader
        title="Mata Pelajaran"
        desc={`${subjects.length} mapel`}
        actions={
          <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
            Tambah Mapel
          </Button>
        }
      />

      {loading ? (
        <Card className="p-10 text-center text-slate-400">Memuat…</Card>
      ) : subjects.length === 0 ? (
        <Card>
          <EmptyState icon={<BookOpen className="h-8 w-8" />} title="Belum ada mata pelajaran" />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {subjects.map((s) => (
            <Card key={s.id} className="group flex items-center gap-3 p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 font-bold text-violet-600">
                {s.code.slice(0, 3)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-800">{s.name}</p>
                <p className="text-xs text-slate-400">{s.code}</p>
              </div>
              <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => del(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
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
        title={editing ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}
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
          <Input
            label="Kode"
            placeholder="mis. MTK"
            value={code}
            disabled={!!editing}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            hint={editing ? 'Kode tidak dapat diubah.' : 'Singkatan unik, mis. MTK, BIN, FIS.'}
          />
          <Input label="Nama" placeholder="mis. Matematika" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}
