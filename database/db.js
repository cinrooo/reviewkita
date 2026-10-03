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

// Load data jika ada
if (fs.existsSync(dbPath)) {
  try {
    data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch (e) {
    console.error("Gagal membaca data.json, menggunakan data kosong.");
  }
}

// Simpan data
function save() {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

module.exports = {
  data,
  save,
  
  getCardByCode(code) {
    return data.cards.find(c => c.card_code === code);
  },
  
  getCardById(id) {
    return data.cards.find(c => c.id === Number(id));
  },
  
  getBusinessById(id) {
    return data.businesses.find(b => b.id === Number(id));
  },
  
  addBusiness(placeId, name, address) {
    const id = data.nextBusinessId++;
    const business = {
      id,
      google_place_id: placeId,
      business_name: name,
      address: address,
      created_at: new Date().toISOString()
    };
    data.businesses.push(business);
    save();
    return id;
  },
  
  activateCard(cardId, businessId) {
    const card = this.getCardById(cardId);
    if (card) {
      card.status = 'ACTIVE';
      card.business_id = businessId;
      card.activated_at = new Date().toISOString();
      save();
    }
  },
  
  addCard(cardCode) {
    if (this.getCardByCode(cardCode)) return false;
    const id = data.nextCardId++;
    data.cards.push({
      id,
      card_code: cardCode,
      activation_pin_hash: null, // Diisi nanti saat digenerate
      status: 'READY',
      business_id: null,
      activated_at: null,
      created_at: new Date().toISOString()
    });
    save();
    return true;
  },
  
  updateCardPin(cardCode, pinHash) {
    const card = this.getCardByCode(cardCode);
    if (card) {
      card.activation_pin_hash = pinHash;
      save();
    }
  },

  getAllCardsWithBusiness() {
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
  
  getStats() {
    return {
      total: data.cards.length,
      ready: data.cards.filter(c => c.status === 'READY').length,
      active: data.cards.filter(c => c.status === 'ACTIVE').length
    };
  }
};
