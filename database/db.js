const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data.json');

// Struktur awal
let data = {
  businesses: [],
  cards: [],
  nextBusinessId: 1,
  nextCardId: 1
};

let lastMtime = 0;

function reload() {
  if (fs.existsSync(dbPath)) {
    try {
      const stat = fs.statSync(dbPath);
      data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      lastMtime = stat.mtimeMs;
    } catch (e) {
      console.error("Gagal membaca data.json:", e.message);
    }
  }
}

function checkReload() {
  try {
    if (fs.existsSync(dbPath)) {
      const stat = fs.statSync(dbPath);
      if (stat.mtimeMs > lastMtime) {
        reload();
      }
    }
  } catch (e) {
    // Ignore error
  }
}

// Load data saat inisialisasi
reload();

// Simpan data
function save() {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  try {
    lastMtime = fs.statSync(dbPath).mtimeMs;
  } catch (e) {}
}

module.exports = {
  get data() {
    checkReload();
    return data;
  },
  reload,
  save,
  
  getCardByCode(code) {
    checkReload();
    return data.cards.find(c => c.card_code === code);
  },
  
  getCardById(id) {
    checkReload();
    return data.cards.find(c => c.id === Number(id));
  },
  
  getBusinessById(id) {
    checkReload();
    return data.businesses.find(b => b.id === Number(id));
  },
  
  addBusiness(placeId, name, address, reviewUrl = null) {
    checkReload();
    const id = data.nextBusinessId++;
    const isUrl = typeof placeId === "string" && (placeId.startsWith("http://") || placeId.startsWith("https://"));
    const business = {
      id,
      google_place_id: placeId,
      business_name: name,
      address: address,
      review_url: reviewUrl || (isUrl ? placeId : null),
      created_at: new Date().toISOString()
    };
    data.businesses.push(business);
    save();
    return id;
  },
  
  activateCard(cardId, businessId) {
    checkReload();
    const card = this.getCardById(cardId);
    if (card) {
      card.status = 'ACTIVE';
      card.business_id = businessId;
      card.activated_at = new Date().toISOString();
      save();
    }
  },
  
  addCard(cardCode, pin = null) {
    checkReload();
    if (this.getCardByCode(cardCode)) return false;
    const id = data.nextCardId++;
    data.cards.push({
      id,
      card_code: cardCode,
      activation_pin: pin,
      activation_pin_hash: null, // Diisi nanti saat digenerate
      status: 'READY',
      business_id: null,
      activated_at: null,
      created_at: new Date().toISOString()
    });
    save();
    return true;
  },
  
  updateCardPin(cardCode, pinHash, plainPin = null) {
    checkReload();
    const card = this.getCardByCode(cardCode);
    if (card) {
      card.activation_pin_hash = pinHash;
      if (plainPin) card.activation_pin = plainPin;
      save();
    }
  },

  getAllCardsWithBusiness() {
    checkReload();
    return data.cards.map(c => {
      const b = c.business_id ? this.getBusinessById(c.business_id) : null;
      return {
        ...c,
        business_name: b ? b.business_name : null,
        address: b ? b.address : null
      };
    }).reverse(); // Urutkan terbaru di atas
  },
  
  deleteCard(cardId) {
    checkReload();
    const cardIndex = data.cards.findIndex(c => c.id === Number(cardId));
    if (cardIndex > -1) {
      const card = data.cards[cardIndex];
      // Hapus bisnis terkait jika ada
      if (card.business_id) {
        data.businesses = data.businesses.filter(b => b.id !== card.business_id);
      }
      data.cards.splice(cardIndex, 1);
      save();
      return card;
    }
    return null;
  },
  
  resetCard(cardId, newPin = null, newPinHash = null) {
    checkReload();
    const card = this.getCardById(cardId);
    if (card) {
      if (card.business_id) {
        data.businesses = data.businesses.filter(b => b.id !== card.business_id);
      }
      card.status = 'READY';
      card.business_id = null;
      card.activated_at = null;
      if (newPin) card.activation_pin = newPin;
      if (newPinHash) card.activation_pin_hash = newPinHash;
      save();
      return card;
    }
    return null;
  },

  getStats() {
    checkReload();
    return {
      total: data.cards.length,
      ready: data.cards.filter(c => c.status === 'READY').length,
      active: data.cards.filter(c => c.status === 'ACTIVE').length
    };
  }
};
