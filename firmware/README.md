# Firmware ESP32 — Pembaca Sidik Jari

Firmware ini mengubah ESP32 + sensor sidik jari (R307/AS608/FPM10A) menjadi
terminal absensi yang terhubung ke Firebase Realtime Database.

## 1. Perangkat keras

| Komponen | Keterangan |
|---|---|
| ESP32 DevKit v1 | atau board ESP32 sejenis |
| Sensor sidik jari | R307 / AS608 / FPM10A (UART, optik) |
| Buzzer aktif | opsional, feedback suara |
| LED hijau & merah | opsional, indikator status |

### Wiring (UART2)

```
Sensor   ESP32
------   -----
VCC  ->  3V3        (modul 3.3V. Jika modul 5V, suplai 5V & gunakan level shifter pada RX)
GND  ->  GND
TX   ->  GPIO16 (RX2)
RX   ->  GPIO17 (TX2)

Buzzer + -> GPIO27        LED hijau -> GPIO26        LED merah -> GPIO25
Buzzer - -> GND           (seri resistor 220Ω)       (seri resistor 220Ω)
```

> Banyak modul R307 berlabel 5V tetapi logic UART-nya 3.3V sehingga aman langsung
> ke ESP32. Periksa datasheet modul Anda.

## 2. Library Arduino

Pasang lewat **Arduino IDE → Tools → Manage Libraries**:

1. **Firebase Arduino Client Library for ESP8266 and ESP32** — oleh *Mobizt* (v4.4+)
2. **Adafruit Fingerprint Sensor Library** — oleh *Adafruit* (v2.1+)

Board: pasang **esp32 by Espressif Systems** lewat Boards Manager, lalu pilih
*ESP32 Dev Module*.

## 3. Akun perangkat di Firebase

ESP32 menulis ke Realtime Database, dan aturan keamanan mensyaratkan
`auth != null`. Buat satu akun khusus perangkat:

1. Firebase Console → **Authentication → Users → Add user**
2. Email: `device@sekolah.local`, password bebas (mis. `rahasiadevice123`)
3. Isi `DEVICE_EMAIL` & `DEVICE_PASSWORD` di firmware.

## 4. Konfigurasi firmware

Buka [esp32_fingerprint/esp32_fingerprint.ino](esp32_fingerprint/esp32_fingerprint.ino)
dan isi bagian **KONFIGURASI**:

```cpp
#define WIFI_SSID       "NAMA_WIFI"
#define WIFI_PASSWORD   "PASSWORD_WIFI"
#define API_KEY         "...."                 // = VITE_FIREBASE_API_KEY
#define DATABASE_URL    "https://....firebasedatabase.app"  // = VITE_FIREBASE_DATABASE_URL
#define DEVICE_EMAIL    "device@sekolah.local"
#define DEVICE_PASSWORD "rahasiadevice123"
#define DEVICE_ID       "esp32-gerbang-1"      // = VITE_DEFAULT_DEVICE_ID
```

> **Penting:** `DEVICE_ID` harus sama persis dengan `VITE_DEFAULT_DEVICE_ID`
> pada file `.env` aplikasi web agar halaman Kiosk/Enroll terhubung ke perangkat ini.

## 5. Upload & uji

1. Hubungkan ESP32 via USB, pilih port yang benar.
2. Upload sketch. Buka **Serial Monitor @115200**.
3. Pastikan log menampilkan: WiFi tersambung → Firebase diinisialisasi → Sensor terdeteksi.
4. Di web, buka **Admin → Perangkat ESP32**; perangkat akan muncul *Online*.

## 6. Alur kerja

| Arah | Path RTDB | Penulis | Pembaca |
|---|---|---|---|
| Status & heartbeat | `/devices/{id}` | ESP32 | Web |
| Perintah (enroll/delete/set_mode/empty_db) | `/commands/{id}` | Web | ESP32 |
| Event scan absensi | `/scans/{id}` | ESP32 | Web (Kiosk) |
| Progres pendaftaran | `/enroll_status/{id}` | ESP32 | Web (Enroll) |

- **Absensi:** saat `mode = attendance`, setiap sidik jari yang cocok dikirim ke
  `/scans/{id}`. Web mencocokkan `fingerprintId` → siswa → jadwal jam pelajaran aktif,
  lalu mencatat kehadiran ke Firestore.
- **Pendaftaran:** web menulis perintah `enroll` dengan `fingerprintId`. ESP32
  memandu dua kali penempelan jari dan melaporkan progres real-time.

## 7. Troubleshooting

| Masalah | Solusi |
|---|---|
| `Sensor TIDAK terdeteksi` | Tukar kabel TX/RX, cek catu daya, baud sensor (umumnya 57600). |
| Perangkat tidak muncul Online | Cek `API_KEY`, `DATABASE_URL`, dan akun device di Authentication. |
| Token error di Serial | Pastikan Email/Password device benar & provider Email/Password aktif. |
| Scan tidak tercatat | Pastikan siswa sudah di-enroll, ada jadwal pada jam tsb, dan `DEVICE_ID` cocok. |
