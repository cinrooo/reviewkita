ReviewKita — Smart NFC & QR Google Review Card Platform
ReviewKita adalah platform berbasis web dan hardware (kartu fisik pintar NFC & QR Code) yang dirancang untuk mempermudah pelaku usaha (UMKM, restoran, kafe, klinik, salon, hotel, bengkel, retail) mengumpulkan ulasan dan rating bintang 5 di Google Reviews dari pelanggan secara instan.

1. Problem Statement (Masalah yang Diselesaikan)
Kehilangan Potensi Ulasan Positif: Pelanggan yang puas sering kali enggan atau malas menulis review karena alur manual yang merepotkan (buka Google Maps -> cari nama bisnis -> pilih cabang yang tepat -> klik tab ulasan -> baru bisa menulis review).
Setup Manual yang Rumit untuk Merchant: Menghubungkan kartu NFC ke tautan Google Maps biasanya butuh konfigurasi manual teknis atau pemprograman kartu satu per satu sebelum dikirim ke pembeli.
Kurangnya Keamanan Kartu: Jika kartu NFC dijual massal, kartu bisa disalahgunakan jika tidak ada mekanisme aktivasi berbasis PIN yang aman.
2. Solusi ReviewKita
ReviewKita menghadirkan kartu fisik siap pakai (ready-to-use) dengan sistem Aktivasi Mandiri (Self-Service Activation):

Kartu diproduksi massal dalam status blank (READY) dengan kode unik dan PIN aktivasi rahasia.
Pembeli (pemilik usaha) mengaktifkan kartu sendiri cukup dengan tap/scan dan memilih profil usahanya di Google Maps tanpa bantuan teknisi.
Setelah aktif, setiap pelanggan yang men-tap ponselnya atau memindai kode QR akan langsung diarahkan ke form penilaian Google Maps secara otomatis.
3. Alur Kerja Sistem (End-to-End Workflow)
[ADMIN]                     [PEMILIK BISNIS]                     [PELANGGAN TOKO]
   │                               │                                    │
   ├─► Generate Kartu (Batch)      │                                    │
   │   (Kode RV-xxxx & PIN)        │                                    │
   │                               │                                    │
   ├─► Cetak QR & Isi NFC          │                                    │
   │   (Dijual ke Merchant) ──────►│                                    │
   │                               ├─► Scan/Tap Pertama Kali            │
   │                               │   (Status: READY)                  │
   │                               ├─► Cari Bisnis di Google Maps       │
   │                               ├─► Masukkan PIN 4 Digit             │
   │                               │   (Status berubah: ACTIVE)         │
   │                               │                                    │
   │                               │   Kartu ditaruh di meja kasir ────►│
   │                               │                                    ├─► Tap NFC / Scan QR
   │                               │                                    ├─► Buka Halaman Review
   │                               │                                    └─► Klik "Beri Rating"
   │                               │                                        (Direct ke Google Dialog)
   ▼                               ▼                                    ▼
[Dashboard Admin: Monitoring & Ekspor CSV]
Tahap 1: Produksi Kartu (Batch Generation)
Admin menjalankan perintah generator (npm run generate).
Sistem membuat kode kartu unik acak (contoh: RV-A1B2C3D4) dan PIN aktivasi 4 digit.
PIN di-hash menggunakan algoritma bcrypt demi keamanan.
Sistem otomatis menghasilkan file gambar QR Code berukuran 300x300 pixel di direktori public/qrcodes/.
File QR dan tautan kartu (https://domain.com/card/RV-xxxx) siap ditulis ke chip NFC (NTAG213/215) atau dicetak di kartu akrilik/PVC.
Tahap 2: Pembelian & Aktivasi Mandiri (Merchant Onboarding)
Pemilik toko menerima kartu fisik beserta PIN aktivasi (tertera di kemasan/amplop).
Pemilik toko membuka kartu (/card/{cardCode}).
Karena status kartu masih READY, halaman Aktivasi ([views/activation.html](file:///c:/New%20folder/reviewkita3/views/activation.html)) otomatis terbuka.
Pemilik toko mencari nama usahanya via integrasi Google Places API.
Memilih lokasi yang tepat, memasukkan PIN 4 digit yang sah, lalu klik Aktifkan.
Sistem menyimpan place_id, nama bisnis, dan alamat ke tabel businesses, lalu mengubah status kartu menjadi ACTIVE.
Tahap 3: Pengumpulan Ulasan Pelanggan (Customer Review Flow)
Kartu ditaruh di meja kasir, meja makan, atau resepsionis.
Pelanggan menempelkan smartphone (NFC) atau memindai QR Code.
Server mendeteksi status kartu telah ACTIVE dan menampilkan halaman [views/review.html](file:///c:/New%20folder/reviewkita3/views/review.html) lengkap dengan nama toko dan alamat.
Tersedia tombol cepat dengan tautan resmi Google: https://search.google.com/local/writereview?placeid={google_place_id}
Tautan ini langsung memunculkan pop-up input bintang ulasan Google di perangkat pengguna.
Tahap 4: Pemantauan Admin (Admin Dashboard)
Admin login melalui halaman rahasia /admin/login.
Melalui dashboard /admin, admin dapat:
Melihat ringkasan metrik: Total Kartu, Kartu Siap Pakai (READY), Kartu Aktif (ACTIVE).
Mencari kartu berdasarkan kode atau nama bisnis.
Membuka langsung QR Code atau halaman kartu.
Menghapus data kartu beserta file QR fisik.
Mengunduh laporan inventaris dalam format CSV (/api/admin/export-csv).
4. Arsitektur & Teknologi (Tech Stack)
Komponen	Teknologi / Pustaka	Keterangan
Runtime	Node.js	Engine JavaScript server-side
Web Framework	Express.js (v5)	Routing, static serving, middleware
Database	SQLite (better-sqlite3)	Database lokal relasional super cepat tanpa server DB terpisah
Keamanan	bcrypt, helmet, express-rate-limit, express-session	Hashing PIN, sanitasi header, proteksi brute-force API, dan sesi admin
Integrasi Eksternal	Google Places API (New)	Pencarian tempat usaha real-time berdasarkan query
Generator QR	qrcode	Pembuatan aset gambar QR Code (.png) lokal
Frontend	Vanilla HTML5, CSS3, JavaScript	Ringan, responsif di semua perangkat seluler tanpa bundle berat
5. Struktur Basis Data (Schema)
Tabel cards:

id: Primary Key
card_code: Kode unik kartu (contoh: RV-XXXXXXXX)
activation_pin_hash: Hash bcrypt dari 4-digit PIN aktivasi
status: READY | ACTIVE | SUSPENDED | REVOKED
business_id: Relasi ke tabel businesses (Foreign Key)
activated_at: Timestamp kartu diaktivasi
created_at: Timestamp kartu dibuat
Tabel businesses:

id: Primary Key
google_place_id: ID unik tempat dari Google Maps
business_name: Nama toko / usaha
address: Alamat lengkap toko
google_maps_url: URL Google Maps (opsional)
google_review_url: URL ulasan Google langsung
created_at: Timestamp pendaftaran bisnis
6. Target Pengguna & Potensi Monetisasi
Model Penjualan Fisik: Menjual paket kartu NFC + QR Code berbahan PVC atau Acrylic Stand ke pemilik toko.
Model Langganan / Tambahan: Biaya kustomisasi logo bisnis di kartu, dashboard analitik review tingkat lanjut, atau proteksi komplain (feedback filtering).
Segmen Pasar: Kafe, coffee shop, restoran, barbershop, salon kecantikan, klinik gigi, bengkel motor/mobil, penginapan & hotel butik.
