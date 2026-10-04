require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const QRCode = require("qrcode");
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
app.get("/api/admin/cards", requireAdmin, async (req, res) => {
  try {
    const cards = db.getAllCardsWithBusiness();
    res.json(cards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// [BARU] Endpoint Generate Kartu Baru dari Dashboard Admin
app.post("/api/admin/cards/generate", requireAdmin, async (req, res) => {
  try {
    const amount = Math.min(Math.max(parseInt(req.body.count) || 5, 1), 50);
    const generated = [];
    const qrFolder = path.join(__dirname, "public", "qrcodes");
    if (!fs.existsSync(qrFolder)) fs.mkdirSync(qrFolder, { recursive: true });
    const BASE_URL = (process.env.BASE_URL || "https://reviewkita.my.id").replace(/\/+$/, "") + "/card/";

    for (let i = 0; i < amount; i++) {
      let code = "RV-";
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      for (let j = 0; j < 8; j++) code += chars.charAt(Math.floor(Math.random() * chars.length));
      const pin = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
      const hashedPin = bcrypt.hashSync(pin, 10);

      if (db.addCard(code)) {
        db.updateCardPin(code, hashedPin);
        const cardUrl = BASE_URL + code;
        const filePath = path.join(qrFolder, `${code}.png`);
        try {
          await QRCode.toFile(filePath, cardUrl, { width: 300, margin: 2 });
        } catch (e) {
          console.error("QR Error:", e);
        }
        generated.push({ code, pin, qrUrl: `/qrcodes/${code}.png` });
      }
    }
    res.json({ success: true, count: generated.length, cards: generated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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

  const card = db.getCardByCode(cardCode);

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

  const businessId = db.addBusiness(place_id, business_name, address);
  db.activateCard(card.id, businessId);

  res.json({ success: true, message: "Aktivasi berhasil!" });
});

app.get("/card/:cardCode", async (req, res) => {
  const cardCode = req.params.cardCode;
  const card = db.getCardByCode(cardCode);

  if (!card)
    return res
      .status(404)
      .send(
        '<h1 style="text-align:center; margin-top:50px;">Kartu tidak ditemukan</h1>',
      );

  if (card.status === "READY") {
    return res.sendFile(path.join(__dirname, "views", "activation.html"));
  } else if (card.status === "ACTIVE") {
    const business = db.getBusinessById(card.business_id);
    const reviewUrl = `https://search.google.com/local/writereview?placeid=${business.google_place_id}`;
    return res.redirect(reviewUrl);
  } else {
    return res
      .status(403)
      .send(
        '<h1 style="text-align:center; margin-top:50px;">Kartu tidak dapat digunakan</h1>',
      );
  }
});

// ==========================================
// [BARU] Endpoint Info Kartu (untuk halaman review)
// ==========================================
app.get("/api/cards/:cardCode/info", async (req, res) => {
  const cardCode = req.params.cardCode;
  const card = db.getCardByCode(cardCode);

  if (!card || card.status !== "ACTIVE") {
    return res.status(404).json({ success: false, message: "Kartu tidak ditemukan atau belum aktif" });
  }

  const business = db.getBusinessById(card.business_id);
  if (!business) {
    return res.status(404).json({ success: false, message: "Data bisnis tidak ditemukan" });
  }

  const reviewUrl = `https://search.google.com/local/writereview?placeid=${business.google_place_id}`;

  res.json({
    success: true,
    business_name: business.business_name,
    address: business.address,
    review_url: reviewUrl,
  });
});

// ==========================================
// [BARU] Endpoint Ekspor CSV Data Kartu
// ==========================================
app.get("/api/admin/export-csv", requireAdmin, async (req, res) => {
  try {
    const cards = db.getAllCardsWithBusiness();

    let csv = "ID,Kode Kartu,Status,Nama Bisnis,Alamat,Tanggal Aktivasi,Tanggal Dibuat\n";
    cards.forEach((c) => {
      csv += `${c.id},"${c.card_code}","${c.status}","${c.business_name || ""}","${(c.address || "").replace(/"/g, '""')}","${c.activated_at || ""}","${c.created_at || ""}"\n`;
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=reviewkita-cards.csv");
    res.send(csv);
  } catch (err) {
    res.status(500).send("Error mengekspor CSV");
  }
});

// ==========================================
// [BARU] Endpoint Hapus Kartu (Admin)
// ==========================================
app.delete("/api/admin/cards/:id", requireAdmin, async (req, res) => {
  const cardId = req.params.id;
  try {
    const card = db.deleteCard(cardId);

    if (!card) {
      return res.status(404).json({ success: false, message: "Kartu tidak ditemukan" });
    }

    // Hapus file QR jika ada
    const qrPath = path.join(__dirname, "public", "qrcodes", `${card.card_code}.png`);
    if (fs.existsSync(qrPath)) {
      fs.unlinkSync(qrPath);
    }

    res.json({ success: true, message: "Kartu berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ==========================================
// [BARU] Endpoint Statistik Dashboard
// ==========================================
app.get("/api/admin/stats", requireAdmin, async (req, res) => {
  try {
    const stats = db.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`ReviewKita berjalan di http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});

