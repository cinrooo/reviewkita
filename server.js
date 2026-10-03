require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const session = require("express-session"); // [BARU] Modul Session
const db = require("./database/db");

let helmet, rateLimit;
try {
  helmet = require("helmet");
} catch (e) {
  helmet = null;
}
try {
  rateLimit = require("express-rate-limit");
} catch (e) {
  rateLimit = null;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Diperlukan agar session & cookie berjalan di balik reverse proxy cPanel/Nginx
app.set("trust proxy", 1);

// Pengaturan Session (Login)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "reviewkita_secret_default",
    resave: true,
    saveUninitialized: false,
    cookie: {
      secure: false, // set true jika sudah pakai HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 jam
    },
  }),
);

// [BARU] Security Headers
if (helmet) {
  app.use(helmet({ contentSecurityPolicy: false }));
}

// [BARU] Rate Limiter untuk API
if (rateLimit) {
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 100, // Maks 100 request per IP per 15 menit
    message: { error: "Terlalu banyak request, coba lagi nanti." },
  });
  app.use("/api/", apiLimiter);
}

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// [BARU] Middleware: Fungsi Penjaga Halaman Admin
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next(); // Boleh masuk
  }
  res.redirect("/admin/login"); // Jika belum login, lempar ke halaman login
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/api/health", (req, res) =>
  res.json({ status: "ok", app: "reviewkita" }),
);

// ==========================================
// [BARU] Rute Admin Login & Dashboard
// ==========================================
// 1. Tampilkan Halaman Login
app.get("/admin/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin-login.html"));
});

// 2. Proses Data Login
app.post("/admin/login", (req, res) => {
  // .trim() mencegah masalah spasi tersembunyi di nilai .env (khususnya di cPanel)
  const username = (req.body.username || "").trim();
  const password = (req.body.password || "").trim();
  const adminUser = (process.env.ADMIN_USER || "").trim();
  const adminPass = (process.env.ADMIN_PASS || "").trim();

  if (username === adminUser && password === adminPass) {
    req.session.isAdmin = true;
    // session.save() memastikan sesi tersimpan SEBELUM redirect (penting di cPanel)
    return req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).send("Session error, coba lagi.");
      }
      res.redirect("/admin");
    });
  }

  // Jika gagal, log untuk debug lalu kembalikan ke login
  console.log(`[LOGIN GAGAL] User: '${username}', Expected: '${adminUser}'`);
  res.send(
    '<script>alert("Username atau Password Salah!"); window.location.href="/admin/login";</script>',
  );
});

// 3. Proses Logout
app.get("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin/login");
  });
});

// 4. Halaman Dashboard Admin (Dilindungi middleware requireAdmin)
app.get("/admin", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin-dashboard.html"));
});

// 5. Endpoint Ambil Data Kartu untuk Dashboard
app.get("/api/admin/cards", requireAdmin, (req, res) => {
  // Ambil semua kartu, lalu gabungkan (JOIN) dengan nama bisnisnya jika sudah ada
  const cards = db
    .prepare(
      `
        SELECT cards.id, cards.card_code, cards.status, cards.activated_at, businesses.business_name 
        FROM cards 
        LEFT JOIN businesses ON cards.business_id = businesses.id
        ORDER BY cards.id DESC
    `,
    )
    .all();
  res.json(cards);
});

