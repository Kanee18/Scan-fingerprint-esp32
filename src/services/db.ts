import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

/** CRUD generik untuk koleksi Firestore. */
export async function listAll<T>(path: string, ...constraints: QueryConstraint[]): Promise<T[]> {
  const snap = await getDocs(query(collection(db, path), ...constraints))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T)
}

export async function getOne<T>(path: string, id: string): Promise<T | null> {
  const snap = await getDoc(doc(db, path, id))
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as object) } as T) : null
}

export async function createOne(path: string, data: Record<string, unknown>): Promise<string> {
  const ref = await addDoc(collection(db, path), { ...data, createdAt: serverTimestamp() })
  return ref.id
}

/** Buat/timpa dokumen dengan id tertentu. */
export async function setOne(path: string, id: string, data: Record<string, unknown>, merge = true): Promise<void> {
  await setDoc(doc(db, path, id), data, { merge })
}

export async function updateOne(path: string, id: string, data: Record<string, unknown>): Promise<void> {
  await updateDoc(doc(db, path, id), data)
}

export async function removeOne(path: string, id: string): Promise<void> {
  await deleteDoc(doc(db, path, id))
}

/** Hapus banyak dokumen sekaligus (maks 500/batch). */
export async function removeMany(path: string, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db)
    ids.slice(i, i + 450).forEach((id) => batch.delete(doc(db, path, id)))
    await batch.commit()
  }
}

export { serverTimestamp }
