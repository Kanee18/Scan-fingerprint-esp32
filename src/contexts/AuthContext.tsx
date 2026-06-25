import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { Role, UserProfile } from '../lib/types'

interface AuthCtx {
  firebaseUser: FirebaseUser | null
  profile: UserProfile | null
  loading: boolean
  /** true bila login berhasil tapi belum punya dokumen profil/role */
  noProfile: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasRole: (...roles: Role[]) => boolean
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [noProfile, setNoProfile] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user)
      setNoProfile(false)
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid))
          if (snap.exists()) {
            setProfile({ uid: user.uid, ...(snap.data() as Omit<UserProfile, 'uid'>) })
          } else {
            setProfile(null)
            setNoProfile(true)
          }
        } catch (e) {
          console.error('Gagal memuat profil pengguna:', e)
          setProfile(null)
          setNoProfile(true)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password)
  }

  const logout = async () => {
    await signOut(auth)
  }

  const hasRole = (...roles: Role[]) => !!profile && roles.includes(profile.role)

  return (
    <Ctx.Provider value={{ firebaseUser, profile, loading, noProfile, login, logout, hasRole }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return ctx
}
