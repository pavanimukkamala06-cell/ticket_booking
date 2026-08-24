const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const { generateQRCode } = require('../utils/qrcode');
const { sendBookingConfirmation } = require('../utils/email');
const { processWaitlist } = require('../scheduler');

const router = express.Router();

const HOLD_TTL_MINUTES = parseInt(process.env.HOLD_TTL_MINUTES || '10', 10);

// ─── POST /api/bookings/hold — Hold selected seats (concurrency-safe) ──────
router.post('/hold', authenticate, requireRole('customer'), (req, res) => {
  const { event_id, seat_ids } = req.body;
  if (!event_id || !Array.isArray(seat_ids) || seat_ids.length === 0) {
    return res.status(400).json({ error: 'event_id and seat_ids[] required' });
  }

  const userId = req.user.id;
  const holdExpiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000).toISOString();

  try {
    // Use BEGIN IMMEDIATE transaction for write-lock concurrency protection
    const holdTransaction = db.transaction(() => {
      // First, release any existing holds by this user for this event
      db.prepare(`
        UPDATE show_seats
        SET status = 'available', held_by_user_id = NULL, hold_expires_at = NULL
        WHERE event_id = ? AND held_by_user_id = ? AND status = 'held'
      `).run(event_id, userId);

      // Check all requested seats are available
      const placeholders = seat_ids.map(() => '?').join(',');
      const seats = db.prepare(`
        SELECT ss.*, s.row_label, s.seat_number, sc.name as category_name
        FROM show_seats ss
        JOIN seats s ON s.id = ss.seat_id
        JOIN seat_categories sc ON sc.id = s.category_id
        WHERE ss.event_id = ? AND ss.seat_id IN (${placeholders})
      `).all(event_id, ...seat_ids);

      if (seats.length !== seat_ids.length) {
        throw new Error('One or more seat IDs not found for this event');
      }

      const unavailable = seats.filter(s => s.status !== 'available');
      if (unavailable.length > 0) {
        const info = unavailable.map(s => `Row ${s.row_label} Seat ${s.seat_number} (${s.status})`).join(', ');
        throw new Error(`Seats not available: ${info}`);
      }

      // Place hold on all seats
      const holdStmt = db.prepare(`
        UPDATE show_seats
        SET status = 'held', held_by_user_id = ?, hold_expires_at = ?
        WHERE event_id = ? AND seat_id = ? AND status = 'available'
      `);
      for (const seatId of seat_ids) {
        const result = holdStmt.run(userId, holdExpiresAt, event_id, seatId);
        if (result.changes === 0) {
          throw new Error(`Seat ${seatId} was just taken by another user`);
        }
      }

      return seats;
    });

    // SQLite requires pragma to use IMMEDIATE — wrap in deferred
    db.pragma('wal_checkpoint(PASSIVE)');
    const seats = holdTransaction();

    res.json({
      success: true,
      hold_expires_at: holdExpiresAt,
      held_seats: seats.map(s => ({
        seat_id: s.seat_id,
        row_label: s.row_label,
        seat_number: s.seat_number,
        category: s.category_name,
      })),
    });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

// ─── POST /api/bookings/confirm — Confirm a booking ───────────────────────
router.post('/confirm', authenticate, requireRole('customer'), async (req, res) => {
  const { event_id, seat_ids } = req.body;
  if (!event_id || !Array.isArray(seat_ids) || seat_ids.length === 0) {
    return res.status(400).json({ error: 'event_id and seat_ids[] required' });
  }

  const userId = req.user.id;
  const bookingRef = `TF-${uuidv4().slice(0, 8).toUpperCase()}`;

  try {
    const bookingData = db.transaction(() => {
      // Verify all seats are held by this user
      const placeholders = seat_ids.map(() => '?').join(',');
      const seats = db.prepare(`
        SELECT ss.*, s.row_label, s.seat_number, s.category_id,
               sc.name as category_name, ep.price
        FROM show_seats ss
        JOIN seats s ON s.id = ss.seat_id
        JOIN seat_categories sc ON sc.id = s.category_id
        JOIN event_pricing ep ON ep.event_id = ss.event_id AND ep.category_id = s.category_id
        WHERE ss.event_id = ? AND ss.seat_id IN (${placeholders})
      `).all(event_id, ...seat_ids);

      if (seats.length !== seat_ids.length) {
        throw new Error('Seat data mismatch');
      }

      const notHeld = seats.filter(s => s.status !== 'held' || s.held_by_user_id !== userId);
      if (notHeld.length > 0) {
        throw new Error('Some seats are no longer held by you. Please restart your selection.');
      }

      // Check hold not expired
      const now = new Date().toISOString();
      const expired = seats.filter(s => s.hold_expires_at < now);
      if (expired.length > 0) {
        throw new Error('Your seat hold has expired. Please select seats again.');
      }

      const totalAmount = seats.reduce((sum, s) => sum + s.price, 0);

      // Create booking
      const bookingId = db.prepare(`
        INSERT INTO bookings (user_id, event_id, booking_ref, total_amount)
        VALUES (?, ?, ?, ?)
      `).run(userId, event_id, bookingRef, totalAmount).lastInsertRowid;

      // Create booking_seats
      const insertBS = db.prepare(`
        INSERT INTO booking_seats (booking_id, seat_id, price_paid) VALUES (?, ?, ?)
      `);
      for (const seat of seats) {
        insertBS.run(bookingId, seat.seat_id, seat.price);
      }

      // Update show_seats to booked
      db.prepare(`
        UPDATE show_seats
        SET status = 'booked', held_by_user_id = NULL, hold_expires_at = NULL, booking_id = ?
        WHERE event_id = ? AND seat_id IN (${placeholders})
      `).run(bookingId, event_id, ...seat_ids);

      return { bookingId, totalAmount, seats };
    })();

    // Generate QR code
    const qrDataUrl = await generateQRCode(bookingRef);

    // Save QR code to booking
    db.prepare('UPDATE bookings SET qr_code = ? WHERE id = ?').run(qrDataUrl, bookingData.bookingId);

    // Get event + user details for email
    const event = db.prepare(`
      SELECT e.title, e.event_date, e.event_time, v.name as venue_name
      FROM events e JOIN venues v ON v.id = e.venue_id WHERE e.id = ?
    `).get(event_id);
    const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(userId);

    // Send confirmation email (non-blocking)
    sendBookingConfirmation({
      to: user.email,
      name: user.name,
      bookingRef,
      eventTitle: event.title,
      eventDate: event.event_date,
      eventTime: event.event_time,
      seats: bookingData.seats.map(s => ({
        row_label: s.row_label,
        seat_number: s.seat_number,
        category: s.category_name,
      })),
      totalAmount: bookingData.totalAmount,
      qrCodeDataUrl: qrDataUrl,
    }).catch(err => console.error('[Email] Failed to send booking confirmation:', err.message));

    res.json({
      success: true,
      booking_ref: bookingRef,
      booking_id: bookingData.bookingId,
      total_amount: bookingData.totalAmount,
      qr_code: qrDataUrl,
    });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

// ─── POST /api/bookings/:id/cancel — Cancel a booking ────────────────────
router.post('/:id/cancel', authenticate, requireRole('customer'), async (req, res) => {
  const bookingId = req.params.id;
  const userId = req.user.id;

  try {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').get(bookingId, userId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    const releasedCategories = db.transaction(() => {
      // Get seats for this booking
      const bookedSeats = db.prepare(`
        SELECT bs.seat_id, s.category_id
        FROM booking_seats bs
        JOIN seats s ON s.id = bs.seat_id
        WHERE bs.booking_id = ?
      `).all(bookingId);

      // Release seats
      db.prepare(`
        UPDATE show_seats
        SET status = 'available', booking_id = NULL, held_by_user_id = NULL, hold_expires_at = NULL
        WHERE booking_id = ?
      `).run(bookingId);

      // Mark booking cancelled
      db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('cancelled', bookingId);

      return [...new Set(bookedSeats.map(s => `${booking.event_id}:${s.category_id}`))];
    })();

    // Trigger waitlist for affected categories
    for (const key of releasedCategories) {
      const [eventId, categoryId] = key.split(':').map(Number);
      processWaitlist(eventId, categoryId).catch(err =>
        console.error('[Waitlist] processWaitlist error:', err.message)
      );
    }

    res.json({ success: true, message: 'Booking cancelled successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/bookings/my — Customer's booking history ───────────────────
router.get('/my', authenticate, requireRole('customer'), (req, res) => {
  try {
    const bookings = db.prepare(`
      SELECT b.*,
             e.title as event_title, e.event_date, e.event_time, e.type as event_type,
             v.name as venue_name
      FROM bookings b
      JOIN events e ON e.id = b.event_id
      JOIN venues v ON v.id = e.venue_id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `).all(req.user.id);

    const detailed = bookings.map(b => {
      const seats = db.prepare(`
        SELECT bs.price_paid, s.row_label, s.seat_number, sc.name as category_name, sc.color
        FROM booking_seats bs
        JOIN seats s ON s.id = bs.seat_id
        JOIN seat_categories sc ON sc.id = s.category_id
        WHERE bs.booking_id = ?
      `).all(b.id);
      return { ...b, seats };
    });

    res.json(detailed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/bookings/:id — Get booking detail ───────────────────────────
router.get('/:id', authenticate, (req, res) => {
  try {
    const booking = db.prepare(`
      SELECT b.*,
             e.title as event_title, e.event_date, e.event_time,
             v.name as venue_name, v.address as venue_address
      FROM bookings b
      JOIN events e ON e.id = b.event_id
      JOIN venues v ON v.id = e.venue_id
      WHERE b.id = ?
    `).get(req.params.id);

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const seats = db.prepare(`
      SELECT bs.price_paid, s.row_label, s.seat_number, sc.name as category_name, sc.color
      FROM booking_seats bs
      JOIN seats s ON s.id = bs.seat_id
      JOIN seat_categories sc ON sc.id = s.category_id
      WHERE bs.booking_id = ?
    `).all(booking.id);

    res.json({ ...booking, seats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
