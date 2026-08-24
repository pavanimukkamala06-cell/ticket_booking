const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'tickets.db');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// ─── Schema ────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    email       TEXT    NOT NULL UNIQUE,
    password_hash TEXT  NOT NULL,
    role        TEXT    NOT NULL CHECK(role IN ('customer','organiser','admin')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS venues (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    address     TEXT    NOT NULL,
    created_by  INTEGER REFERENCES users(id),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS seat_categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id    INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    color       TEXT    NOT NULL DEFAULT '#4f46e5',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS seats (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id    INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES seat_categories(id),
    row_label   TEXT    NOT NULL,
    seat_number INTEGER NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(venue_id, row_label, seat_number)
  );

  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    type        TEXT    NOT NULL CHECK(type IN ('movie','concert')),
    venue_id    INTEGER NOT NULL REFERENCES venues(id),
    organiser_id INTEGER NOT NULL REFERENCES users(id),
    event_date  TEXT    NOT NULL,
    event_time  TEXT    NOT NULL,
    description TEXT,
    poster_url  TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS event_pricing (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES seat_categories(id),
    price       REAL    NOT NULL,
    UNIQUE(event_id, category_id)
  );

  CREATE TABLE IF NOT EXISTS show_seats (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id        INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    seat_id         INTEGER NOT NULL REFERENCES seats(id),
    status          TEXT    NOT NULL DEFAULT 'available'
                    CHECK(status IN ('available','held','booked')),
    held_by_user_id INTEGER REFERENCES users(id),
    hold_expires_at TEXT,
    booking_id      INTEGER REFERENCES bookings(id),
    UNIQUE(event_id, seat_id)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id),
    event_id     INTEGER NOT NULL REFERENCES events(id),
    booking_ref  TEXT    NOT NULL UNIQUE,
    status       TEXT    NOT NULL DEFAULT 'confirmed'
                 CHECK(status IN ('confirmed','cancelled')),
    total_amount REAL    NOT NULL,
    qr_code      TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS booking_seats (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id  INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    seat_id     INTEGER NOT NULL REFERENCES seats(id),
    price_paid  REAL    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS waitlist (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id         INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    category_id      INTEGER NOT NULL REFERENCES seat_categories(id),
    user_id          INTEGER NOT NULL REFERENCES users(id),
    position         INTEGER NOT NULL,
    status           TEXT    NOT NULL DEFAULT 'waiting'
                     CHECK(status IN ('waiting','offered','expired','fulfilled')),
    offer_token      TEXT,
    offer_expires_at TEXT,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(event_id, category_id, user_id)
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_show_seats_event    ON show_seats(event_id);
  CREATE INDEX IF NOT EXISTS idx_show_seats_status   ON show_seats(status);
  CREATE INDEX IF NOT EXISTS idx_show_seats_expires  ON show_seats(hold_expires_at);
  CREATE INDEX IF NOT EXISTS idx_bookings_user       ON bookings(user_id);
  CREATE INDEX IF NOT EXISTS idx_waitlist_event_cat  ON waitlist(event_id, category_id, position);
`);

module.exports = db;
