// ============================================
// insert_jagersro.js
// ENGÅNGSSKRIPT: Skapar Malmö Jägersro i OFFICES-tabellen
// KÖR EN GÅNG: node insert_jagersro.js
// ============================================

const sqlite3 = require('sqlite3');
const path    = require('path');

const dbPath = path.join(__dirname, 'atlas.db');
const db     = new sqlite3.Database(dbPath);

const routing_tag  = 'malmo_jagersro';
const city         = 'Malmö';
const area         = 'Jägersro';
const name         = 'Mårtenssons Trafikskola – Malmö Jägersro (Tung Trafik)';
const phone        = '010-188 83 26';
const email        = 'tungtrafik@trafikskolan.com';
const address      = 'Jägersrovägen 213, Malmö';
const office_color = '#0071e3';

db.get(
  'SELECT id FROM offices WHERE routing_tag = ?',
  [routing_tag],
  (err, row) => {
    if (err) {
      console.error('❌ Databasfel vid kontroll:', err.message);
      db.close();
      return;
    }
    if (row) {
      console.log(`⚠️  Kontoret "${routing_tag}" finns redan (id: ${row.id}). Ingenting gjordes.`);
      db.close();
      return;
    }
    db.run(
      `INSERT INTO offices (city, area, routing_tag, name, office_color, phone, email, address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [city, area, routing_tag, name, office_color, phone, email, address],
      function(err) {
        if (err) {
          console.error('❌ INSERT misslyckades:', err.message);
        } else {
          console.log(`✅ Malmö Jägersro skapad i OFFICES med id: ${this.lastID}`);
          console.log(`   routing_tag : ${routing_tag}`);
          console.log(`   Nästa steg  : Lägg malmo_jagersro.json i knowledge/ och starta om servern.`);
        }
        db.close();
      }
    );
  }
);