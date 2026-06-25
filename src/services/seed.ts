import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { GRADES, MAJORS, STUDENTS_PER_CLASS, DEFAULT_SETTINGS } from '../lib/constants'
import type { Grade, Major } from '../lib/types'

// ---------- Data dummy nama Indonesia ----------
const FIRST_M = ['Adi', 'Bayu', 'Candra', 'Dimas', 'Eko', 'Fajar', 'Galih', 'Hadi', 'Irfan', 'Joko', 'Krisna', 'Lukman', 'Made', 'Naufal', 'Oka', 'Putra', 'Rizki', 'Surya', 'Teguh', 'Wahyu', 'Yoga', 'Zaki', 'Arif', 'Bagas', 'Cahyo']
const FIRST_F = ['Ayu', 'Bella', 'Citra', 'Dewi', 'Eka', 'Fitri', 'Gita', 'Hana', 'Indah', 'Juwita', 'Kartika', 'Lestari', 'Maya', 'Nadia', 'Oktavia', 'Putri', 'Ratna', 'Sari', 'Tiara', 'Utami', 'Vina', 'Wulan', 'Yuni', 'Zahra', 'Anisa']
const LAST = ['Pratama', 'Wijaya', 'Saputra', 'Nugroho', 'Hidayat', 'Kusuma', 'Santoso', 'Lestari', 'Maulana', 'Permata', 'Cahyani', 'Anggraini', 'Setiawan', 'Firmansyah', 'Ramadhani', 'Halim', 'Gunawan', 'Suryadi', 'Wibowo', 'Hartono']

const SUBJECTS = [
  { code: 'MTK', name: 'Matematika' },
  { code: 'BIN', name: 'Bahasa Indonesia' },
  { code: 'BIG', name: 'Bahasa Inggris' },
  { code: 'FIS', name: 'Fisika' },
  { code: 'KIM', name: 'Kimia' },
  { code: 'BIO', name: 'Biologi' },
  { code: 'EKO', name: 'Ekonomi' },
  { code: 'GEO', name: 'Geografi' },
  { code: 'SEJ', name: 'Sejarah' },
  { code: 'SOS', name: 'Sosiologi' },
  { code: 'PKN', name: 'Pendidikan Pancasila' },
  { code: 'PAI', name: 'Pendidikan Agama' },
  { code: 'PJK', name: 'PJOK' },
  { code: 'SBD', name: 'Seni Budaya' },
  { code: 'INF', name: 'Informatika' },
  { code: 'BJP', name: 'Bahasa Jepang' },
]

// Mapel per jurusan (untuk membuat jadwal yang masuk akal)
const MAJOR_SUBJECTS: Record<Major, string[]> = {
  MIPA: ['MTK', 'FIS', 'KIM', 'BIO', 'BIN', 'BIG', 'PKN', 'PAI', 'PJK', 'INF', 'SEJ', 'SBD'],
  IPS: ['EKO', 'GEO', 'SOS', 'SEJ', 'BIN', 'BIG', 'MTK', 'PKN', 'PAI', 'PJK', 'INF', 'SBD'],
  BAHASA: ['BIN', 'BIG', 'BJP', 'SEJ', 'SOS', 'MTK', 'PKN', 'PAI', 'PJK', 'INF', 'SBD', 'GEO'],
}

const TEACHERS = ['Bu Sri', 'Pak Budi', 'Bu Ani', 'Pak Joko', 'Bu Rina', 'Pak Hendra', 'Bu Maya', 'Pak Agus', 'Bu Dewi', 'Pak Eko', 'Bu Nur', 'Pak Tono']

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function classId(grade: Grade, major: Major, number: number): string {
  return `${grade}_${major}_${number}`
}
export function className(grade: Grade, major: Major, number: number): string {
  const label = MAJORS.find((m) => m.key === major)!.label
  return `${grade} ${label} ${number}`
}

export interface SeedOptions {
  includeStudents: boolean
  includeSchedules: boolean
  studentsPerClass: number
  academicYear: string
}

export type SeedProgress = (info: { phase: string; current: number; total: number }) => void

/** Hapus seluruh data master & absensi (hati-hati!). */
export async function wipeData(progress?: SeedProgress): Promise<void> {
  const cols = ['attendance', 'schedules', 'students', 'classes', 'subjects']
  for (const c of cols) {
    progress?.({ phase: `Menghapus ${c}`, current: 0, total: 1 })
    const snap = await getDocs(collection(db, c))
    const ids = snap.docs.map((d) => d.id)
    for (let i = 0; i < ids.length; i += 450) {
      const batch = writeBatch(db)
      ids.slice(i, i + 450).forEach((id) => batch.delete(doc(db, c, id)))
      await batch.commit()
      progress?.({ phase: `Menghapus ${c}`, current: Math.min(i + 450, ids.length), total: ids.length })
    }
  }
}

