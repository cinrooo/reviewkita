const db = require("./db");
const bcrypt = require("bcrypt");

// Hapus data kartu yang lama agar bersih
db.exec("DELETE FROM cards");

const insertCard = db.prepare(`
  INSERT INTO cards (card_code, activation_pin_hash, status) 
  VALUES (?, ?, ?)
`);

// Kita buat 1 kartu testing dengan PIN 4827
const testCode = "RV-TESTING";
const testPin = "4827";

// Enkripsi PIN menggunakan bcrypt sebelum disimpan ke database
const hashedPin = bcrypt.hashSync(testPin, 10);

insertCard.run(testCode, hashedPin, "READY");
console.log(`Berhasil membuat kartu TEST: ${testCode}`);
console.log(`PIN Aktivasi: ${testPin}`);
console.log(`(Status: READY)`);
