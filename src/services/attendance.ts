import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { AttendanceMethod, AttendanceStatus, Student } from '../lib/types'

/** ID dokumen deterministik: 1 catatan per siswa per slot jadwal per hari. */
export function attendanceDocId(date: string, studentId: string, scheduleId: string): string {
  return `${date}__${studentId}__${scheduleId}`
}

export interface RecordInput {
  student: Pick<Student, 'id' | 'name' | 'nis' | 'classId' | 'className'>
  date: string
  scheduleId: string
  subjectId: string
  subjectName: string
  period: number
  status: AttendanceStatus
  method: AttendanceMethod
  lateMinutes?: number
  deviceId?: string | null
  recordedBy?: string | null
  note?: string | null
  /** waktu scan; default sekarang */
  scannedAt?: Date
}

export interface RecordResult {
  ok: boolean
  duplicate?: boolean
  status?: AttendanceStatus
  message: string
}

/**
 * Catat kehadiran dari sidik jari. Idempotent: jika slot sudah terisi
 * (sudah scan untuk jam pelajaran ini), tidak menimpa.
 */
export async function recordFingerprintAttendance(input: RecordInput): Promise<RecordResult> {
  const id = attendanceDocId(input.date, input.student.id, input.scheduleId)
  const ref = doc(db, 'attendance', id)
  const existing = await getDoc(ref)
  if (existing.exists()) {
    const data = existing.data()
    return {
      ok: false,
      duplicate: true,
      status: data.status as AttendanceStatus,
      message: 'Sudah tercatat untuk jam pelajaran ini.',
    }
  }
  await setDoc(ref, buildDoc(input))
  return { ok: true, status: input.status, message: 'Kehadiran tercatat.' }
}

/** Buat / perbarui catatan secara manual (admin / wali kelas). */
export async function upsertAttendance(input: RecordInput): Promise<void> {
  const id = attendanceDocId(input.date, input.student.id, input.scheduleId)
  await setDoc(doc(db, 'attendance', id), buildDoc(input), { merge: true })
}

function buildDoc(input: RecordInput) {
  const scannedAt = input.scannedAt ? Timestamp.fromDate(input.scannedAt) : serverTimestamp()
  return {
    studentId: input.student.id,
    studentName: input.student.name,
    nis: input.student.nis,
    classId: input.student.classId,
    className: input.student.className,
    date: input.date,
    scheduleId: input.scheduleId,
    subjectId: input.subjectId,
    subjectName: input.subjectName,
    period: input.period,
    status: input.status,
    method: input.method,
    lateMinutes: input.lateMinutes ?? 0,
    deviceId: input.deviceId ?? null,
    recordedBy: input.recordedBy ?? null,
    note: input.note ?? null,
    scannedAt,
  }
}
