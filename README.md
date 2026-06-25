# SIAP-SIDIK — Sistem Absensi Sidik Jari SMA (ESP32 + Firebase)

Aplikasi web absensi siswa SMA **per jam pelajaran** menggunakan **sensor sidik jari**
yang dibaca oleh **ESP32**, dengan **Firebase** (Auth + Firestore + Realtime Database)
sebagai backend. Antarmuka dioptimalkan untuk **layar sentuh** (kiosk).

> Dibuat untuk struktur SMA: tingkat **X, XI, XII** × jurusan **MIPA (5)**, **IPS (5)**,
> **Bahasa (3)** = **39 kelas**, masing-masing ±32 siswa.

---

## ✨ Fitur Utama

- 🔐 **Login berbasis peran**: Admin, Operator, Wali Kelas
- 🖐️ **Kiosk Absensi** layar penuh & ramah sentuh — konfirmasi besar (foto, nama, kelas, status, jam)
- 🆕 **Pendaftaran sidik jari** dengan progres real-time dari ESP32
- ⏰ **Absensi per jam pelajaran** dengan deteksi **Hadir / Terlambat** otomatis (toleransi keterlambatan)
- 👥 **Manajemen siswa** lengkap (filter, pencarian, paginasi, **impor/ekspor CSV**)
- 🏫 **Manajemen kelas, mata pelajaran, & jadwal** (editor jadwal mingguan per kelas)
- 📝 **Koreksi absensi manual** (Izin/Sakit/Alfa) + isi Alfa massal
- 📊 **Laporan & rekap** per kelas / sekolah, grafik, ekspor CSV
- 🧑‍🏫 **Dashboard Wali Kelas** untuk kelas binaannya
- 🔌 **Manajemen perangkat ESP32** (status online, mode, kontrol jarak jauh)
- 🌱 **Seed data** untuk uji coba (39 kelas + ribuan siswa + jadwal) sekali klik
- 🧪 **Mode simulasi** untuk menguji seluruh alur **tanpa hardware**

---

## 🏗️ Arsitektur

```
┌─────────────┐    sidik jari     ┌──────────┐   /scans, /devices    ┌──────────────┐
│   Siswa     │ ───────────────▶  │  ESP32 + │ ────────────────────▶ │   Firebase   │
│  (jari)     │                   │  sensor  │ ◀──────────────────── │ Realtime DB  │
└─────────────┘                   └──────────┘   /commands           └──────┬───────┘
                                                                            │ realtime
                                                                            ▼
                                                  ┌──────────────────────────────────┐
                                                  │   Aplikasi Web (React + Vite)     │
                                                  │   - Kiosk mencocokkan scan→siswa  │
                                                  │   - Tentukan jam pelajaran aktif  │
                                                  │   - Tulis absensi ke Firestore    │
                                                  └──────────────────────────────────┘
```

**Pembagian tugas yang disengaja:** ESP32 hanya membaca & mencocokkan sidik jari
(template disimpan di sensor, ID 1..N). Seluruh logika bisnis (pemetaan ID→siswa,
penentuan jam pelajaran, status terlambat) ada di aplikasi web sehingga mudah diubah
tanpa memprogram ulang mikrokontroler.

### Alur Absensi
1. ESP32 (mode `attendance`) memindai jari → dapat `fingerprintId` → push ke `/scans/{deviceId}`.
2. Halaman **Kiosk** mendengarkan `/scans`, mencari siswa via `fingerprintId`.
3. Tentukan **jam pelajaran aktif** (dari `settings.periods` + waktu sekarang) lalu cari **jadwal** kelas siswa hari & jam tersebut.
4. Hitung status **Hadir/Terlambat** (jam mulai + toleransi), simpan ke koleksi `attendance` (idempotent: 1 catatan / siswa / slot jadwal / hari).
5. Tampilkan kartu konfirmasi besar + bunyi.

