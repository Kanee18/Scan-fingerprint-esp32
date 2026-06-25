import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  query,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

/**
 * Berlangganan koleksi Firestore secara realtime.
 * `deps` mengontrol kapan query dibangun ulang (mis. saat filter berubah).
 */
export function useCollection<T>(
  path: string | null,
  constraints: QueryConstraint[] = [],
  deps: unknown[] = [],
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!path) {
      setData([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(collection(db, path), ...constraints)
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T))
        setLoading(false)
      },
      (err) => {
        console.error(`[useCollection:${path}]`, err)
        setError(err)
        setLoading(false)
      },
    )
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps])

  return { data, loading, error }
}

/** Berlangganan satu dokumen Firestore. */
export function useDoc<T>(path: string | null, id: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!path || !id) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const unsub = onSnapshot(
      doc(db, path, id),
      (snap) => {
        setData(snap.exists() ? ({ id: snap.id, ...(snap.data() as object) } as T) : null)
        setLoading(false)
      },
      (err) => {
        console.error(`[useDoc:${path}/${id}]`, err)
        setLoading(false)
      },
    )
    return unsub
  }, [path, id])

  return { data, loading }
}
