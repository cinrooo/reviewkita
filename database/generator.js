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

// Ambil jumlah kartu dari argumen, default 10
const args = process.argv.slice(2);
const amountArg = args[0] ? parseInt(args[0]) : 10;
const JUMLAH_KARTU = isNaN(amountArg) ? 10 : amountArg;

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "") + "/card/";

console.log(`Memulai proses pencetakan ${JUMLAH_KARTU} kartu baru...`);
console.log(`--------------------------------------------------`);

for (let i = 0; i < JUMLAH_KARTU; i++) {
  const code = generateCardCode();
  const pin = generatePIN();
  const hashedPin = bcrypt.hashSync(pin, 10);

  // 1. Simpan ke Database
  if (db.addCard(code)) {
    db.updateCardPin(code, hashedPin);

    // 2. Buat file Gambar QR Code (.png)
    const cardUrl = BASE_URL + code;
    const filePath = path.join(qrFolder, `${code}.png`);

    QRCode.toFile(
      filePath,
      cardUrl,
      {
        width: 300,
        margin: 2,
      },
      function (err) {
        if (err) console.error("Gagal membuat QR untuk", code, err);
      },
    );

    // 3. Tampilkan di terminal (Nanti data ini yang diserahkan ke percetakan)
    console.log(`${i + 1}. Kode Kartu: ${code} | PIN Aktivasi: ${pin}`);
  } else {
    console.log(`${i + 1}. [SKIP] Kartu sudah ada: ${code}`);
  }
}

console.log(`--------------------------------------------------`);
console.log(`Selesai! Database telah diperbarui.`);
console.log(
  `Silakan cek folder 'public/qrcodes/' untuk melihat file gambarnya.`,
);
