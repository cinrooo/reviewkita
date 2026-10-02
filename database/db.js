const Database = require("better-sqlite3");
const path = require("path");

// Menentukan lokasi file database (akan dibuat otomatis jika belum ada)
const dbPath = path.join(__dirname, "reviewkita.db");
const db = new Database(dbPath);

console.log("Terhubung ke database SQLite.");

// Membuat Tabel Businesses
db.exec(`
  CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_place_id TEXT,
    business_name TEXT NOT NULL,
    address TEXT,
    google_maps_url TEXT,
    google_review_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Membuat Tabel Cards
// Status: 'READY', 'ACTIVE', 'SUSPENDED', 'REVOKED'
db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_code TEXT UNIQUE NOT NULL,
    activation_pin_hash TEXT,
    status TEXT DEFAULT 'READY',
    business_id INTEGER,
    activated_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses (id)
  )
`);

module.exports = db;
