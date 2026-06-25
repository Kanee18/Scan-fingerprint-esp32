import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { UserCog, Plus, Pencil, UserX, UserCheck, ShieldCheck } from 'lucide-react'
import { FirebaseError } from 'firebase/app'
import { useCollection } from '../../hooks/useFirestore'
import { createUser, updateUserProfile, deactivateUser, activateUser } from '../../services/users'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Avatar, Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select } from '../../components/ui'
import { ROLE_META } from '../../lib/constants'
import type { Role, SchoolClass, UserProfile } from '../../lib/types'

interface FormState {
  name: string
  email: string
  password: string
  role: Role
  classId: string
}
const EMPTY: FormState = { name: '', email: '', password: '', role: 'operator', classId: '' }

export default function Users() {
  const { profile } = useAuth()
  const toast = useToast()
  const { data: users, loading } = useCollection<UserProfile>('users', [orderBy('name')])
  const { data: classes } = useCollection<SchoolClass>('classes', [orderBy('name')])

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<UserProfile | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  const openEdit = (u: UserProfile) => {
    setEditing(u)
    setForm({ name: u.name, email: u.email, password: '', role: u.role, classId: u.classId ?? '' })
    setOpen(true)
  }

  const save = async () => {
    if (!form.name || !form.email || (!editing && form.password.length < 6)) {
      toast.error('Lengkapi data. Kata sandi minimal 6 karakter.')
      return
    }
    if (form.role === 'wali_kelas' && !form.classId) {
      toast.error('Wali kelas harus dikaitkan dengan sebuah kelas.')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateUserProfile(editing.uid, {
          name: form.name,
          role: form.role,
          classId: form.role === 'wali_kelas' ? form.classId : null,
        })
        toast.success('Pengguna diperbarui.')
      } else {
        await createUser({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          classId: form.role === 'wali_kelas' ? form.classId : null,
        })
        toast.success('Pengguna dibuat.')
      }
      setOpen(false)
    } catch (e) {
      const code = e instanceof FirebaseError ? e.code : ''
      toast.error(
        code === 'auth/email-already-in-use'
          ? 'Email sudah terdaftar.'
          : code === 'auth/weak-password'
            ? 'Kata sandi terlalu lemah.'
            : 'Gagal menyimpan pengguna.',
      )
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (u: UserProfile) => {
    if (u.uid === profile?.uid) {
      toast.warning('Tidak dapat menonaktifkan akun sendiri.')
      return
    }
    if (u.active) {
      await deactivateUser(u.uid)
      toast.success('Pengguna dinonaktifkan.')
    } else {
      await activateUser(u.uid)
      toast.success('Pengguna diaktifkan.')
    }
  }

  const roleBadge = (r: Role) => {
    const cls = r === 'admin' ? 'bg-brand-100 text-brand-700' : r === 'operator' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'
    return <Badge className={cls}>{ROLE_META[r].label}</Badge>
  }

  return (
    <div>
      <PageHeader
        title="Pengguna"
        desc={`${users.length} akun pengguna`}
        actions={
          <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
            Tambah Pengguna
          </Button>
        }
      />

      {loading ? (
        <Card className="p-10 text-center text-slate-400">Memuat…</Card>
      ) : users.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserCog className="h-8 w-8" />}
            title="Belum ada pengguna"
            desc="Buat akun admin pertama melalui Firebase Console (lihat README), lalu kelola pengguna lain dari sini."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Peran</th>
                  <th className="px-4 py-3">Kelas Binaan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size="sm" />
                        <span className="font-medium text-slate-700">
                          {u.name}
                          {u.uid === profile?.uid && <span className="ml-1 text-xs text-slate-400">(Anda)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{u.email}</td>
                    <td className="px-4 py-2.5">{roleBadge(u.role)}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {u.role === 'wali_kelas' ? classes.find((c) => c.id === u.classId)?.name ?? '—' : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {u.active ? (
                        <Badge className="bg-green-100 text-green-700">Aktif</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-600">Nonaktif</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(u)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                          title={u.active ? 'Nonaktifkan' : 'Aktifkan'}
                        >
                          {u.active ? <UserX className="h-4 w-4 text-red-500" /> : <UserCheck className="h-4 w-4 text-green-600" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit Pengguna' : 'Tambah Pengguna'}
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
          <Input
            label="Email"
            type="email"
            value={form.email}
            disabled={!!editing}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            hint={editing ? 'Email tidak dapat diubah.' : undefined}
          />
          {!editing && (
            <Input
              label="Kata Sandi"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              hint="Minimal 6 karakter."
            />
          )}
          <Select label="Peran" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            <option value="admin">Administrator</option>
            <option value="operator">Operator</option>
            <option value="wali_kelas">Wali Kelas</option>
          </Select>
          {form.role === 'wali_kelas' && (
            <Select label="Kelas Binaan" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
              <option value="">Pilih kelas…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            {ROLE_META[form.role].desc}
          </div>
        </div>
      </Modal>
    </div>
  )
}
