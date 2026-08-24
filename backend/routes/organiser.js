const express = require('express');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/organiser/events — Create a new event
router.post('/events', authenticate, requireRole('organiser', 'admin'), (req, res) => {
  try {
    const { title, type, venue_id, event_date, event_time, description, poster_url, pricing } = req.body;
    if (!title || !type || !venue_id || !event_date || !event_time) {
      return res.status(400).json({ error: 'title, type, venue_id, event_date, event_time required' });
    }
    if (!['movie', 'concert'].includes(type)) {
      return res.status(400).json({ error: 'type must be movie or concert' });
    }

    const result = db.transaction(() => {
      const eventId = db.prepare(`
        INSERT INTO events (title, type, venue_id, organiser_id, event_date, event_time, description, poster_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(title, type, venue_id, req.user.id, event_date, event_time, description || '', poster_url || '').lastInsertRowid;

      // Insert pricing if provided
      if (pricing && Array.isArray(pricing)) {
        const insertPricing = db.prepare(`
          INSERT OR REPLACE INTO event_pricing (event_id, category_id, price) VALUES (?, ?, ?)
        `);
        for (const p of pricing) {
          insertPricing.run(eventId, p.category_id, p.price);
        }
      }

      // Create show_seats for all seats in the venue
      const seats = db.prepare('SELECT id FROM seats WHERE venue_id = ?').all(venue_id);
      const insertSS = db.prepare(`
        INSERT OR IGNORE INTO show_seats (event_id, seat_id, status) VALUES (?, ?, 'available')
      `);
      for (const seat of seats) {
        insertSS.run(eventId, seat.id);
      }

      return eventId;
    })();

    res.status(201).json({ success: true, event_id: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/organiser/events — List organiser's events
router.get('/events', authenticate, requireRole('organiser', 'admin'), (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? `SELECT e.*, v.name as venue_name, u.name as organiser_name FROM events e JOIN venues v ON v.id = e.venue_id JOIN users u ON u.id = e.organiser_id ORDER BY e.created_at DESC`
      : `SELECT e.*, v.name as venue_name FROM events e JOIN venues v ON v.id = e.venue_id WHERE e.organiser_id = ? ORDER BY e.created_at DESC`;

    const events = req.user.role === 'admin'
      ? db.prepare(query).all()
      : db.prepare(query).all(req.user.id);

    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/organiser/events/:id/summary — Revenue + booking summary
router.get('/events/:id/summary', authenticate, requireRole('organiser', 'admin'), (req, res) => {
  try {
    const eventId = req.params.id;
    const event = db.prepare(`
      SELECT e.*, v.name as venue_name FROM events e JOIN venues v ON v.id = e.venue_id WHERE e.id = ?
    `).get(eventId);

    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (req.user.role === 'organiser' && event.organiser_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Revenue by category
    const revenueByCategory = db.prepare(`
      SELECT sc.name as category, sc.color, COUNT(bs.id) as tickets_sold,
             SUM(bs.price_paid) as revenue
      FROM booking_seats bs
      JOIN bookings b ON b.id = bs.booking_id
      JOIN seats s ON s.id = bs.seat_id
      JOIN seat_categories sc ON sc.id = s.category_id
      WHERE b.event_id = ? AND b.status = 'confirmed'
      GROUP BY sc.id
    `).all(eventId);

    // Seat status summary
    const seatSummary = db.prepare(`
      SELECT ss.status, COUNT(*) as count
      FROM show_seats ss WHERE ss.event_id = ? GROUP BY ss.status
    `).all(eventId);

    // Recent bookings
    const recentBookings = db.prepare(`
      SELECT b.booking_ref, b.total_amount, b.created_at, b.status,
             u.name as customer_name, u.email as customer_email,
             COUNT(bs.id) as seat_count
      FROM bookings b
      JOIN users u ON u.id = b.user_id
      JOIN booking_seats bs ON bs.booking_id = b.id
      WHERE b.event_id = ?
      GROUP BY b.id
      ORDER BY b.created_at DESC
      LIMIT 20
    `).all(eventId);

    const totalRevenue = revenueByCategory.reduce((sum, c) => sum + (c.revenue || 0), 0);
    const totalTickets = revenueByCategory.reduce((sum, c) => sum + c.tickets_sold, 0);

    // Waitlist count
    const waitlistCount = db.prepare(`
      SELECT COUNT(*) as cnt FROM waitlist WHERE event_id = ? AND status = 'waiting'
    `).get(eventId).cnt;

    res.json({
      event,
      total_revenue: totalRevenue,
      total_tickets_sold: totalTickets,
      waitlist_count: waitlistCount,
      revenue_by_category: revenueByCategory,
      seat_summary: seatSummary,
      recent_bookings: recentBookings,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