// ==========================================
// Rute Aktivasi dan Review (Sama seperti Phase sebelumnya)
// ==========================================
app.get("/api/search-business", async (req, res) => {
  const query = (req.query.q || "").trim();
  if (!query) return res.status(400).json({ error: "Query kosong" });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === "your_api_key_here") {
    return res.json([
      {
        place_id: "ChIJ_dummy_1",
        name: query + " (Pusat)",
        address: "Jl. Merdeka No. 1",
      },
      {
        place_id: "ChIJ_dummy_2",
        name: query + " (Cabang)",
        address: "Jl. Sudirman No. 2",
      },
    ]);
  }

  try {
    // Places API (New) - Text Search
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress",
        },
        body: JSON.stringify({
          textQuery: query,
          languageCode: "id",
          regionCode: "ID",
        }),
      },
    );
    const data = await response.json();

    // Jika Google menolak (API belum aktif, key salah, billing mati, dll)
    if (!response.ok) {
      console.error("Google Places error:", JSON.stringify(data.error || data));
      return res.status(502).json({
        error:
          "Google Places API menolak permintaan: " +
          ((data.error && data.error.message) || "alasan tidak diketahui"),
      });
    }

    const results = (data.places || []).map((place) => ({
      place_id: place.id,
      name: place.displayName ? place.displayName.text : "(tanpa nama)",
      address: place.formattedAddress || "",
    }));
    res.json(results);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/cards/:cardCode/activate", async (req, res) => {
  const cardCode = req.params.cardCode;
  const { place_id, business_name, address, pin } = req.body;

  if (!place_id || !business_name || !pin)
    return res
      .status(400)
      .json({ success: false, message: "Data belum lengkap!" });

  const stmtCard = db.prepare("SELECT * FROM cards WHERE card_code = ?");
  const card = stmtCard.get(cardCode);

  if (!card)
    return res
      .status(404)
      .json({ success: false, message: "Kartu tidak ditemukan" });
  if (card.status !== "READY")
    return res
      .status(400)
      .json({ success: false, message: "Kartu sudah aktif/diblokir" });

  const isMatch = await bcrypt.compare(pin, card.activation_pin_hash);
  if (!isMatch)
    return res.status(401).json({ success: false, message: "PIN Salah!" });

  const stmtInsert = db.prepare(
    "INSERT INTO businesses (google_place_id, business_name, address) VALUES (?, ?, ?)",
  );
  const info = stmtInsert.run(place_id, business_name, address);

  const stmtUpdate = db.prepare(
    `UPDATE cards SET status = 'ACTIVE', business_id = ?, activated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  );
  stmtUpdate.run(info.lastInsertRowid, card.id);

  res.json({ success: true, message: "Aktivasi berhasil!" });
});

app.get("/card/:cardCode", (req, res) => {
  const cardCode = req.params.cardCode;
  const card = db
    .prepare("SELECT * FROM cards WHERE card_code = ?")
    .get(cardCode);

  if (!card)
    return res
      .status(404)
      .send(
        '<h1 style="text-align:center; margin-top:50px;">Kartu tidak ditemukan</h1>',
      );

  if (card.status === "READY") {
    return res.sendFile(path.join(__dirname, "views", "activation.html"));
  } else if (card.status === "ACTIVE") {
    const business = db
      .prepare("SELECT * FROM businesses WHERE id = ?")
      .get(card.business_id);
    const reviewUrl = `https://search.google.com/local/writereview?placeid=${business.google_place_id}`;
    let html = fs.readFileSync(
      path.join(__dirname, "views", "review.html"),
      "utf-8",
    );
    html = html
      .replace("{{BUSINESS_NAME}}", business.business_name)
      .replace("{{BUSINESS_ADDRESS}}", business.address)
      .replace("{{REVIEW_URL}}", reviewUrl);
    return res.send(html);
  } else {
    return res
      .status(403)
      .send(
        '<h1 style="text-align:center; margin-top:50px;">Kartu tidak dapat digunakan</h1>',
      );
  }
});

// ==========================================
// [BARU] Endpoint Ekspor CSV Data Kartu
// ==========================================
app.get("/api/admin/export-csv", requireAdmin, (req, res) => {
  const cards = db
    .prepare(
      `
      SELECT cards.id, cards.card_code, cards.status, cards.activated_at, cards.created_at, businesses.business_name, businesses.address
      FROM cards
      LEFT JOIN businesses ON cards.business_id = businesses.id
      ORDER BY cards.id DESC
    `,
    )
    .all();

  let csv = "ID,Kode Kartu,Status,Nama Bisnis,Alamat,Tanggal Aktivasi,Tanggal Dibuat\n";
  cards.forEach((c) => {
    csv += `${c.id},"${c.card_code}","${c.status}","${c.business_name || ""}","${(c.address || "").replace(/"/g, '""')}","${c.activated_at || ""}","${c.created_at || ""}"\n`;
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=reviewkita-cards.csv");
  res.send(csv);
});

// ==========================================
// [BARU] Endpoint Hapus Kartu (Admin)
// ==========================================
app.delete("/api/admin/cards/:id", requireAdmin, (req, res) => {
  const cardId = req.params.id;
  const card = db.prepare("SELECT * FROM cards WHERE id = ?").get(cardId);

  if (!card) {
    return res.status(404).json({ success: false, message: "Kartu tidak ditemukan" });
  }

  // Hapus file QR jika ada
  const qrPath = path.join(__dirname, "public", "qrcodes", `${card.card_code}.png`);
  if (fs.existsSync(qrPath)) {
    fs.unlinkSync(qrPath);
  }

  // Hapus bisnis terkait jika ada
  if (card.business_id) {
    db.prepare("DELETE FROM businesses WHERE id = ?").run(card.business_id);
  }

  db.prepare("DELETE FROM cards WHERE id = ?").run(cardId);
  res.json({ success: true, message: "Kartu berhasil dihapus" });
});

// ==========================================
// [BARU] Endpoint Statistik Dashboard
// ==========================================
app.get("/api/admin/stats", requireAdmin, (req, res) => {
  const total = db.prepare("SELECT COUNT(*) as count FROM cards").get().count;
  const ready = db.prepare("SELECT COUNT(*) as count FROM cards WHERE status = 'READY'").get().count;
  const active = db.prepare("SELECT COUNT(*) as count FROM cards WHERE status = 'ACTIVE'").get().count;
  res.json({ total, ready, active });
});

// Jalankan server:
// - Jika dijalankan langsung (node server.js / npm start): listen di PORT
// - Jika diimpor oleh app.js (Phusion Passenger cPanel): ekspor app
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ReviewKita berjalan di http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
  });
} else {
  // Untuk Phusion Passenger di cPanel
  module.exports = app;
}
