# Panduan Deploy ReviewKita ke cPanel

## Persiapan Sebelum Deploy

Pastikan hosting cPanel Anda mendukung fitur **"Setup Node.js App"** (berbasis CloudLinux / Phusion Passenger).

---

## Langkah-Langkah Deploy

### 1. Upload Repository ke cPanel
- Buka **File Manager** di cPanel
- Upload semua file proyek ke folder tujuan (misal: `public_html/reviewkita` atau subfolder lainnya)
- **ATAU** gunakan fitur Git Version Control di cPanel untuk clone langsung dari GitHub

### 2. Setup Node.js App di cPanel
- Masuk ke menu **"Setup Node.js App"**
- Klik **Create Application**
- Isi konfigurasi:
  - **Node.js version:** pilih `18.x` atau `20.x` (wajib >= 18)
  - **Application mode:** `Production`
  - **Application root:** path ke folder proyek (misal: `reviewkita`)
  - **Application URL:** pilih domain/subdomain (reviewkita.my.id)
  - **Application startup file:** `server.js`
- Klik **Create**

### 3. Install Dependencies
- Di halaman Setup Node.js App, klik tombol **"Run NPM Install"**
  - Ini otomatis menjalankan `npm install` + `npm rebuild better-sqlite3`
- Tunggu sampai selesai

### 4. Buat File `.env` di Server (WAJIB!)
File `.env` tidak di-upload ke GitHub karena berisi data rahasia.
Buat file `.env` manual di server:

- Di **File Manager**, masuk ke folder proyek
- Klik **New File**, beri nama `.env`
- Edit file `.env`, isi dengan:

```
PORT=3000
GOOGLE_MAPS_API_KEY=AIzaSyCAC6jBzFywX2SXpDDq6xKG07fKYnrdxjY
ADMIN_USER=ezak
ADMIN_PASS=ezak623
SESSION_SECRET=reviewkita_secret_key_change_this
BASE_URL=https://reviewkita.my.id
```

> ⚠️ **PENTING:** Pastikan tidak ada spasi di awal/akhir setiap baris dan tidak ada baris kosong di akhir file.

### 5. Buat Folder QR Codes
- Di **File Manager**, masuk ke folder `public/`
- Buat folder baru bernama `qrcodes`
- Set permission folder ke `755`

### 6. Restart Aplikasi
- Kembali ke menu **"Setup Node.js App"**
- Klik tombol **"Restart"** pada aplikasi reviewkita

### 7. Test Login Admin
- Buka: `https://reviewkita.my.id/admin/login`
- Username: `ezak`
- Password: `ezak623`

---

## Troubleshooting Login Gagal di cPanel

Jika login masih gagal setelah mengikuti langkah di atas:

1. **Cek isi file `.env`** - Pastikan tidak ada karakter tersembunyi atau spasi ekstra
2. **Cek Node.js Logs** - Di Setup Node.js App, lihat Application Log
3. **Cek format `.env`** - Setiap baris harus tepat format `KEY=VALUE` tanpa spasi di sekitar `=`

---

## Struktur File yang Penting

```
reviewkita/
├── server.js          ← Entry point utama
├── app.js             ← Entry point untuk Phusion Passenger
├── package.json       ← Dependencies & scripts
├── .env               ← BUAT MANUAL di server (tidak ada di GitHub!)
├── .env.example       ← Template .env (ada di GitHub, untuk referensi)
├── database/
│   ├── db.js
│   ├── reviewkita.db  ← Database SQLite (otomatis dibuat saat pertama jalan)
│   └── generator.js   ← Jalankan untuk buat kartu baru
├── public/
│   ├── qrcodes/       ← BUAT FOLDER INI MANUAL, permission 755
│   └── style.css
└── views/
    ├── admin-login.html
    ├── admin-dashboard.html
    ├── activation.html
    └── review.html
```

---

## Setelah Berhasil Deploy

Generate kartu pertama Anda via SSH atau fitur Terminal di cPanel:
```bash
node database/generator.js
```
