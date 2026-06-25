/* ============================================================================
 *  SIAP-SIDIK : Firmware ESP32 - Absensi Sidik Jari SMA
 *  ----------------------------------------------------------------------------
 *  Perangkat ini menjadi "pembaca sidik jari" yang terhubung ke Firebase
 *  Realtime Database. Logika bisnis (siapa siswanya, jam pelajaran apa, dsb)
 *  ditangani oleh aplikasi web. ESP32 hanya:
 *    1) Mendaftarkan status dirinya       -> /devices/{DEVICE_ID}
 *    2) Mendengarkan perintah dari web    -> /commands/{DEVICE_ID}
 *    3) Mengirim event scan saat absensi  -> /scans/{DEVICE_ID}
 *    4) Melaporkan progres pendaftaran     -> /enroll_status/{DEVICE_ID}
 *
 *  Sensor    : R307 / AS608 / FPM10A (sensor sidik jari optik, UART)
 *  Board     : ESP32 DevKit v1 (atau sejenis)
 *
 *  ---- LIBRARY YANG DIBUTUHKAN (Arduino Library Manager) ----
 *    - "Firebase Arduino Client Library for ESP8266 and ESP32" by Mobizt (>= 4.4)
 *    - "Adafruit Fingerprint Sensor Library" by Adafruit (>= 2.1)
 *
 *  ---- WIRING (UART2) ----
 *    Sensor VCC  -> 3V3 (gunakan modul 3.3V; jika 5V pakai level shifter/VIN)
 *    Sensor GND  -> GND
 *    Sensor TX   -> GPIO16 (RX2 ESP32)
 *    Sensor RX   -> GPIO17 (TX2 ESP32)
 *    Buzzer (+)  -> GPIO27   (opsional)
 *    LED hijau   -> GPIO26   (opsional)
 *    LED merah   -> GPIO25   (opsional)
 *
 *  ---- SETUP FIREBASE ----
 *    Buat 1 akun "device" di Firebase Authentication (Email/Password), mis.
 *    device@sekolah.local. Isi DEVICE_EMAIL & DEVICE_PASSWORD di bawah.
 * ==========================================================================*/

#include <Arduino.h>
#include <WiFi.h>
#include <Adafruit_Fingerprint.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// ===================== KONFIGURASI - WAJIB DIISI =====================
#define WIFI_SSID       "NAMA_WIFI"
#define WIFI_PASSWORD   "PASSWORD_WIFI"

#define API_KEY         "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
#define DATABASE_URL    "https://nama-project-default-rtdb.asia-southeast1.firebasedatabase.app"

// Akun "device" yang dibuat di Firebase Authentication
#define DEVICE_EMAIL    "device@sekolah.local"
#define DEVICE_PASSWORD "rahasiadevice123"

// ID perangkat ini (HARUS sama dengan VITE_DEFAULT_DEVICE_ID di web)
#define DEVICE_ID       "esp32-gerbang-1"
#define FIRMWARE_VER    "1.0.0"
// =====================================================================

// ----- Pin -----
#define BUZZER_PIN 27
#define LED_GREEN  26
#define LED_RED    25
#define FP_RX 16  // RX2 ESP32  <- TX sensor
#define FP_TX 17  // TX2 ESP32  -> RX sensor

// ----- Interval (ms) -----
const unsigned long HEARTBEAT_MS = 10000;
const unsigned long CMD_POLL_MS  = 1200;
const unsigned long SCAN_GAP_MS  = 1500;  // jeda antar scan sukses

// ----- Objek -----
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger(&fpSerial);
FirebaseData fbdo;
FirebaseData stream;       // dicadangkan bila ingin pakai stream
FirebaseAuth auth;
FirebaseConfig config;

// ----- State -----
String mode = "attendance";   // "idle" | "attendance" | "enroll"
unsigned long lastHeartbeat = 0;
unsigned long lastCmdPoll   = 0;
unsigned long lastScan      = 0;
uint16_t templateCount      = 0;

String pDevice()  { return String("/devices/")  + DEVICE_ID; }
String pCommand() { return String("/commands/") + DEVICE_ID; }
String pScans()   { return String("/scans/")    + DEVICE_ID; }
String pEnroll()  { return String("/enroll_status/") + DEVICE_ID; }

// ---------------------------------------------------------------------------
void beep(int times, int dur = 80) {
  for (int i = 0; i < times; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(dur);
    digitalWrite(BUZZER_PIN, LOW);
    delay(dur);
  }
}
void led(bool green, bool red) {
  digitalWrite(LED_GREEN, green);
  digitalWrite(LED_RED, red);
}

