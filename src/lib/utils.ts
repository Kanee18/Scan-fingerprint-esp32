import { clsx, type ClassValue } from 'clsx'
import { format } from 'date-fns'
import type {
  AttendanceStatus,
  PeriodConfig,
  Schedule,
  SchoolSettings,
} from './types'

/** Gabungkan className dengan rapi (tailwind friendly). */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}

/** Kunci tanggal "yyyy-MM-dd". */
export function dateKey(d: Date = new Date()): string {
  return format(d, 'yyyy-MM-dd')
}

/** ISO day of week: 1=Senin ... 7=Minggu. */
export function isoDay(d: Date = new Date()): number {
  const js = d.getDay() // 0=Minggu
  return js === 0 ? 7 : js
}

export function formatTime(d: Date = new Date()): string {
  return format(d, 'HH:mm:ss')
}

export function formatHM(d: Date | number | null | undefined): string {
  if (d == null) return '-'
  const date = typeof d === 'number' ? new Date(d) : d
  return format(date, 'HH:mm')
}

export function formatDateID(d: Date | string = new Date()): string {
  const date = typeof d === 'string' ? new Date(d + 'T00:00:00') : d
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/** "07:30" -> 450 (menit sejak tengah malam). */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function minutesNow(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Tentukan jam pelajaran (period) yang sedang aktif berdasarkan waktu sekarang.
 * Mengembalikan PeriodConfig atau null bila di luar jam pelajaran.
 * `graceBefore` mengizinkan scan beberapa menit sebelum jam mulai.
 */
export function getActivePeriod(
  settings: Pick<SchoolSettings, 'periods'>,
  now: Date = new Date(),
  graceBefore = 5,
): PeriodConfig | null {
  const m = minutesNow(now)
  for (const p of settings.periods) {
    const start = timeToMinutes(p.start) - graceBefore
    const end = timeToMinutes(p.end)
    if (m >= start && m <= end) return p
  }
  return null
}

/** Cari jadwal aktif untuk sebuah kelas pada hari & jam saat ini. */
export function findActiveSchedule(
  schedules: Schedule[],
  classId: string,
  settings: Pick<SchoolSettings, 'periods'>,
  now: Date = new Date(),
): { schedule: Schedule; period: PeriodConfig } | null {
  const period = getActivePeriod(settings, now)
  if (!period) return null
  const schedule = schedules.find(
    (s) => s.classId === classId && s.dayOfWeek === isoDay(now) && s.period === period.period,
  )
  if (!schedule) return null
  return { schedule, period }
}

/**
 * Tentukan status kehadiran (hadir/telat) berdasarkan waktu scan vs jam mulai.
 */
export function computeStatus(
  periodStart: string,
  scanTime: Date,
  lateThresholdMinutes: number,
): { status: AttendanceStatus; lateMinutes: number } {
  const startMin = timeToMinutes(periodStart)
  const scanMin = minutesNow(scanTime)
  const diff = scanMin - startMin
  if (diff > lateThresholdMinutes) {
    return { status: 'telat', lateMinutes: diff }
  }
  return { status: 'hadir', lateMinutes: Math.max(0, diff) }
}

/** Format angka persen, contoh 0.8765 -> "87,7%". */
export function formatPercent(n: number, digits = 1): string {
  if (!isFinite(n)) return '0%'
  return (n * 100).toFixed(digits).replace('.', ',') + '%'
}

/** Inisial nama untuk avatar. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Warna avatar deterministik berdasar string. */
export function avatarColor(seed: string): string {
  const colors = [
    'bg-rose-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-sky-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-fuchsia-500',
  ]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return colors[h % colors.length]
}

/** Konversi array of objek ke CSV string. */
export function toCSV(rows: Record<string, unknown>[], headers?: string[]): string {
  if (rows.length === 0) return ''
  const cols = headers ?? Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const head = cols.join(';')
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(';')).join('\n')
  return head + '\n' + body
}

export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
