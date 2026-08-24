require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./database');

const HOLD_TTL_MINUTES = parseInt(process.env.HOLD_TTL_MINUTES || '10', 10);

console.log('🌱 Seeding database...');

// ─── Clear existing data ───────────────────────────────────────────────────
db.exec(`
  DELETE FROM waitlist;
  DELETE FROM booking_seats;
  DELETE FROM bookings;
  DELETE FROM show_seats;
  DELETE FROM event_pricing;
  DELETE FROM events;
  DELETE FROM seats;
  DELETE FROM seat_categories;
  DELETE FROM venues;
  DELETE FROM users;
`);

// ─── Users ─────────────────────────────────────────────────────────────────
const insertUser = db.prepare(`
  INSERT INTO users (name, email, password_hash, role)
  VALUES (?, ?, ?, ?)
`);

const adminHash    = bcrypt.hashSync('admin123', 10);
const orgHash      = bcrypt.hashSync('organiser123', 10);
const custHash     = bcrypt.hashSync('customer123', 10);

const adminId    = insertUser.run('Admin User',       'admin@ticketflow.com',     adminHash,  'admin').lastInsertRowid;
const org1Id     = insertUser.run('Ravi Kumar',       'ravi@organiser.com',       orgHash,    'organiser').lastInsertRowid;
const org2Id     = insertUser.run('Priya Events',     'priya@organiser.com',      orgHash,    'organiser').lastInsertRowid;
const cust1Id    = insertUser.run('Arjun Sharma',     'arjun@customer.com',       custHash,   'customer').lastInsertRowid;
const cust2Id    = insertUser.run('Meera Nair',       'meera@customer.com',       custHash,   'customer').lastInsertRowid;

console.log('✅ Users seeded');

// ─── Venues ────────────────────────────────────────────────────────────────
const insertVenue = db.prepare(`INSERT INTO venues (name, address, created_by) VALUES (?, ?, ?)`);

const venue1Id = insertVenue.run('Cineplex IMAX', '12 MG Road, Bengaluru, Karnataka', adminId).lastInsertRowid;
const venue2Id = insertVenue.run('Grand Arena',   '5 Palace Grounds, Bengaluru, Karnataka', adminId).lastInsertRowid;
const venue3Id = insertVenue.run('StarPlex',      '88 Whitefield Main Rd, Bengaluru, Karnataka', adminId).lastInsertRowid;

console.log('✅ Venues seeded');

// ─── Seat Categories ───────────────────────────────────────────────────────
const insertCategory = db.prepare(`INSERT INTO seat_categories (venue_id, name, color) VALUES (?, ?, ?)`);

// Cineplex IMAX: Premium + Standard
const v1CatPremium  = insertCategory.run(venue1Id, 'Premium',  '#f59e0b').lastInsertRowid;
const v1CatStandard = insertCategory.run(venue1Id, 'Standard', '#6366f1').lastInsertRowid;

// Grand Arena: VIP + Premium + Standard
const v2CatVip      = insertCategory.run(venue2Id, 'VIP',      '#ec4899').lastInsertRowid;
const v2CatPremium  = insertCategory.run(venue2Id, 'Premium',  '#f59e0b').lastInsertRowid;
const v2CatStandard = insertCategory.run(venue2Id, 'Standard', '#6366f1').lastInsertRowid;

// StarPlex: Premium + Standard
const v3CatPremium  = insertCategory.run(venue3Id, 'Premium',  '#f59e0b').lastInsertRowid;
const v3CatStandard = insertCategory.run(venue3Id, 'Standard', '#6366f1').lastInsertRowid;

console.log('✅ Seat categories seeded');

// ─── Helper: Create seats for a venue ─────────────────────────────────────
function createSeats(venueId, rows) {
  const insertSeat = db.prepare(`
    INSERT OR IGNORE INTO seats (venue_id, category_id, row_label, seat_number)
    VALUES (?, ?, ?, ?)
  `);
  for (const { rowLabel, categoryId, count } of rows) {
    for (let n = 1; n <= count; n++) {
      insertSeat.run(venueId, categoryId, rowLabel, n);
    }
  }
}

// Cineplex IMAX — 6 rows × 10 seats = 60 seats
// Rows A-B: Premium, Rows C-F: Standard
createSeats(venue1Id, [
  { rowLabel: 'A', categoryId: v1CatPremium,  count: 10 },
  { rowLabel: 'B', categoryId: v1CatPremium,  count: 10 },
  { rowLabel: 'C', categoryId: v1CatStandard, count: 10 },
  { rowLabel: 'D', categoryId: v1CatStandard, count: 10 },
  { rowLabel: 'E', categoryId: v1CatStandard, count: 10 },
  { rowLabel: 'F', categoryId: v1CatStandard, count: 10 },
]);

