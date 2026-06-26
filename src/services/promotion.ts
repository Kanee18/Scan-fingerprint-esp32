import { collection, doc, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { classId as makeClassId, className as makeClassName } from './seed'
import type { Grade, Major, Student } from '../lib/types'

const NEXT_GRADE: Record<Grade, Grade | null> = { X: 'XI', XI: 'XII', XII: null }

/** Ambil nomor rombel dari classId ("XI_MIPA_3" -> 3) atau dari className. */
function rombelNumber(s: Student): number {
  const parts = (s.classId ?? '').split('_')
  const n = parseInt(parts[2])
  if (!Number.isNaN(n)) return n
  const last = (s.className ?? '').trim().split(/\s+/).pop()
  return parseInt(last ?? '1') || 1
}

function isPromotable(s: Student): boolean {
  return s.active !== false && s.status !== 'lulus'
}

export interface PromotionPreview {
  toXI: number
  toXII: number
  graduate: number
  totalActive: number
}

export async function getPromotionPreview(): Promise<PromotionPreview> {
  const snap = await getDocs(collection(db, 'students'))
  const r: PromotionPreview = { toXI: 0, toXII: 0, graduate: 0, totalActive: 0 }
  snap.forEach((d) => {
    const s = d.data() as Student
    if (!isPromotable(s)) return
    r.totalActive++
    if (s.grade === 'X') r.toXI++
    else if (s.grade === 'XI') r.toXII++
    else if (s.grade === 'XII') r.graduate++
  })
  return r
}

export interface PromotionOptions {
  graduatedYear: string
  /** Kosongkan sidik jari siswa yang lulus (membebaskan slot sensor). */
  clearGraduateFingerprint: boolean
}

/**
 * Jalankan kenaikan kelas (model: alat ikut rombel).
 * - XII  -> lulus (nonaktif/alumni), opsional kosongkan sidik jari.
 * - XI   -> XII   (sidik jari & perangkat tetap).
 * - X    -> XI    (sidik jari & perangkat tetap).
 * Membaca state asli sekali lalu menulis, sehingga tidak ada promosi ganda.
 */
export async function runPromotion(
  opts: PromotionOptions,
  progress?: (current: number, total: number) => void,
): Promise<PromotionPreview> {
  const snap = await getDocs(collection(db, 'students'))
  const docs = snap.docs
  const result: PromotionPreview = { toXI: 0, toXII: 0, graduate: 0, totalActive: 0 }
  let batch = writeBatch(db)
  let ops = 0
  const flush = async () => {
    if (ops > 0) {
      await batch.commit()
      batch = writeBatch(db)
      ops = 0
    }
  }

  for (let i = 0; i < docs.length; i++) {
    const d = docs[i]
    const s = d.data() as Student
    if (isPromotable(s)) {
      result.totalActive++
      const ref = doc(db, 'students', d.id)

      if (s.grade === 'XII') {
        const patch: Record<string, unknown> = {
          active: false,
          status: 'lulus',
          graduatedYear: opts.graduatedYear,
        }
        if (opts.clearGraduateFingerprint) {
          patch.fingerprintId = null
          patch.fingerprintDeviceId = null
          patch.fingerprintEnrolledAt = null
        }
        batch.update(ref, patch)
        result.graduate++
      } else {
        const next = NEXT_GRADE[s.grade]!
        const major = s.major as Major
        const num = rombelNumber(s)
        batch.update(ref, {
          grade: next,
          classId: makeClassId(next, major, num),
          className: makeClassName(next, major, num),
        })
        if (s.grade === 'X') result.toXI++
        else result.toXII++
      }
      ops++
      if (ops >= 450) await flush()
    }
    progress?.(i + 1, docs.length)
  }
  await flush()
  return result
}
