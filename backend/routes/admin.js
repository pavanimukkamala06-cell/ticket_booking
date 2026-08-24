const express = require('express');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// ─── Venues ────────────────────────────────────────────────────────────────

// GET /api/admin/venues
router.get('/venues', authenticate, requireRole('admin', 'organiser'), (req, res) => {
  try {
    const venues = db.prepare(`
      SELECT v.*, u.name as created_by_name,
             COUNT(DISTINCT s.id) as seat_count
      FROM venues v
      LEFT JOIN users u ON u.id = v.created_by
      LEFT JOIN seats s ON s.venue_id = v.id
      GROUP BY v.id
      ORDER BY v.created_at DESC
    `).all();
    res.json(venues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/venues
router.post('/venues', authenticate, requireRole('admin'), (req, res) => {
  try {
    const { name, address } = req.body;
    if (!name || !address) return res.status(400).json({ error: 'name and address required' });
    const id = db.prepare('INSERT INTO venues (name, address, created_by) VALUES (?, ?, ?)')
      .run(name, address, req.user.id).lastInsertRowid;
    res.status(201).json({ success: true, venue_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/venues/:id/categories
router.get('/venues/:id/categories', authenticate, requireRole('admin', 'organiser'), (req, res) => {
  try {
    const cats = db.prepare(`
      SELECT sc.*, COUNT(s.id) as seat_count
      FROM seat_categories sc
      LEFT JOIN seats s ON s.category_id = sc.id
      WHERE sc.venue_id = ?
      GROUP BY sc.id
    `).all(req.params.id);
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/venues/:id/categories
router.post('/venues/:id/categories', authenticate, requireRole('admin'), (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = db.prepare('INSERT INTO seat_categories (venue_id, name, color) VALUES (?, ?, ?)')
      .run(req.params.id, name, color || '#6366f1').lastInsertRowid;
    res.status(201).json({ success: true, category_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/venues/:id/seats — Bulk add seats
router.post('/venues/:id/seats', authenticate, requireRole('admin'), (req, res) => {
  try {
    const { rows } = req.body; // [{ row_label, category_id, count }]
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows[] required' });

    const insertSeat = db.prepare(`
      INSERT OR IGNORE INTO seats (venue_id, category_id, row_label, seat_number)
      VALUES (?, ?, ?, ?)
    `);

    let total = 0;
    db.transaction(() => {
      for (const { row_label, category_id, count } of rows) {
        for (let n = 1; n <= count; n++) {
          insertSeat.run(req.params.id, category_id, row_label, n);
          total++;
        }
      }
    })();

    res.status(201).json({ success: true, seats_created: total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Users ─────────────────────────────────────────────────────────────────

// GET /api/admin/users
router.get('/users', authenticate, requireRole('admin'), (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC
    `).all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Dashboard Stats ───────────────────────────────────────────────────────

// GET /api/admin/stats
router.get('/stats', authenticate, requireRole('admin'), (req, res) => {
  try {
    const totalUsers    = db.prepare(`SELECT COUNT(*) as cnt FROM users`).get().cnt;
    const totalEvents   = db.prepare(`SELECT COUNT(*) as cnt FROM events`).get().cnt;
    const totalBookings = db.prepare(`SELECT COUNT(*) as cnt FROM bookings WHERE status = 'confirmed'`).get().cnt;
    const totalRevenue  = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as rev FROM bookings WHERE status = 'confirmed'`).get().rev;
    const totalWaiting  = db.prepare(`SELECT COUNT(*) as cnt FROM waitlist WHERE status = 'waiting'`).get().cnt;

    res.json({ totalUsers, totalEvents, totalBookings, totalRevenue, totalWaiting });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
