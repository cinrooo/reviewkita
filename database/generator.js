require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const db = require("./db");
const bcrypt = require("bcrypt");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");

// Memastikan folder public/qrcodes tersedia
const qrFolder = path.join(__dirname, "../public/qrcodes");
if (!fs.existsSync(qrFolder)) {
  fs.mkdirSync(qrFolder, { recursive: true });
}

// Fungsi membuat Card Code acak (Format: RV-XXXXXXXX)
function generateCardCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "RV-";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Fungsi membuat PIN 4 Digit angka acak (contoh: 0492, 8310)
function generatePIN() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

// JUMLAH KARTU YANG INGIN DIBUAT (Kita coba 10 dulu)
const JUMLAH_KARTU = 10;
const BASE_URL = (process.env.BASE_URL || "http://localhost:3000") + "/card/";

console.log(`Memulai proses pencetakan ${JUMLAH_KARTU} kartu baru...`);
console.log(`--------------------------------------------------`);

const insertCard = db.prepare(`
  INSERT INTO cards (card_code, activation_pin_hash, status) 
  VALUES (?, ?, 'READY')
`);

// Kita gunakan db.transaction agar proses simpan banyak data jauh lebih cepat
const generateAll = db.transaction(() => {
  for (let i = 0; i < JUMLAH_KARTU; i++) {
    const code = generateCardCode();
    const pin = generatePIN();
    const hashedPin = bcrypt.hashSync(pin, 10);

    // 1. Simpan ke Database
    insertCard.run(code, hashedPin);

    // 2. Buat file Gambar QR Code (.png)
    const cardUrl = BASE_URL + code;
    const filePath = path.join(qrFolder, `${code}.png`);

    QRCode.toFile(
      filePath,
      cardUrl,
      {
        width: 300, // Ukuran gambar 300x300 pixel
        margin: 2,
      },
      function (err) {
        if (err) console.error("Gagal membuat QR untuk", code, err);
      },
    );

    // 3. Tampilkan di terminal (Nanti data ini yang diserahkan ke percetakan)
    console.log(`${i + 1}. Kode Kartu: ${code} | PIN Aktivasi: ${pin}`);
  }
});

// Jalankan prosesnya
generateAll();

console.log(`--------------------------------------------------`);
console.log(`Selesai! Database telah diperbarui.`);
console.log(
  `Silakan cek folder 'public/qrcodes/' untuk melihat file gambarnya.`,
);
