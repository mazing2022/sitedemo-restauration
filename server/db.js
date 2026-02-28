const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'restaurant.db');
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
const DEFAULT_MENU_SOURCE = path.join(__dirname, '..', 'assets', 'images', 'menu.jpg');
const DEFAULT_MENU_TARGET = path.join(UPLOADS_DIR, 'menu.jpg');

function ensureDirectories() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function createConnection() {
  ensureDirectories();
  return new sqlite3.Database(DB_PATH);
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

function close(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function defaultHours() {
  return {
    lundi: '11h30 - 14h30 / 18h30 - 22h30',
    mardi: '11h30 - 14h30 / 18h30 - 22h30',
    mercredi: '11h30 - 14h30 / 18h30 - 22h30',
    jeudi: '11h30 - 14h30 / 18h30 - 23h00',
    vendredi: '11h30 - 14h30 / 18h30 - 23h30',
    samedi: '12h00 - 15h00 / 19h00 - 23h30',
    dimanche: '12h00 - 15h00 / 19h00 - 22h00'
  };
}

async function initializeDatabase(db) {
  await run(db, 'PRAGMA journal_mode = WAL');
  await run(db, 'PRAGMA foreign_keys = ON');

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS info (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      hours_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS stats_visits (
      day TEXT PRIMARY KEY,
      visits INTEGER NOT NULL DEFAULT 0
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS stats_pages (
      path TEXT PRIMARY KEY,
      views INTEGER NOT NULL DEFAULT 0
    )`
  );

  const existingAdmin = await get(db, 'SELECT id FROM admins LIMIT 1');
  if (!existingAdmin) {
    const email = process.env.ADMIN_EMAIL || 'admin@tonrestaurant.fr';
    const password = process.env.ADMIN_PASSWORD || 'Admin@12345';
    const passwordHash = await bcrypt.hash(password, 12);
    await run(db, 'INSERT INTO admins(email, password_hash) VALUES (?, ?)', [email, passwordHash]);
  }

  const existingInfo = await get(db, 'SELECT id FROM info WHERE id = 1');
  if (!existingInfo) {
    await run(
      db,
      `INSERT INTO info(id, name, address, phone, email, hours_json)
       VALUES (1, ?, ?, ?, ?, ?)`,
      [
        'TONRESTAURANT',
        '12 Rue de Paradis, 75010 Paris',
        '01 44 00 11 22',
        'contact@tonrestaurant.fr',
        JSON.stringify(defaultHours())
      ]
    );
  }

  const menuSetting = await get(db, 'SELECT key FROM settings WHERE key = ?', ['menu_updated_at']);
  if (!menuSetting) {
    await run(db, 'INSERT INTO settings(key, value) VALUES(?, ?)', ['menu_updated_at', new Date().toISOString()]);
  }

  if (!fs.existsSync(DEFAULT_MENU_TARGET) && fs.existsSync(DEFAULT_MENU_SOURCE)) {
    fs.copyFileSync(DEFAULT_MENU_SOURCE, DEFAULT_MENU_TARGET);
  }
}

function parseHours(hoursJson) {
  try {
    const parsed = JSON.parse(hoursJson || '{}');
    return typeof parsed === 'object' && parsed !== null ? parsed : defaultHours();
  } catch (err) {
    return defaultHours();
  }
}

async function getInfoRecord(db) {
  const row = await get(db, 'SELECT name, address, phone, email, hours_json, updated_at FROM info WHERE id = 1');
  if (!row) {
    return {
      name: 'TONRESTAURANT',
      address: '',
      phone: '',
      email: '',
      hours: defaultHours(),
      updatedAt: null
    };
  }

  return {
    name: row.name,
    address: row.address,
    phone: row.phone,
    email: row.email,
    hours: parseHours(row.hours_json),
    updatedAt: row.updated_at
  };
}

module.exports = {
  DB_PATH,
  UPLOADS_DIR,
  createConnection,
  run,
  get,
  all,
  close,
  initializeDatabase,
  defaultHours,
  getInfoRecord
};
