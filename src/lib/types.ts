import type { Timestamp } from 'firebase/firestore'

// ============================================================
//  Tipe Data Domain - Sistem Absensi Sidik Jari SMA
// ============================================================

export type Role = 'admin' | 'operator' | 'wali_kelas'

export interface UserProfile {
  uid: string
  email: string
  name: string
  role: Role
  /** Hanya untuk wali_kelas: kelas yang menjadi tanggung jawabnya */
  classId?: string | null
  active: boolean
  createdAt?: Timestamp | null
}

export type Grade = 'X' | 'XI' | 'XII'
export type Major = 'MIPA' | 'IPS' | 'BAHASA'

export interface SchoolClass {
  id: string
  grade: Grade
  major: Major
  /** Nomor rombel, mis. 1..5 */
  number: number
  /** Nama tampil, mis. "X MIPA 1" */
  name: string
  homeroomTeacherId?: string | null
  academicYear: string
  createdAt?: Timestamp | null
}

export type Gender = 'L' | 'P'

export interface Student {
  id: string
  nis: string
  nisn?: string
  name: string
  gender: Gender
  classId: string
  /** Denormalisasi untuk mempermudah query & tampilan */
  grade: Grade
  major: Major
  className: string
  photoUrl?: string | null
  /** ID template pada sensor sidik jari (1..N). null = belum enroll */
  fingerprintId?: number | null
  fingerprintEnrolledAt?: Timestamp | null
  /** ID perangkat tempat sidik jari terdaftar */
  fingerprintDeviceId?: string | null
  active: boolean
  createdAt?: Timestamp | null
}

export interface Subject {
  id: string
  code: string
  name: string
  createdAt?: Timestamp | null
}

export interface Teacher {
  id: string
  name: string
  nip?: string
  /** Email untuk pengiriman rekap absensi bulanan */
  email: string
  phone?: string
  /** ID mata pelajaran yang diampu */
  subjectIds: string[]
  active: boolean
  createdAt?: Timestamp | null
}

export interface Schedule {
  id: string
  classId: string
  className: string
  /** 1=Senin ... 7=Minggu (ISO) */
  dayOfWeek: number
  /** Jam pelajaran ke- (mengacu ke settings.periods) */
  period: number
  subjectId: string
  subjectName: string
  teacherId?: string | null
  teacherName?: string | null
  createdAt?: Timestamp | null
}

export type AttendanceStatus = 'hadir' | 'telat' | 'alfa' | 'izin' | 'sakit'
export type AttendanceMethod = 'fingerprint' | 'manual'

export interface AttendanceRecord {
  id: string
  studentId: string
  studentName: string
  nis: string
  classId: string
  className: string
  /** Kunci tanggal "yyyy-MM-dd" */
  date: string
  scheduleId: string
  subjectId: string
  subjectName: string
  period: number
  status: AttendanceStatus
  method: AttendanceMethod
  scannedAt: Timestamp | null
  /** Selisih menit dari jam mulai (positif = telat) */
  lateMinutes?: number
  deviceId?: string | null
  /** uid pencatat manual */
  recordedBy?: string | null
  note?: string | null
}

// ---------- Pengaturan Sekolah ----------
export interface PeriodConfig {
  period: number
  label: string
  start: string // "HH:mm"
  end: string // "HH:mm"
}

export interface SchoolSettings {
  id: string // selalu "school"
  schoolName: string
  academicYear: string
  logoUrl?: string | null
  /** Toleransi keterlambatan dalam menit */
  lateThresholdMinutes: number
  /** Jam pelajaran */
  periods: PeriodConfig[]
  /** Hari aktif sekolah (ISO 1..7) */
  activeDays: number[]
}

// ============================================================
//  Tipe Data Realtime Database (jembatan ESP32)
// ============================================================

export type DeviceMode = 'idle' | 'attendance' | 'enroll'

export interface DeviceState {
  id: string
  name?: string
  status: 'online' | 'offline'
  mode: DeviceMode
  lastSeen?: number // epoch ms
  ip?: string
  firmwareVersion?: string
  freeHeap?: number
  sensorTemplateCount?: number
  location?: string
}

export type CommandAction = 'enroll' | 'delete' | 'set_mode' | 'empty_db'
export type CommandStatus = 'pending' | 'in_progress' | 'success' | 'failed'

export interface DeviceCommand {
  id?: string
  action: CommandAction
  fingerprintId?: number
  studentId?: string
  studentName?: string
  mode?: DeviceMode
  status: CommandStatus
  message?: string
  requestedBy?: string
  createdAt: number
  updatedAt?: number
}

export interface ScanEvent {
  id?: string
  fingerprintId: number
  confidence: number
  matched: boolean
  timestamp: number
}

export interface EnrollStatus {
  step: 'idle' | 'waiting_finger' | 'place_first' | 'remove_finger' | 'place_second' | 'processing' | 'success' | 'failed'
  message: string
  progress: number // 0..100
  fingerprintId?: number
  studentId?: string
  updatedAt: number
}