// ---------------------------------------------------------------------------
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Menghubungkan WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    led(false, true);
    delay(300);
    led(false, false);
    delay(200);
  }
  Serial.printf("\nWiFi tersambung. IP: %s\n", WiFi.localIP().toString().c_str());
}

void initFirebase() {
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  auth.user.email = DEVICE_EMAIL;
  auth.user.password = DEVICE_PASSWORD;
  config.token_status_callback = tokenStatusCallback;  // dari TokenHelper.h
  Firebase.reconnectWiFi(true);
  Firebase.begin(&config, &auth);
  Serial.println("Firebase diinisialisasi.");
}

void initSensor() {
  fpSerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
  delay(100);
  if (finger.verifyPassword()) {
    Serial.println("Sensor sidik jari terdeteksi.");
    finger.getTemplateCount();
    templateCount = finger.templateCount;
    Serial.printf("Jumlah template tersimpan: %d\n", templateCount);
    beep(2);
  } else {
    Serial.println("ERROR: Sensor sidik jari TIDAK terdeteksi! Cek wiring.");
    beep(5, 150);
  }
}

// ---------------------------------------------------------------------------
void sendHeartbeat() {
  FirebaseJson j;
  j.set("status", "online");
  j.set("mode", mode);
  j.set("ip", WiFi.localIP().toString());
  j.set("firmwareVersion", FIRMWARE_VER);
  j.set("freeHeap", (int)ESP.getFreeHeap());
  j.set("sensorTemplateCount", templateCount);
  j.set("lastSeen/.sv", "timestamp");   // server timestamp (epoch ms)
  Firebase.RTDB.updateNode(&fbdo, pDevice().c_str(), &j);
}

void setEnrollStatus(const char *step, const String &msg, int progress, int fid) {
  FirebaseJson j;
  j.set("step", step);
  j.set("message", msg);
  j.set("progress", progress);
  j.set("fingerprintId", fid);
  j.set("updatedAt/.sv", "timestamp");
  Firebase.RTDB.setJSON(&fbdo, pEnroll().c_str(), &j);
}

void setCommandStatus(const char *status, const String &msg) {
  FirebaseJson j;
  j.set("status", status);
  j.set("message", msg);
  j.set("updatedAt/.sv", "timestamp");
  Firebase.RTDB.updateNode(&fbdo, pCommand().c_str(), &j);
}

void pushScan(int fid, int confidence) {
  FirebaseJson j;
  j.set("fingerprintId", fid);
  j.set("confidence", confidence);
  j.set("matched", true);
  j.set("timestamp/.sv", "timestamp");
  Firebase.RTDB.pushJSON(&fbdo, pScans().c_str(), &j);
}

// ---------------------------------------------------------------------------
// Pendaftaran (enroll) template ke slot `id`
bool enrollFingerprint(int id) {
  int p = -1;
  Serial.printf("Mulai enroll ke slot #%d\n", id);
  setEnrollStatus("place_first", "Letakkan jari pada sensor", 10, id);

  // ---- Ambil citra pertama ----
  unsigned long t0 = millis();
  while ((p = finger.getImage()) != FINGERPRINT_OK) {
    if (millis() - t0 > 20000) { setEnrollStatus("failed", "Waktu habis (jari tidak terdeteksi)", 0, id); return false; }
    delay(50);
  }
  if (finger.image2Tz(1) != FINGERPRINT_OK) { setEnrollStatus("failed", "Gagal memproses citra 1", 0, id); return false; }

  setEnrollStatus("remove_finger", "Angkat jari Anda", 40, id);
  beep(1);
  delay(800);
  while (finger.getImage() != FINGERPRINT_NOFINGER) delay(50);

  // ---- Ambil citra kedua ----
  setEnrollStatus("place_second", "Letakkan jari yang sama sekali lagi", 60, id);
  t0 = millis();
  while ((p = finger.getImage()) != FINGERPRINT_OK) {
    if (millis() - t0 > 20000) { setEnrollStatus("failed", "Waktu habis pada citra ke-2", 0, id); return false; }
    delay(50);
  }
  if (finger.image2Tz(2) != FINGERPRINT_OK) { setEnrollStatus("failed", "Gagal memproses citra 2", 0, id); return false; }

  // ---- Buat & simpan model ----
  setEnrollStatus("processing", "Menyimpan template…", 85, id);
  if (finger.createModel() != FINGERPRINT_OK) { setEnrollStatus("failed", "Sidik jari tidak cocok, ulangi", 0, id); return false; }
  if (finger.storeModel(id) != FINGERPRINT_OK) { setEnrollStatus("failed", "Gagal menyimpan ke sensor", 0, id); return false; }

  finger.getTemplateCount();
  templateCount = finger.templateCount;
  setEnrollStatus("success", "Pendaftaran berhasil!", 100, id);
  led(true, false); beep(2); delay(600); led(false, false);
  Serial.printf("Enroll #%d berhasil.\n", id);
  return true;
}