### Alur Pendaftaran Sidik Jari
1. Operator pilih siswa → web mengalokasikan slot ID kosong → kirim perintah `enroll` ke `/commands/{deviceId}`.
2. ESP32 memandu 2× penempelan jari, melaporkan progres ke `/enroll_status/{deviceId}`.
3. Pada sukses, web menyimpan `fingerprintId` ke dokumen siswa di Firestore.

---

## 🧰 Teknologi

| Lapisan | Teknologi |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router, Recharts, lucide-react |
| Backend | Firebase Authentication, Cloud Firestore, Realtime Database |
| Hardware | ESP32, sensor sidik jari R307/AS608, Arduino (lib Mobizt + Adafruit) |

---

## 🚀 Cara Menjalankan

### 1. Prasyarat
- Node.js 18+ dan npm
- Akun & project Firebase
- (Opsional) Firebase CLI: `npm i -g firebase-tools`

### 2. Buat project Firebase
1. Buat project di [Firebase Console](https://console.firebase.google.com).
2. Aktifkan **Authentication → Sign-in method → Email/Password**.
3. Buat **Firestore Database** (mode produksi).
4. Buat **Realtime Database** (pilih lokasi, mis. `asia-southeast1`).
5. **Project Settings → Your apps → Web (</>)** untuk mendapatkan konfigurasi.

### 3. Konfigurasi environment
```bash
cp .env.example .env
```
Isi `.env` dengan kredensial dari langkah di atas (termasuk `VITE_FIREBASE_DATABASE_URL`).
Set `VITE_DEFAULT_DEVICE_ID` (mis. `esp32-gerbang-1`) — harus cocok dengan firmware.

### 4. Pasang dependensi & jalankan
```bash
npm install
npm run dev
```
Buka `http://localhost:5173` (atau IP LAN yang ditampilkan untuk perangkat sentuh lain).

### 5. Buat admin pertama
Karena aturan keamanan hanya mengizinkan admin menulis koleksi `users`, gunakan salah satu:

**Cara A — lewat aplikasi (saat setup awal):**
1. Buat user di **Firebase Console → Authentication** (email + password).
2. **Sementara** longgarkan aturan Firestore agar bisa menulis (lihat catatan di bawah), login ke web, lalu klik **"Jadikan saya Admin (setup awal)"** pada layar yang muncul.
3. Kembalikan aturan keamanan (`firestore.rules`).

**Cara B — lewat Firebase Console (disarankan):**
Buat dokumen di `users/{uid}` (uid dari Authentication) berisi:
```json
{ "email": "admin@sekolah.sch.id", "name": "Administrator", "role": "admin", "active": true }
```

### 6. Isi data contoh (opsional)
Login sebagai admin → **Pengaturan → Alat Data → Isi Data Contoh (Seed)**.
Akan membuat 39 kelas, mata pelajaran, jadwal, dan siswa (jumlah dapat diatur).

### 7. Deploy aturan keamanan & index (disarankan)
```bash
firebase login
firebase use <project-id>           # atau edit .firebaserc
firebase deploy --only firestore:rules,firestore:indexes,database
```

### 8. Build & hosting (produksi)
```bash
npm run build
firebase deploy --only hosting
```

---

## 🔌 Perangkat ESP32

Lihat panduan lengkap (wiring, library, konfigurasi) di
**[firmware/README.md](firmware/README.md)** dan sketch di
**[firmware/esp32_fingerprint/esp32_fingerprint.ino](firmware/esp32_fingerprint/esp32_fingerprint.ino)**.

Ringkas:
1. Buat akun **device** di Firebase Authentication.
2. Isi konfigurasi di sketch (`WIFI`, `API_KEY`, `DATABASE_URL`, `DEVICE_EMAIL/PASSWORD`, `DEVICE_ID`).
3. Upload. Perangkat muncul di **Admin → Perangkat ESP32**.

> **Belum punya ESP32?** Semuanya tetap bisa dicoba: aktifkan **Mode simulasi** di
> halaman *Daftar Sidik Jari*, dan gunakan tombol **Simulasi Scan** di halaman *Kiosk*
> atau *Perangkat* untuk mengirim event sidik jari palsu.

---

## 🗄️ Model Data

### Firestore
| Koleksi | Isi |
|---|---|
| `users` | `{ email, name, role: admin\|operator\|wali_kelas, classId?, active }` |
| `classes` | `{ grade, major, number, name, academicYear, homeroomTeacherId? }` |
| `students` | `{ nis, nisn, name, gender, classId, grade, major, className, fingerprintId?, active }` |
| `subjects` | `{ code, name }` |
| `schedules` | `{ classId, className, dayOfWeek(1-7), period, subjectId, subjectName, teacherName? }` |
| `attendance` | `{ studentId, classId, date, scheduleId, subjectId, period, status, method, lateMinutes, scannedAt }` |
| `settings/school` | `{ schoolName, academicYear, lateThresholdMinutes, periods[], activeDays[] }` |

ID dokumen `attendance` deterministik: `{date}__{studentId}__{scheduleId}` (mencegah duplikasi).

### Realtime Database
| Path | Penulis | Isi |
|---|---|---|
| `/devices/{id}` | ESP32 | status, mode, lastSeen, ip, firmware, freeHeap, sensorTemplateCount |
| `/commands/{id}` | Web | action (enroll/delete/set_mode/empty_db), status, fingerprintId |
| `/scans/{id}` | ESP32 | fingerprintId, confidence, matched, timestamp |
| `/enroll_status/{id}` | ESP32 | step, message, progress |

---

## 👤 Peran Pengguna

| Peran | Akses |
|---|---|
| **Admin** | Seluruh fitur: data master, jadwal, absensi, laporan, perangkat, pengguna, pengaturan |
| **Operator** | Kiosk absensi, pendaftaran sidik jari, lihat perangkat |
| **Wali Kelas** | Dashboard & rekap kelas binaannya saja |

---

## 📁 Struktur Proyek

```
.
├── firmware/                       # Kode ESP32 (Arduino)
│   ├── esp32_fingerprint/*.ino
│   └── README.md
├── src/
│   ├── components/                 # Layout, UI kit, ProtectedRoute, Clock
│   ├── contexts/                   # Auth, Toast, Confirm
│   ├── hooks/                      # useFirestore, useDevice
│   ├── lib/                        # firebase, types, constants, utils, sound
│   ├── pages/
│   │   ├── admin/                  # Dashboard, Students, Classes, ... , Settings
│   │   ├── wali/                   # WaliDashboard
│   │   ├── Kiosk.tsx  Enroll.tsx  Login.tsx  NotFound.tsx
│   ├── services/                   # db, students, attendance, devices, users, seed, settings
│   ├── App.tsx  main.tsx  index.css
├── firestore.rules  database.rules.json  firestore.indexes.json
├── firebase.json  .firebaserc  .env.example
└── README.md
```

---

## 📜 Skrip npm

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Mode pengembangan (hot reload) |
| `npm run build` | Type-check + build produksi ke `dist/` |
| `npm run preview` | Pratinjau hasil build |
| `npm run lint` | Type-check saja (`tsc --noEmit`) |

---

## 🔒 Catatan Keamanan
- Aturan di `firestore.rules` & `database.rules.json` membatasi akses sesuai peran.
- Penghapusan akun di Firebase Authentication butuh Admin SDK (server); dari web hanya
  menonaktifkan profil (`active: false`).
- Untuk produksi, deploy aturan keamanan dan jangan gunakan mode test.

## 🛣️ Pengembangan Lanjutan (ide)
- Foto siswa via Firebase Storage
- Notifikasi WhatsApp/email ke orang tua saat Alfa
- PWA / mode offline kiosk
- Multi-perangkat per gerbang & load balancing scan
- Cloud Functions untuk auto-generate "Alfa" di akhir jam pelajaran

---

Dibuat sebagai solusi absensi sekolah yang lengkap, modular, dan siap dikembangkan. 🎓
