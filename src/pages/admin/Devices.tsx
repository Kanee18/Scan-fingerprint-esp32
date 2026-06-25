import { useState } from 'react'
import { Cpu, Wifi, WifiOff, Pencil, ScanLine, Power, Database, Activity } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { id as localeID } from 'date-fns/locale'
import { DEFAULT_DEVICE_ID } from '../../lib/firebase'
import { useDevicesList } from '../../hooks/useDevice'
import { requestEmptyDatabase, setDeviceMode, simulateScan, upsertDeviceMeta } from '../../services/devices'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select } from '../../components/ui'
import { cn } from '../../lib/utils'
import type { DeviceMode, DeviceState } from '../../lib/types'

const MODE_LABEL: Record<DeviceMode, string> = { idle: 'Siaga', attendance: 'Absensi', enroll: 'Pendaftaran' }

export default function Devices() {
  const { devices, loading } = useDevicesList()
  const toast = useToast()
  const confirm = useConfirm()
  const [edit, setEdit] = useState<DeviceState | null>(null)
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [sim, setSim] = useState<{ device: DeviceState | null; id: string }>({ device: null, id: '' })

  const openEdit = (d: DeviceState) => {
    setEdit(d)
    setName(d.name ?? '')
    setLocation(d.location ?? '')
  }
  const saveMeta = async () => {
    if (!edit) return
    await upsertDeviceMeta(edit.id, { name, location })
    toast.success('Perangkat diperbarui.')
    setEdit(null)
  }

  const changeMode = async (d: DeviceState, mode: DeviceMode) => {
    await setDeviceMode(d.id, mode)
    toast.success(`Mode diubah ke ${MODE_LABEL[mode]}.`)
  }

  const emptyDb = async (d: DeviceState) => {
    const ok = await confirm({
      title: 'Hapus Semua Template',
      message: `Hapus SEMUA template sidik jari pada sensor perangkat ${d.name || d.id}? Tindakan ini tidak dapat dibatalkan dan data pada sensor akan hilang.`,
      danger: true,
      confirmText: 'Hapus Semua',
    })
    if (!ok) return
    await requestEmptyDatabase(d.id)
    toast.warning('Perintah hapus database dikirim ke perangkat.')
  }

  const doSim = async () => {
    if (!sim.device) return
    const fid = parseInt(sim.id, 10)
    if (!fid) return
    await simulateScan(sim.device.id, fid)
    toast.success(`Simulasi scan #${fid} dikirim.`)
    setSim({ device: null, id: '' })
  }

  return (
    <div>
      <PageHeader title="Perangkat ESP32" desc={`Perangkat default: ${DEFAULT_DEVICE_ID}`} />

      {loading ? (
        <Card className="p-10 text-center text-slate-400">Memuat…</Card>
      ) : devices.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Cpu className="h-8 w-8" />}
            title="Belum ada perangkat"
            desc="Nyalakan ESP32 dengan firmware terpasang. Perangkat akan otomatis mendaftarkan dirinya di /devices."
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {devices.map((d) => (
            <Card key={d.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-xl',
                      d.status === 'online' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500',
                    )}
                  >
                    {d.status === 'online' ? <Wifi className="h-6 w-6" /> : <WifiOff className="h-6 w-6" />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{d.name || d.id}</p>
                    <p className="text-xs text-slate-400">{d.id}</p>
                  </div>
                </div>
                <button onClick={() => openEdit(d)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                  <Pencil className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Info label="Status" value={<Badge className={d.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}>{d.status === 'online' ? 'Online' : 'Offline'}</Badge>} />
                <Info label="Mode" value={<Badge className="bg-brand-50 text-brand-700">{MODE_LABEL[d.mode] ?? d.mode ?? '—'}</Badge>} />
                <Info label="Lokasi" value={d.location || '—'} />
                <Info label="Template" value={d.sensorTemplateCount ?? '—'} />
                <Info label="IP" value={d.ip || '—'} />
                <Info label="Firmware" value={d.firmwareVersion || '—'} />
                <Info label="Free Heap" value={d.freeHeap ? `${Math.round(d.freeHeap / 1024)} KB` : '—'} />
                <Info
                  label="Terakhir aktif"
                  value={d.lastSeen ? formatDistanceToNow(d.lastSeen, { addSuffix: true, locale: localeID }) : '—'}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <Select
                  value={d.mode ?? 'idle'}
                  onChange={(e) => changeMode(d, e.target.value as DeviceMode)}
                  className="w-auto py-2"
                >
                  <option value="idle">Mode: Siaga</option>
                  <option value="attendance">Mode: Absensi</option>
                  <option value="enroll">Mode: Pendaftaran</option>
                </Select>
                <Button variant="secondary" size="sm" onClick={() => setSim({ device: d, id: '' })} icon={<ScanLine className="h-4 w-4" />}>
                  Simulasi Scan
                </Button>
                <Button variant="ghost" size="sm" onClick={() => emptyDb(d)} icon={<Database className="h-4 w-4 text-red-500" />}>
                  Kosongkan Sensor
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit metadata */}
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title="Edit Perangkat"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEdit(null)}>
              Batal
            </Button>
            <Button onClick={saveMeta}>Simpan</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Nama Perangkat" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Gerbang Utama" />
          <Input label="Lokasi" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="mis. Lobi Lantai 1" />
        </div>
      </Modal>

      {/* Simulasi scan */}
      <Modal
        open={!!sim.device}
        onClose={() => setSim({ device: null, id: '' })}
        title="Simulasi Scan"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSim({ device: null, id: '' })}>
              Batal
            </Button>
            <Button onClick={doSim} icon={<Activity className="h-4 w-4" />}>
              Kirim
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-500">
          Kirim event scan palsu ke <b>{sim.device?.id}</b> untuk menguji alur absensi tanpa perangkat fisik.
        </p>
        <Input
          label="ID Sidik Jari"
          type="number"
          value={sim.id}
          onChange={(e) => setSim((s) => ({ ...s, id: e.target.value }))}
          placeholder="mis. 1"
        />
      </Modal>
    </div>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <div className="font-medium text-slate-700">{value}</div>
    </div>
  )
}