/** Buat seluruh data contoh (kelas, mapel, siswa, jadwal, pengaturan). */
export async function seedAll(opts: SeedOptions, progress?: SeedProgress): Promise<{ classes: number; students: number; schedules: number }> {
  let batch = writeBatch(db)
  let ops = 0
  const flush = async () => {
    if (ops > 0) {
      await batch.commit()
      batch = writeBatch(db)
      ops = 0
    }
  }
  const add = async (ref: ReturnType<typeof doc>, data: Record<string, unknown>) => {
    batch.set(ref, data)
    ops++
    if (ops >= 450) await flush()
  }

  // 1) Pengaturan
  await add(doc(db, 'settings', 'school'), { ...DEFAULT_SETTINGS, academicYear: opts.academicYear })

  // 2) Mata pelajaran
  progress?.({ phase: 'Mata pelajaran', current: 0, total: SUBJECTS.length })
  for (const s of SUBJECTS) {
    await add(doc(db, 'subjects', s.code), { code: s.code, name: s.name, createdAt: serverTimestamp() })
  }

  // 3) Kelas
  const classes: { id: string; grade: Grade; major: Major; number: number; name: string }[] = []
  for (const grade of GRADES) {
    for (const major of MAJORS) {
      for (let n = 1; n <= major.classCount; n++) {
        const id = classId(grade, major.key, n)
        const name = className(grade, major.key, n)
        classes.push({ id, grade, major: major.key, number: n, name })
        await add(doc(db, 'classes', id), {
          grade,
          major: major.key,
          number: n,
          name,
          academicYear: opts.academicYear,
          homeroomTeacherId: null,
          createdAt: serverTimestamp(),
        })
      }
    }
  }
  progress?.({ phase: 'Kelas', current: classes.length, total: classes.length })

  // 4) Siswa
  let studentCount = 0
  let nisCounter = 1
  const yearShort = opts.academicYear.slice(0, 4)
  if (opts.includeStudents) {
    for (let ci = 0; ci < classes.length; ci++) {
      const c = classes[ci]
      for (let i = 0; i < opts.studentsPerClass; i++) {
        const gender = Math.random() > 0.5 ? 'L' : 'P'
        const name = `${gender === 'L' ? rand(FIRST_M) : rand(FIRST_F)} ${rand(LAST)}`
        const nis = `${yearShort}${String(nisCounter).padStart(5, '0')}`
        nisCounter++
        await add(doc(collection(db, 'students')), {
          nis,
          nisn: `00${Math.floor(1000000 + Math.random() * 8999999)}`,
          name,
          gender,
          classId: c.id,
          grade: c.grade,
          major: c.major,
          className: c.name,
          fingerprintId: null,
          fingerprintDeviceId: null,
          fingerprintEnrolledAt: null,
          active: true,
          createdAt: serverTimestamp(),
        })
        studentCount++
      }
      progress?.({ phase: 'Siswa', current: ci + 1, total: classes.length })
    }
  }

  // 5) Jadwal (Senin-Jumat, 8 jam pelajaran per hari)
  let scheduleCount = 0
  if (opts.includeSchedules) {
    const PERIODS_PER_DAY = 8
    const days = [1, 2, 3, 4, 5]
    for (let ci = 0; ci < classes.length; ci++) {
      const c = classes[ci]
      const pool = MAJOR_SUBJECTS[c.major]
      let k = 0
      for (const day of days) {
        for (let p = 1; p <= PERIODS_PER_DAY; p++) {
          const code = pool[k % pool.length]
          k++
          const subj = SUBJECTS.find((s) => s.code === code)!
          await add(doc(collection(db, 'schedules')), {
            classId: c.id,
            className: c.name,
            dayOfWeek: day,
            period: p,
            subjectId: code,
            subjectName: subj.name,
            teacherId: null,
            teacherName: rand(TEACHERS),
            createdAt: serverTimestamp(),
          })
          scheduleCount++
        }
      }
      progress?.({ phase: 'Jadwal', current: ci + 1, total: classes.length })
    }
  }

  await flush()
  return { classes: classes.length, students: studentCount, schedules: scheduleCount }
}
