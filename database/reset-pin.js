const db = require("./db");
const bcrypt = require("bcrypt");

// Kita reset PIN menjadi 1234
const pinBaru = "1234";
const hashBaru = bcrypt.hashSync(pinBaru, 10);
const kodeKartu = "RV-8R3R8BGY";

db.prepare(`UPDATE cards SET activation_pin_hash = ? WHERE card_code = ?`).run(
  hashBaru,
  kodeKartu,
);

console.log(
  `Berhasil! PIN untuk kartu ${kodeKartu} sudah direset menjadi: ${pinBaru}`,
);
