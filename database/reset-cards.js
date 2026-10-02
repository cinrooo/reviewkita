/**
 * Reset Cards - ReviewKita
 * ========================
 * Script untuk menghapus SEMUA data kartu dan bisnis dari database,
 * serta menghapus semua file QR code yang sudah di-generate.
 * 
 * Gunakan ini jika ingin memulai dari awal (fresh start).
 * 
 * Cara pakai: node database/reset-cards.js
 */

const db = require("./db");
const path = require("path");
const fs = require("fs");

console.log("⚠️  PERINGATAN: Ini akan menghapus SEMUA data kartu dan bisnis!");
console.log("=================================================");

// 1. Hitung data sebelum dihapus
const cardCount = db.prepare("SELECT COUNT(*) as total FROM cards").get().total;
const bizCount = db.prepare("SELECT COUNT(*) as total FROM businesses").get().total;
console.log(`Data saat ini: ${cardCount} kartu, ${bizCount} bisnis`);

// 2. Hapus semua data dari tabel (urutan penting karena foreign key)
db.exec("DELETE FROM cards");
db.exec("DELETE FROM businesses");

// 3. Reset auto-increment counter
db.exec("DELETE FROM sqlite_sequence WHERE name='cards'");
db.exec("DELETE FROM sqlite_sequence WHERE name='businesses'");

console.log("✅ Database berhasil dikosongkan.");

// 4. Hapus semua file QR Code di folder public/qrcodes/
const qrFolder = path.join(__dirname, "../public/qrcodes");
if (fs.existsSync(qrFolder)) {
  const files = fs.readdirSync(qrFolder);
  let deleted = 0;
  files.forEach((file) => {
    if (file.endsWith(".png")) {
      fs.unlinkSync(path.join(qrFolder, file));
      deleted++;
    }
  });
  console.log(`✅ ${deleted} file QR code berhasil dihapus.`);
} else {
  console.log("ℹ️  Folder qrcodes tidak ditemukan (sudah bersih).");
}

console.log("=================================================");
console.log("🎉 Reset selesai! Database dan QR code sudah bersih.");
console.log("Jalankan 'node database/generator.js' untuk membuat kartu baru.");
