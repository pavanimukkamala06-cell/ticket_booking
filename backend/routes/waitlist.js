const express = require('express');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const { verifyOfferToken } = require('../utils/token');

const router = express.Router();

// POST /api/waitlist/join — Join waitlist for a category
router.post('/join', authenticate, requireRole('customer'), (req, res) => {
  try {
    const { event_id, category_id } = req.body;
    if (!event_id || !category_id) {
      return res.status(400).json({ error: 'event_id and category_id required' });
    }

    const userId = req.user.id;

    // Check if already on waitlist
    const existing = db.prepare(`
      SELECT id, status FROM waitlist
      WHERE event_id = ? AND category_id = ? AND user_id = ?
    `).get(event_id, category_id, userId);

    if (existing) {
      if (['waiting', 'offered'].includes(existing.status)) {
        return res.status(409).json({ error: 'Already on the waitlist for this category' });
      }
      // Re-join if previously expired/fulfilled
      db.prepare(`
        UPDATE waitlist SET status = 'waiting', offer_token = NULL, offer_expires_at = NULL
        WHERE id = ?
      `).run(existing.id);

      // Recalculate position
      const count = db.prepare(`
        SELECT COUNT(*) as cnt FROM waitlist
        WHERE event_id = ? AND category_id = ? AND status = 'waiting' AND id != ?
      `).get(event_id, category_id, existing.id).cnt;

      db.prepare('UPDATE waitlist SET position = ? WHERE id = ?').run(count + 1, existing.id);
      return res.json({ success: true, position: count + 1, message: 'Re-joined waitlist' });
    }

    // Get next position
    const maxPos = db.prepare(`
      SELECT MAX(position) as max_pos FROM waitlist
      WHERE event_id = ? AND category_id = ? AND status IN ('waiting', 'offered')
    `).get(event_id, category_id).max_pos || 0;

    db.prepare(`
      INSERT INTO waitlist (event_id, category_id, user_id, position)
      VALUES (?, ?, ?, ?)
    `).run(event_id, category_id, userId, maxPos + 1);

    res.json({ success: true, position: maxPos + 1, message: 'Added to waitlist' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/waitlist/my — Get user's waitlist entries
router.get('/my', authenticate, requireRole('customer'), (req, res) => {
  try {
    const entries = db.prepare(`
      SELECT w.*, e.title as event_title, e.event_date, e.event_time,
             sc.name as category_name, sc.color
      FROM waitlist w
      JOIN events e ON e.id = w.event_id
      JOIN seat_categories sc ON sc.id = w.category_id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
    `).all(req.user.id);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/waitlist/offer — Validate an offer token (for offer acceptance page)
router.get('/offer', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });

  try {
    const payload = verifyOfferToken(token);
    const entry = db.prepare(`
      SELECT w.*, e.title as event_title, e.event_date, e.event_time,
             sc.name as category_name, ep.price,
             u.name as user_name, u.email
      FROM waitlist w
      JOIN events e ON e.id = w.event_id
      JOIN seat_categories sc ON sc.id = w.category_id
      JOIN event_pricing ep ON ep.event_id = w.event_id AND ep.category_id = w.category_id
      JOIN users u ON u.id = w.user_id
      WHERE w.id = ? AND w.offer_token = ?
    `).get(payload.waitlistId, token);

    if (!entry) return res.status(404).json({ error: 'Offer not found or already used' });
    if (entry.status !== 'offered') return res.status(410).json({ error: 'Offer is no longer valid' });

    const now = new Date().toISOString();
    if (entry.offer_expires_at < now) {
      db.prepare('UPDATE waitlist SET status = ? WHERE id = ?').run('expired', entry.id);
      return res.status(410).json({ error: 'Offer has expired' });
    }

    res.json({
      valid: true,
      event_title: entry.event_title,
      event_date: entry.event_date,
      event_time: entry.event_time,
      category_name: entry.category_name,
      price: entry.price,
      offer_expires_at: entry.offer_expires_at,
      user_name: entry.user_name,
      event_id: entry.event_id,
      category_id: entry.category_id,
      user_id: entry.user_id,
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(410).json({ error: 'Offer has expired' });
    }
    return res.status(400).json({ error: 'Invalid offer token' });
  }
});

// POST /api/waitlist/offer/accept — Accept a waitlist offer (gets a login token)
router.post('/offer/accept', authenticate, requireRole('customer'), (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });

  try {
    const payload = verifyOfferToken(token);
    const entry = db.prepare(
      'SELECT * FROM waitlist WHERE id = ? AND offer_token = ? AND status = ?'
    ).get(payload.waitlistId, token, 'offered');

    if (!entry) return res.status(404).json({ error: 'Offer not found' });

    const now = new Date().toISOString();
    if (entry.offer_expires_at < now) {
      db.prepare('UPDATE waitlist SET status = ? WHERE id = ?').run('expired', entry.id);
      return res.status(410).json({ error: 'Offer has expired' });
    }

    if (entry.user_id !== req.user.id) {
      return res.status(403).json({ error: 'This offer is for a different account' });
    }

    // Mark as fulfilled (booking will proceed via normal hold+confirm flow)
    db.prepare('UPDATE waitlist SET status = ? WHERE id = ?').run('fulfilled', entry.id);

    res.json({
      success: true,
      event_id: entry.event_id,
      category_id: entry.category_id,
      message: 'Offer accepted. Please select a seat to complete booking.',
    });
  } catch (err) {
    res.status(400).json({ error: 'Invalid or expired token' });
  }
});

// GET /api/waitlist/:event_id — Get waitlist info for an event (organiser/admin)
router.get('/:event_id', authenticate, requireRole('organiser', 'admin'), (req, res) => {
  try {
    const entries = db.prepare(`
      SELECT w.*, u.name as user_name, u.email, sc.name as category_name
      FROM waitlist w
      JOIN users u ON u.id = w.user_id
      JOIN seat_categories sc ON sc.id = w.category_id
      WHERE w.event_id = ?
      ORDER BY w.category_id, w.position ASC
    `).all(req.params.event_id);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
