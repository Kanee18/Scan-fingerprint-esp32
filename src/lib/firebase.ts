import { initializeApp, type FirebaseOptions } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getDatabase } from 'firebase/database'

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/**
 * Apakah konfigurasi Firebase sudah diisi dengan nilai asli (bukan placeholder).
 * Dipakai untuk menampilkan layar setup alih-alih membiarkan aplikasi crash
 * (mis. onAuthStateChanged melempar error 'auth/invalid-api-key').
 */
export const firebaseConfigured: boolean = (() => {
  const k = firebaseConfig.apiKey ?? ''
  const p = firebaseConfig.projectId ?? ''
  return (
    !!k &&
    !!p &&
    !!firebaseConfig.appId &&
    !!firebaseConfig.databaseURL &&
    !k.includes('XXXX') &&
    p !== 'nama-project'
  )
})()

if (!firebaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Firebase] Konfigurasi belum diisi. Salin .env.example menjadi .env dan isi kredensial project Firebase Anda, lalu restart `npm run dev`.',
  )
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
// URL fallback agar getDatabase tidak melempar error saat databaseURL kosong.
export const rtdb = getDatabase(
  app,
  firebaseConfig.databaseURL || 'https://placeholder-default-rtdb.firebaseio.com',
)

/** ID perangkat ESP32 default untuk halaman Kiosk & Enroll. */
export const DEFAULT_DEVICE_ID = import.meta.env.VITE_DEFAULT_DEVICE_ID || 'esp32-gerbang-1'
