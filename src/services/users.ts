import { initializeApp, deleteApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { app, db } from '../lib/firebase'
import { updateOne } from './db'
import type { Role, UserProfile } from '../lib/types'

export interface CreateUserInput {
  email: string
  password: string
  name: string
  role: Role
  classId?: string | null
}

/**
 * Buat akun pengguna baru TANPA mengeluarkan admin yang sedang login.
 * Trik: gunakan instance Firebase app sekunder khusus untuk createUser,
 * lalu hapus instance tersebut.
 */
export async function createUser(input: CreateUserInput): Promise<string> {
  const secondary = initializeApp(app.options, 'secondary-' + Date.now())
  const secondaryAuth = getAuth(secondary)
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, input.email.trim(), input.password)
    const uid = cred.user.uid
    const profile: Omit<UserProfile, 'uid'> = {
      email: input.email.trim(),
      name: input.name,
      role: input.role,
      classId: input.classId ?? null,
      active: true,
    }
    await setDoc(doc(db, 'users', uid), { ...profile, createdAt: serverTimestamp() })
    await signOut(secondaryAuth)
    return uid
  } finally {
    await deleteApp(secondary)
  }
}

export async function updateUserProfile(uid: string, data: Partial<Omit<UserProfile, 'uid'>>): Promise<void> {
  await updateOne('users', uid, data)
}

/**
 * Catatan: menghapus akun dari Firebase Authentication memerlukan Admin SDK
 * (server). Dari sisi web kita hanya menonaktifkan profil (active=false).
 */
export async function deactivateUser(uid: string): Promise<void> {
  await updateOne('users', uid, { active: false })
}

export async function activateUser(uid: string): Promise<void> {
  await updateOne('users', uid, { active: true })
}
