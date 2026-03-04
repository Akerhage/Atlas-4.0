// inspect_db.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./atlas.db');

db.all("PRAGMA table_info(CHAT_V2_STATE)", (err, rows) => {
  console.log("--- Kolumner i CHAT_V2_STATE ---");
  rows.forEach(row => console.log(`- ${row.name} (${row.type})`));
  db.close();
});