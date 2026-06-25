import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { createOne, removeOne, updateOne, serverTimestamp } from './db'
import { MAX_FINGERPRINT_SLOTS } from '../lib/constants'
import type { Student } from '../lib/types'

/**
 * Cari siswa berdasarkan ID template sidik jari pada SEBUAH perangkat.
 * Penting: nomor slot bersifat per-sensor, jadi pencarian harus menyertakan deviceId
 * agar tidak tertukar antar alat (mis. slot #5 di alat kelas A vs kelas B).
 */
export async function getStudentByFingerprint(
  fingerprintId: number,
  deviceId: string,
): Promise<Student | null> {
  const snap = await getDocs(
    query(
      collection(db, 'students'),
      where('fingerprintId', '==', fingerprintId),
      where('fingerprintDeviceId', '==', deviceId),
      limit(1),
    ),
  )
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...(d.data() as object) } as Student
}

/**
 * Alokasikan slot ID sidik jari terkecil yang masih kosong PADA perangkat tertentu.
 * Setiap sensor punya penomoran slot sendiri, jadi alokasi dihitung per-perangkat.
 */
export async function allocateFingerprintId(deviceId: string): Promise<number> {
  const snap = await getDocs(query(collection(db, 'students'), where('fingerprintDeviceId', '==', deviceId)))
  const used = new Set<number>()
  snap.forEach((d) => {
    const fid = (d.data() as Student).fingerprintId
    if (typeof fid === 'number') used.add(fid)
  })
  for (let i = 1; i <= MAX_FINGERPRINT_SLOTS; i++) {
    if (!used.has(i)) return i
  }
  throw new Error('Kapasitas slot sidik jari pada sensor ini sudah penuh.')
}

export async function setFingerprint(
  studentId: string,
  fingerprintId: number,
  deviceId: string,
): Promise<void> {
  await updateOne('students', studentId, {
    fingerprintId,
    fingerprintDeviceId: deviceId,
    fingerprintEnrolledAt: serverTimestamp(),
  })
}

export async function clearFingerprint(studentId: string): Promise<void> {
  await updateOne('students', studentId, {
    fingerprintId: null,
    fingerprintDeviceId: null,
    fingerprintEnrolledAt: null,
  })
}

export interface StudentInput {
  nis: string
  nisn?: string
  name: string
  gender: 'L' | 'P'
  classId: string
  grade: Student['grade']
  major: Student['major']
  className: string
  active?: boolean
  photoUrl?: string | null
}

export async function createStudent(input: StudentInput): Promise<string> {
  return createOne('students', {
    ...input,
    active: input.active ?? true,
    fingerprintId: null,
    fingerprintDeviceId: null,
    fingerprintEnrolledAt: null,
  })
}

export async function updateStudent(id: string, data: Partial<StudentInput>): Promise<void> {
  await updateOne('students', id, data)
}

export async function deleteStudent(id: string): Promise<void> {
  await removeOne('students', id)
}
