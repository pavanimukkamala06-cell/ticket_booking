const express = require('express');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/events — Browse all events with optional filters
router.get('/', (req, res) => {
  try {
    const { type, date, search } = req.query;
    let query = `
      SELECT e.*, v.name as venue_name, v.address as venue_address,
             u.name as organiser_name,
             COUNT(DISTINCT ss.id) as total_seats,
             SUM(CASE WHEN ss.status = 'available' THEN 1 ELSE 0 END) as available_seats
      FROM events e
      JOIN venues v ON v.id = e.venue_id
      JOIN users u ON u.id = e.organiser_id
      LEFT JOIN show_seats ss ON ss.event_id = e.id
      WHERE 1=1
    `;
    const params = [];
    if (type) { query += ` AND e.type = ?`; params.push(type); }
    if (date) { query += ` AND e.event_date = ?`; params.push(date); }
    if (search) { query += ` AND e.title LIKE ?`; params.push(`%${search}%`); }
    query += ` GROUP BY e.id ORDER BY e.event_date ASC, e.event_time ASC`;

    const events = db.prepare(query).all(...params);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/:id — Get single event details
router.get('/:id', (req, res) => {
  try {
    const event = db.prepare(`
      SELECT e.*, v.name as venue_name, v.address as venue_address,
             u.name as organiser_name
      FROM events e
      JOIN venues v ON v.id = e.venue_id
      JOIN users u ON u.id = e.organiser_id
      WHERE e.id = ?
    `).get(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Get pricing
    const pricing = db.prepare(`
      SELECT ep.*, sc.name as category_name, sc.color
      FROM event_pricing ep
      JOIN seat_categories sc ON sc.id = ep.category_id
      WHERE ep.event_id = ?
    `).all(req.params.id);

    res.json({ ...event, pricing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/:id/seats — Get seat map for an event
router.get('/:id/seats', (req, res) => {
  try {
    const eventId = req.params.id;
    const userId = req.headers.authorization ? (() => {
      try {
        const { verifyToken } = require('../utils/token');
        const token = req.headers.authorization.slice(7);
        return verifyToken(token).id;
      } catch { return null; }
    })() : null;

    const seats = db.prepare(`
      SELECT
        s.id, s.row_label, s.seat_number,
        sc.id as category_id, sc.name as category_name, sc.color,
        ss.id as show_seat_id, ss.status,
        ss.hold_expires_at,
        CASE WHEN ss.held_by_user_id = ? THEN 1 ELSE 0 END as held_by_me
      FROM show_seats ss
      JOIN seats s ON s.id = ss.seat_id
      JOIN seat_categories sc ON sc.id = s.category_id
      WHERE ss.event_id = ?
      ORDER BY s.row_label ASC, s.seat_number ASC
    `).all(userId, eventId);

    // Get pricing map
    const pricing = db.prepare(`
      SELECT ep.category_id, ep.price, sc.name
      FROM event_pricing ep
      JOIN seat_categories sc ON sc.id = ep.category_id
      WHERE ep.event_id = ?
    `).all(eventId);

    const pricingMap = {};
    pricing.forEach(p => { pricingMap[p.category_id] = p.price; });

    // Attach price to each seat
    const seatsWithPrice = seats.map(s => ({
      ...s,
      price: pricingMap[s.category_id] || 0,
    }));

    // Group by row
    const rows = {};
    for (const seat of seatsWithPrice) {
      if (!rows[seat.row_label]) rows[seat.row_label] = [];
      rows[seat.row_label].push(seat);
    }

    res.json({ seats: seatsWithPrice, rows, pricing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/:id/availability — Quick check: is sold out?
router.get('/:id/availability', (req, res) => {
  try {
    const eventId = req.params.id;
    const cats = db.prepare(`
      SELECT sc.id, sc.name, sc.color,
             COUNT(ss.id) as total,
             SUM(CASE WHEN ss.status = 'available' THEN 1 ELSE 0 END) as available
      FROM show_seats ss
      JOIN seats s ON s.id = ss.seat_id
      JOIN seat_categories sc ON sc.id = s.category_id
      WHERE ss.event_id = ?
      GROUP BY sc.id
    `).all(eventId);
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
