const cron = require('node-cron');
const db = require('./database');
const { signOfferToken } = require('./utils/token');
const { sendWaitlistOffer } = require('./utils/email');

const OFFER_DURATION_MINUTES = parseInt(process.env.OFFER_DURATION_MINUTES || '15', 10);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Release expired seat holds and trigger waitlist processing
 */
function releaseExpiredHolds() {
  const now = new Date().toISOString();

  // Find held seats that have expired
  const expiredSeats = db.prepare(`
    SELECT ss.*, s.category_id, s.venue_id
    FROM show_seats ss
    JOIN seats s ON s.id = ss.seat_id
    WHERE ss.status = 'held' AND ss.hold_expires_at < ?
  `).all(now);

  if (expiredSeats.length === 0) return;

  console.log(`[Scheduler] Releasing ${expiredSeats.length} expired seat hold(s)...`);

  const releaseStmt = db.prepare(`
    UPDATE show_seats
    SET status = 'available', held_by_user_id = NULL, hold_expires_at = NULL
    WHERE id = ? AND status = 'held' AND hold_expires_at < ?
  `);

  const releasedEventCategories = new Set();

  for (const seat of expiredSeats) {
    const changes = releaseStmt.run(seat.id, now);
    if (changes.changes > 0) {
      releasedEventCategories.add(`${seat.event_id}:${seat.category_id}`);
    }
  }

  // For each released event+category, check waitlist
  for (const key of releasedEventCategories) {
    const [eventId, categoryId] = key.split(':').map(Number);
    processWaitlist(eventId, categoryId);
  }
}

/**
 * Process waitlist for a specific event + category after a seat becomes available
 */
async function processWaitlist(eventId, categoryId) {
  // Find the next waiting entry
  const entry = db.prepare(`
    SELECT w.*, u.email, u.name
    FROM waitlist w
    JOIN users u ON u.id = w.user_id
    WHERE w.event_id = ? AND w.category_id = ? AND w.status = 'waiting'
    ORDER BY w.position ASC
    LIMIT 1
  `).get(eventId, categoryId);

  if (!entry) return;

  // Check if there's actually an available seat in that category
  const availableSeat = db.prepare(`
    SELECT ss.id
    FROM show_seats ss
    JOIN seats s ON s.id = ss.seat_id
    WHERE ss.event_id = ? AND s.category_id = ? AND ss.status = 'available'
    LIMIT 1
  `).get(eventId, categoryId);

  if (!availableSeat) return;

  // Generate offer token
  const offerExpiresAt = new Date(Date.now() + OFFER_DURATION_MINUTES * 60 * 1000).toISOString();
  const offerToken = signOfferToken({
    waitlistId: entry.id,
    eventId,
    categoryId,
    userId: entry.user_id,
  }, `${OFFER_DURATION_MINUTES}m`);

  // Update waitlist entry
  db.prepare(`
    UPDATE waitlist
    SET status = 'offered', offer_token = ?, offer_expires_at = ?
    WHERE id = ?
  `).run(offerToken, offerExpiresAt, entry.id);

  const offerLink = `${FRONTEND_URL}/#/waitlist-offer?token=${offerToken}`;

  // Get event and category info for email
  const event = db.prepare(`SELECT title FROM events WHERE id = ?`).get(eventId);
  const category = db.prepare(`SELECT name FROM seat_categories WHERE id = ?`).get(categoryId);

  try {
    await sendWaitlistOffer({
      to: entry.email,
      name: entry.name,
      eventTitle: event.title,
      categoryName: category.name,
      offerLink,
      expiresInMinutes: OFFER_DURATION_MINUTES,
    });
    console.log(`[Scheduler] Sent waitlist offer to ${entry.email} for event ${eventId}`);
  } catch (err) {
    console.error(`[Scheduler] Failed to send waitlist offer email:`, err.message);
  }
}

/**
 * Expire waitlist offers that timed out and move to next in queue
 */
async function expireTimedOutOffers() {
  const now = new Date().toISOString();

  const timedOutOffers = db.prepare(`
    SELECT * FROM waitlist
    WHERE status = 'offered' AND offer_expires_at < ?
  `).all(now);

  for (const entry of timedOutOffers) {
    // Mark as expired
    db.prepare(`UPDATE waitlist SET status = 'expired' WHERE id = ?`).run(entry.id);
    console.log(`[Scheduler] Waitlist offer expired for entry ${entry.id}`);

    // Process next in queue
    await processWaitlist(entry.event_id, entry.category_id);
  }
}

/**
 * Start all scheduled jobs
 */
function startScheduler() {
  console.log('[Scheduler] Starting seat hold TTL scheduler (every 30s)...');

  // Every 30 seconds: release expired holds + expire timed-out offers
  cron.schedule('*/30 * * * * *', async () => {
    try {
      releaseExpiredHolds();
      await expireTimedOutOffers();
    } catch (err) {
      console.error('[Scheduler] Error:', err.message);
    }
  });
}

module.exports = { startScheduler, processWaitlist };
