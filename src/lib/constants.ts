import type { AttendanceStatus, Grade, Major, PeriodConfig, Role } from './types'

export const GRADES: Grade[] = ['X', 'XI', 'XII']

export interface MajorDef {
  key: Major
  label: string
  classCount: number
}

// Jumlah rombel per jurusan sesuai kebutuhan: MIPA 5, IPS 5, Bahasa 3
export const MAJORS: MajorDef[] = [
  { key: 'MIPA', label: 'MIPA', classCount: 5 },
  { key: 'IPS', label: 'IPS', classCount: 5 },
  { key: 'BAHASA', label: 'Bahasa', classCount: 3 },
]

export const MAJOR_LABEL: Record<Major, string> = {
  MIPA: 'MIPA',
  IPS: 'IPS',
  BAHASA: 'Bahasa',
}

export const STUDENTS_PER_CLASS = 32

export const DAYS: { value: number; short: string; label: string }[] = [
  { value: 1, short: 'Sen', label: 'Senin' },
  { value: 2, short: 'Sel', label: 'Selasa' },
  { value: 3, short: 'Rab', label: 'Rabu' },
  { value: 4, short: 'Kam', label: 'Kamis' },
  { value: 5, short: 'Jum', label: 'Jumat' },
  { value: 6, short: 'Sab', label: 'Sabtu' },
  { value: 7, short: 'Min', label: 'Minggu' },
]

// Jam pelajaran default SMA (sudah memperhitungkan istirahat antar jam)
export const DEFAULT_PERIODS: PeriodConfig[] = [
  { period: 1, label: 'Jam ke-1', start: '07:00', end: '07:45' },
  { period: 2, label: 'Jam ke-2', start: '07:45', end: '08:30' },
  { period: 3, label: 'Jam ke-3', start: '08:30', end: '09:15' },
  { period: 4, label: 'Jam ke-4', start: '09:30', end: '10:15' }, // istirahat 09:15-09:30
  { period: 5, label: 'Jam ke-5', start: '10:15', end: '11:00' },
  { period: 6, label: 'Jam ke-6', start: '11:00', end: '11:45' },
  { period: 7, label: 'Jam ke-7', start: '12:30', end: '13:15' }, // ishoma 11:45-12:30
  { period: 8, label: 'Jam ke-8', start: '13:15', end: '14:00' },
  { period: 9, label: 'Jam ke-9', start: '14:00', end: '14:45' },
  { period: 10, label: 'Jam ke-10', start: '14:45', end: '15:30' },
]

export const DEFAULT_SETTINGS = {
  id: 'school',
  schoolName: 'SMA Negeri 1 Contoh',
  academicYear: '2025/2026',
  lateThresholdMinutes: 10,
  periods: DEFAULT_PERIODS,
  activeDays: [1, 2, 3, 4, 5],
}

export const STATUS_META: Record<
  AttendanceStatus,
  { label: string; color: string; bg: string; text: string; dot: string }
> = {
  hadir: { label: 'Hadir', color: 'green', bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  telat: { label: 'Terlambat', color: 'amber', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  izin: { label: 'Izin', color: 'blue', bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  sakit: { label: 'Sakit', color: 'purple', bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  alfa: { label: 'Alfa', color: 'red', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
}

export const ROLE_META: Record<Role, { label: string; desc: string }> = {
  admin: { label: 'Administrator', desc: 'Akses penuh ke semua fitur & data' },
  operator: { label: 'Operator', desc: 'Mode kiosk absensi & pendaftaran sidik jari' },
  wali_kelas: { label: 'Wali Kelas', desc: 'Memantau & merekap kelas binaannya' },
}

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['hadir', 'telat', 'izin', 'sakit', 'alfa']

// Kapasitas template sensor (R307/AS608 umumnya 127/1000). Sesuaikan bila perlu.
export const MAX_FINGERPRINT_SLOTS = 1000
