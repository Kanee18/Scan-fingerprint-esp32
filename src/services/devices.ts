import { push, ref, remove, serverTimestamp, set, update } from 'firebase/database'
import { rtdb } from '../lib/firebase'
import type { CommandAction, DeviceCommand, DeviceMode } from '../lib/types'

// ============================================================
//  Jembatan perintah & event ke perangkat ESP32 (Realtime DB)
//  Struktur:
//    /devices/{id}        -> status & heartbeat (ditulis ESP32)
//    /commands/{id}       -> perintah aktif (ditulis web, status di-update ESP32)
//    /scans/{id}/{pushId} -> aliran event scan (ditulis ESP32)
//    /enroll_status/{id}  -> progres pendaftaran sidik jari (ditulis ESP32)
// ============================================================

export async function sendCommand(
  deviceId: string,
  cmd: Omit<DeviceCommand, 'status' | 'createdAt'> & Partial<Pick<DeviceCommand, 'status'>>,
): Promise<void> {
  await set(ref(rtdb, `commands/${deviceId}`), {
    ...cmd,
    status: cmd.status ?? 'pending',
    createdAt: Date.now(),
  })
}

export async function clearCommand(deviceId: string): Promise<void> {
  await remove(ref(rtdb, `commands/${deviceId}`))
}

export async function setDeviceMode(deviceId: string, mode: DeviceMode): Promise<void> {
  await sendCommand(deviceId, { action: 'set_mode' as CommandAction, mode })
}

export async function requestEnroll(
  deviceId: string,
  fingerprintId: number,
  studentId: string,
  studentName: string,
  requestedBy?: string,
): Promise<void> {
  // reset status progres lama
  await set(ref(rtdb, `enroll_status/${deviceId}`), {
    step: 'waiting_finger',
    message: 'Menunggu perangkat memulai pendaftaran…',
    progress: 0,
    fingerprintId,
    studentId,
    updatedAt: Date.now(),
  })
  await sendCommand(deviceId, {
    action: 'enroll',
    fingerprintId,
    studentId,
    studentName,
    requestedBy,
  })
}

export async function requestDeleteFingerprint(deviceId: string, fingerprintId: number): Promise<void> {
  await sendCommand(deviceId, { action: 'delete', fingerprintId })
}

export async function requestEmptyDatabase(deviceId: string): Promise<void> {
  await sendCommand(deviceId, { action: 'empty_db' })
}

/**
 * Simulasikan event scan dari perangkat (untuk pengujian tanpa hardware).
 * Pushes ke /scans/{deviceId}.
 */
export async function simulateScan(deviceId: string, fingerprintId: number, confidence = 180): Promise<void> {
  await push(ref(rtdb, `scans/${deviceId}`), {
    fingerprintId,
    confidence,
    matched: true,
    timestamp: Date.now(),
  })
}

/** Daftarkan/registrasi metadata perangkat dari sisi web (mis. nama & lokasi). */
export async function upsertDeviceMeta(
  deviceId: string,
  meta: { name?: string; location?: string },
): Promise<void> {
  await update(ref(rtdb, `devices/${deviceId}`), meta)
}

export { serverTimestamp as rtdbTimestamp }