// Grand Arena — 8 rows × 12 seats = 96 seats
// Row A: VIP, Rows B-C: Premium, Rows D-H: Standard
createSeats(venue2Id, [
  { rowLabel: 'A', categoryId: v2CatVip,      count: 12 },
  { rowLabel: 'B', categoryId: v2CatPremium,  count: 12 },
  { rowLabel: 'C', categoryId: v2CatPremium,  count: 12 },
  { rowLabel: 'D', categoryId: v2CatStandard, count: 12 },
  { rowLabel: 'E', categoryId: v2CatStandard, count: 12 },
  { rowLabel: 'F', categoryId: v2CatStandard, count: 12 },
  { rowLabel: 'G', categoryId: v2CatStandard, count: 12 },
  { rowLabel: 'H', categoryId: v2CatStandard, count: 12 },
]);

// StarPlex — 5 rows × 10 seats = 50 seats
// Rows A-B: Premium, Rows C-E: Standard
createSeats(venue3Id, [
  { rowLabel: 'A', categoryId: v3CatPremium,  count: 10 },
  { rowLabel: 'B', categoryId: v3CatPremium,  count: 10 },
  { rowLabel: 'C', categoryId: v3CatStandard, count: 10 },
  { rowLabel: 'D', categoryId: v3CatStandard, count: 10 },
  { rowLabel: 'E', categoryId: v3CatStandard, count: 10 },
]);

console.log('✅ Seats seeded');

// ─── Events ────────────────────────────────────────────────────────────────
const insertEvent = db.prepare(`
  INSERT INTO events (title, type, venue_id, organiser_id, event_date, event_time, description, poster_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const event1Id = insertEvent.run(
  'Inception (Re-Release)',
  'movie',
  venue1Id,
  org1Id,
  '2026-09-10',
  '19:00',
  'Experience Christopher Nolan\'s mind-bending masterpiece in stunning IMAX. A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.',
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80'
).lastInsertRowid;

const event2Id = insertEvent.run(
  'AR Rahman Live Concert',
  'concert',
  venue2Id,
  org2Id,
  '2026-09-20',
  '18:00',
  'An unforgettable evening with the Mozart of Madras — A.R. Rahman performs his greatest hits spanning three decades. Featuring live orchestra, stunning visuals, and special surprise guests.',
  'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=400&q=80'
).lastInsertRowid;

const event3Id = insertEvent.run(
  'Dune: Part Three',
  'movie',
  venue3Id,
  org1Id,
  '2026-10-05',
  '21:00',
  'The epic conclusion of Denis Villeneuve\'s Dune saga. Paul Atreides leads the Fremen armies in the final battle for the future of the universe. The sands of Arrakis will run red.',
  'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=400&q=80'
).lastInsertRowid;

console.log('✅ Events seeded');

// ─── Event Pricing ─────────────────────────────────────────────────────────
const insertPricing = db.prepare(`
  INSERT INTO event_pricing (event_id, category_id, price) VALUES (?, ?, ?)
`);

// Inception: Premium ₹500, Standard ₹300
insertPricing.run(event1Id, v1CatPremium,  500);
insertPricing.run(event1Id, v1CatStandard, 300);

// AR Rahman Concert: VIP ₹3000, Premium ₹2000, Standard ₹1000
insertPricing.run(event2Id, v2CatVip,      3000);
insertPricing.run(event2Id, v2CatPremium,  2000);
insertPricing.run(event2Id, v2CatStandard, 1000);

// Dune: Premium ₹450, Standard ₹280
insertPricing.run(event3Id, v3CatPremium,  450);
insertPricing.run(event3Id, v3CatStandard, 280);

console.log('✅ Event pricing seeded');

// ─── Show Seats (one entry per event per seat) ─────────────────────────────
const insertShowSeat = db.prepare(`
  INSERT OR IGNORE INTO show_seats (event_id, seat_id, status)
  VALUES (?, ?, 'available')
`);

function createShowSeats(eventId, venueId) {
  const seats = db.prepare(`SELECT id FROM seats WHERE venue_id = ?`).all(venueId);
  const insertMany = db.transaction(() => {
    for (const seat of seats) {
      insertShowSeat.run(eventId, seat.id);
    }
  });
  insertMany();
}

createShowSeats(event1Id, venue1Id);
createShowSeats(event2Id, venue2Id);
createShowSeats(event3Id, venue3Id);

console.log('✅ Show seats seeded');
console.log('\n🎉 Database seeded successfully!');
console.log('\n📋 Test Accounts:');
console.log('   Admin:     admin@ticketflow.com    / admin123');
console.log('   Organiser: ravi@organiser.com      / organiser123');
console.log('   Customer:  arjun@customer.com      / customer123');
console.log('\n🎬 Events:');
console.log(`   1. Inception (Re-Release)  — ID: ${event1Id}`);
console.log(`   2. AR Rahman Live Concert  — ID: ${event2Id}`);
console.log(`   3. Dune: Part Three        — ID: ${event3Id}`);