// Cari sidik jari yang sedang ditempel; kembalikan ID atau -1
int scanFingerprint(int &confidenceOut) {
  if (finger.getImage() != FINGERPRINT_OK) return -1;
  if (finger.image2Tz() != FINGERPRINT_OK) return -1;
  if (finger.fingerSearch() != FINGERPRINT_OK) {
    // Jari terdeteksi tapi tidak dikenali
    led(false, true); beep(2, 120); delay(400); led(false, false);
    return -1;
  }
  confidenceOut = finger.confidence;
  return finger.fingerID;
}

// ---------------------------------------------------------------------------
void handleCommand() {
  if (!Firebase.RTDB.getJSON(&fbdo, pCommand().c_str())) return;
  FirebaseJson &json = fbdo.to<FirebaseJson>();
  FirebaseJsonData r;

  json.get(r, "status");
  String status = r.success ? r.to<String>() : "";
  if (status != "pending") return;  // hanya proses perintah baru

  json.get(r, "action");
  String action = r.success ? r.to<String>() : "";
  Serial.printf("Perintah diterima: %s\n", action.c_str());

  if (action == "set_mode") {
    json.get(r, "mode");
    if (r.success) mode = r.to<String>();
    setCommandStatus("success", "Mode: " + mode);
    sendHeartbeat();
  }
  else if (action == "enroll") {
    json.get(r, "fingerprintId");
    int fid = r.success ? r.to<int>() : 0;
    if (fid <= 0) { setCommandStatus("failed", "fingerprintId tidak valid"); return; }
    setCommandStatus("in_progress", "Mendaftarkan…");
    String prevMode = mode; mode = "enroll"; sendHeartbeat();
    bool ok = enrollFingerprint(fid);
    setCommandStatus(ok ? "success" : "failed", ok ? "Terdaftar" : "Gagal");
    mode = prevMode; sendHeartbeat();
  }
  else if (action == "delete") {
    json.get(r, "fingerprintId");
    int fid = r.success ? r.to<int>() : 0;
    bool ok = (finger.deleteModel(fid) == FINGERPRINT_OK);
    finger.getTemplateCount(); templateCount = finger.templateCount;
    setCommandStatus(ok ? "success" : "failed", ok ? "Template dihapus" : "Gagal menghapus");
  }
  else if (action == "empty_db") {
    bool ok = (finger.emptyDatabase() == FINGERPRINT_OK);
    finger.getTemplateCount(); templateCount = finger.templateCount;
    setCommandStatus(ok ? "success" : "failed", ok ? "Sensor dikosongkan" : "Gagal");
  }
  else {
    setCommandStatus("failed", "Aksi tidak dikenal");
  }
}

// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  led(false, false);

  connectWiFi();
  initFirebase();
  initSensor();

  // Tunggu token siap, lalu kirim heartbeat pertama
  unsigned long t0 = millis();
  while (!Firebase.ready() && millis() - t0 < 15000) delay(100);
  sendHeartbeat();
  led(true, false); delay(300); led(false, false);
}

void loop() {
  if (!Firebase.ready()) { delay(100); return; }
  unsigned long now = millis();

  // Heartbeat berkala
  if (now - lastHeartbeat > HEARTBEAT_MS) {
    lastHeartbeat = now;
    sendHeartbeat();
  }

  // Polling perintah dari web
  if (now - lastCmdPoll > CMD_POLL_MS) {
    lastCmdPoll = now;
    handleCommand();
  }

  // Mode absensi: pindai sidik jari
  if (mode == "attendance" && now - lastScan > SCAN_GAP_MS) {
    int conf = 0;
    int id = scanFingerprint(conf);
    if (id > 0) {
      Serial.printf("Match! ID=%d confidence=%d\n", id, conf);
      pushScan(id, conf);
      led(true, false); beep(1); delay(500); led(false, false);
      lastScan = millis();
    }
  }

  delay(30);
}
