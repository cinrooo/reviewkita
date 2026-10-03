const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "reviewkita.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Gagal terhubung ke database:", err.message);
  } else {
    console.log("Terhubung ke database SQLite (sqlite3).");
  }
});

db.serialize(() => {
  db.run(`
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

  db.run(`
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
});

// Promise wrappers
const queryAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const queryGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const queryRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastInsertRowid: this.lastID, changes: this.changes });
    });
  });
};

module.exports = {
  db,
  all: queryAll,
  get: queryGet,
  run: queryRun
};
