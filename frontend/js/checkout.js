/* ═══════════════════════════════════════════════════════════════
   TicketFlow — Checkout & Booking Confirmation
   ═══════════════════════════════════════════════════════════════ */

register('/checkout/:id', async ({ id }) => {
  if (!Auth.isLoggedIn() || !Auth.isRole('customer')) {
    navigate('/login'); return;
  }

  // Parse seat ids from query string
  const hash = location.hash;
  const seatParam = (hash.split('?seats=')[1] || '').split('&')[0];
  const seatIds = seatParam ? seatParam.split(',').map(Number).filter(Boolean) : [];

  if (seatIds.length === 0) {
    navigate(`/events/${id}/seats`); return;
  }

  const app = document.getElementById('app');
  app.innerHTML = `<div class="loading-screen"><div class="loading-logo">🎟️</div><div class="loading-text">Loading checkout…</div></div>`;

  try {
    const event = await get(`/events/${id}`);
    const seatData = await get(`/events/${id}/seats`);
    const allSeats = seatData && seatData.seats ? seatData.seats : [];

    // Get selected seat details — match by seat id
    const selectedSeats = allSeats.filter(s => seatIds.includes(s.id));

    // If no seat details matched, use pricing to estimate
    if (selectedSeats.length === 0 && seatIds.length > 0) {
      // fallback: show minimal info without per-seat pricing
      throw new Error('Could not load seat details. Please go back and re-select your seats.');
    }

    const totalAmount = selectedSeats.reduce((sum, s) => sum + (s.price || 0), 0);

    // Find hold expiry — check held_by_me seats (SQLite returns 1 for true)
    const heldSeat = allSeats.find(s => (s.held_by_me === 1 || s.held_by_me === true) && seatIds.includes(s.id));
    const holdExpiry = heldSeat?.hold_expires_at ? new Date(heldSeat.hold_expires_at) : null;

    let timerInterval;

    function startTimer() {
      if (!holdExpiry) return;
      timerInterval = setInterval(() => {
        const remaining = holdExpiry - Date.now();
        const el = document.getElementById('hold-timer-display');
        if (!el) { clearInterval(timerInterval); return; }
        if (remaining <= 0) {
          clearInterval(timerInterval);
          el.textContent = '⏰ Hold expired!';
          el.closest('.hold-timer').classList.add('urgent');
          toast('error', 'Hold Expired', 'Your seat hold has expired. Please select again.');
          setTimeout(() => navigate(`/events/${id}/seats`), 3000);
          return;
        }
        const m = Math.floor(remaining / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        el.textContent = `⏳ ${m}:${String(s).padStart(2, '0')} remaining`;
        if (remaining < 120000) el.closest('.hold-timer')?.classList.add('urgent');
      }, 1000);
    }

    app.innerHTML = `
      <div class="page-enter">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px;flex-wrap:wrap;justify-content:space-between;">
          <div>
            <button onclick="navigate('/events/${id}/seats')" class="btn btn-secondary btn-sm" style="margin-bottom:8px;">← Change Seats</button>
            <h1 style="font-family:var(--font-display);font-size:28px;font-weight:800;">Checkout</h1>
          </div>
          ${holdExpiry ? `<div class="hold-timer"><span id="hold-timer-display">⏳ Loading…</span></div>` : ''}
        </div>

        <div class="checkout-layout">
          <!-- Left: Booking Summary -->
          <div>
            <div class="checkout-card">
              <h2>📋 Booking Summary</h2>

              <!-- Event Info -->
              <div style="display:flex;gap:16px;padding:16px;background:var(--bg-secondary);border-radius:var(--radius-md);margin-bottom:24px;">
                <div style="font-size:40px;">${event.type === 'movie' ? '🎬' : '🎵'}</div>
                <div>
                  <div style="font-weight:700;font-size:16px;margin-bottom:4px;">${escHtml(event.title)}</div>
                  <div style="color:var(--text-muted);font-size:13px;">📅 ${fmtDate(event.event_date)} · 🕐 ${fmtTime(event.event_time)}</div>
                  <div style="color:var(--text-muted);font-size:13px;">📍 ${escHtml(event.venue_name)}</div>
                </div>
              </div>

              <!-- Seat Details -->
              <div class="form-label" style="margin-bottom:12px;">Selected Seats</div>
              ${selectedSeats.map(s => `
                <div class="order-summary-item">
                  <span style="display:flex;align-items:center;gap:8px;">
                    <span style="width:8px;height:8px;border-radius:50%;background:${s.color};flex-shrink:0;"></span>
                    Row ${escHtml(s.row_label)} Seat ${s.seat_number} — ${escHtml(s.category_name)}
                  </span>
                  <span style="font-weight:600;">${fmt(s.price)}</span>
                </div>`).join('')}

              <div class="order-total">
                <span>Total Amount</span>
                <span>${fmt(totalAmount)}</span>
              </div>
            </div>

            <!-- Customer Details -->
            <div class="checkout-card mt-4">
              <h2>👤 Your Details</h2>
              <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:16px;">
                <div style="font-weight:600;margin-bottom:4px;">${escHtml(Auth.user.name)}</div>
                <div style="color:var(--text-muted);font-size:14px;">${escHtml(Auth.user.email)}</div>
              </div>
              <p style="color:var(--text-muted);font-size:13px;margin-top:12px;">
                📧 A booking confirmation with your QR code will be sent to your email address.
              </p>
            </div>
          </div>

          <!-- Right: Payment -->
          <div>
            <div class="checkout-card" style="position:sticky;top:80px;">
              <h2>💳 Payment</h2>
              <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:20px;margin-bottom:20px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;">
                  <span style="color:var(--text-muted);">${selectedSeats.length} × Ticket${selectedSeats.length > 1 ? 's' : ''}</span>
                  <span>${fmt(totalAmount)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:14px;">
                  <span style="color:var(--text-muted);">Booking fee</span>
                  <span style="color:var(--accent-green);">FREE</span>
                </div>
                <div style="height:1px;background:var(--border-subtle);margin:12px 0;"></div>
                <div style="display:flex;justify-content:space-between;font-size:20px;font-weight:800;">
                  <span>Total</span>
                  <span style="color:var(--accent-green);">${fmt(totalAmount)}</span>
                </div>
              </div>


              <button id="confirm-btn" class="btn btn-success btn-full btn-lg" onclick="confirmBooking(${id})">
                ✅ Confirm Booking — ${fmt(totalAmount)}
              </button>
              <p style="color:var(--text-muted);font-size:12px;text-align:center;margin-top:12px;">
                By booking you agree to our terms. Tickets are non-refundable after the event.
              </p>
            </div>
          </div>
        </div>
      </div>`;

    startTimer();

    window.confirmBooking = async function(eventId) {
      const btn = document.getElementById('confirm-btn');
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Confirming…'; }
      clearInterval(timerInterval);

      try {
        const data = await post('/bookings/confirm', { event_id: +eventId, seat_ids: seatIds });
        navigate(`/booking-success/${data.booking_id}`, true);
      } catch(err) {
        toast('error', 'Booking failed', err.message);
        if (btn) { btn.disabled = false; btn.innerHTML = `✅ Confirm Booking — ${fmt(totalAmount)}`; }
        startTimer();
      }
    };

  } catch(err) {
    app.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Checkout failed</h3><p>${err.message}</p><button class="btn btn-secondary mt-4" onclick="navigate('/events/${id}/seats')">← Select Seats</button></div>`;
  }
});

// ─── Booking Success ──────────────────────────────────────────────
register('/booking-success/:id', async ({ id }) => {
  if (!Auth.isLoggedIn()) return navigate('/');
  const app = document.getElementById('app');

  try {
    const booking = await get(`/bookings/${id}`);

    app.innerHTML = `
      <div class="page-enter">
        <div class="booking-success">
          <div class="success-icon">🎉</div>
          <h1 style="font-family:var(--font-display);font-size:32px;font-weight:800;margin-bottom:8px;">Booking Confirmed!</h1>
          <p style="color:var(--text-secondary);">Your seats are reserved. Enjoy the experience!</p>

          <div class="booking-ref-display">${escHtml(booking.booking_ref)}</div>

          <div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-xl);padding:24px;margin:24px 0;text-align:left;">
            <div class="order-summary-item">
              <span style="color:var(--text-muted);">Event</span>
              <span style="font-weight:600;">${escHtml(booking.event_title)}</span>
            </div>
            <div class="order-summary-item">
              <span style="color:var(--text-muted);">Date & Time</span>
              <span>${fmtDate(booking.event_date)} · ${fmtTime(booking.event_time)}</span>
            </div>
            <div class="order-summary-item">
              <span style="color:var(--text-muted);">Venue</span>
              <span>${escHtml(booking.venue_name)}</span>
            </div>
            <div class="order-summary-item">
              <span style="color:var(--text-muted);">Seats</span>
              <span>${booking.seats.map(s => `Row ${s.row_label} #${s.seat_number}`).join(', ')}</span>
            </div>
            <div class="order-summary-item" style="border-bottom:none;">
              <span style="color:var(--text-muted);">Total Paid</span>
              <span style="font-size:18px;font-weight:800;color:var(--accent-green);">${fmt(booking.total_amount)}</span>
            </div>
          </div>

          ${booking.qr_code ? `
            <div>
              <p style="color:var(--text-secondary);margin-bottom:12px;font-weight:600;">🔲 Present this QR at entry</p>
              <div class="qr-display">
                <img src="${booking.qr_code}" alt="QR Code" width="200" height="200">
              </div>
            </div>` : ''}

          <div style="display:flex;gap:12px;justify-content:center;margin-top:32px;flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="navigate('/bookings')">📋 My Bookings</button>
            <button class="btn btn-secondary" onclick="navigate('/')">🎟️ Browse More Events</button>
          </div>
        </div>
      </div>`;
  } catch(err) {
    app.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Booking not found</h3><p>${err.message}</p><button class="btn btn-secondary mt-4" onclick="navigate('/bookings')">My Bookings</button></div>`;
  }
});

// ─── Waitlist Offer Acceptance ─────────────────────────────────────
register('/waitlist-offer', async () => {
  const hash = location.hash;
  const token = (hash.split('token=')[1] || '').split('&')[0];
  const app = document.getElementById('app');

  if (!token) {
    app.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><h3>Invalid offer link</h3><a href="#/" class="btn btn-secondary mt-4">← Home</a></div>`;
    return;
  }

  try {
    const offer = await get(`/waitlist/offer?token=${encodeURIComponent(token)}`);
    const expiresAt = new Date(offer.offer_expires_at);

    app.innerHTML = `
      <div class="page-enter">
        <div class="offer-page">
          <div class="offer-banner">
            <div style="font-size:48px;margin-bottom:12px;">🎉</div>
            <h1 style="font-family:var(--font-display);font-size:28px;font-weight:800;margin-bottom:8px;">A Seat is Available!</h1>
            <p style="color:var(--text-secondary);">You're next on the waitlist for <strong>${escHtml(offer.event_title)}</strong></p>

            <div class="offer-countdown" id="offer-countdown">--:--</div>
            <p style="font-size:13px;color:var(--text-muted);">Time remaining to claim your seat</p>

            <div style="margin:20px 0;padding:16px;background:var(--bg-card);border-radius:var(--radius-md);text-align:left;">
              <div style="font-size:14px;color:var(--text-muted);margin-bottom:4px;">Category</div>
              <div style="font-weight:700;">${escHtml(offer.category_name)}</div>
              <div style="font-size:14px;color:var(--text-muted);margin-top:8px;margin-bottom:4px;">Price</div>
              <div style="font-weight:700;color:var(--accent-green);">${fmt(offer.price)}</div>
            </div>
          </div>

          ${Auth.isLoggedIn() && Auth.user.role === 'customer'
            ? `<button id="accept-btn" class="btn btn-primary btn-full btn-lg" onclick="acceptWaitlistOffer('${escHtml(token)}', ${offer.event_id})">
                🎫 Claim My Seat Now
               </button>`
            : `<p style="margin-bottom:12px;color:var(--text-secondary);">Please log in to claim this offer.</p>
               <button class="btn btn-primary btn-full btn-lg" onclick="navigate('/login')">Login to Claim</button>`}
        </div>
      </div>`;

    // Countdown
    const countdownEl = document.getElementById('offer-countdown');
    const tick = setInterval(() => {
      const rem = expiresAt - Date.now();
      if (!countdownEl) { clearInterval(tick); return; }
      if (rem <= 0) {
        clearInterval(tick);
        countdownEl.textContent = 'Expired';
        countdownEl.classList.add('urgent');
        return;
      }
      const m = Math.floor(rem / 60000);
      const s = Math.floor((rem % 60000) / 1000);
      countdownEl.textContent = `${m}:${String(s).padStart(2,'0')}`;
      if (rem < 180000) countdownEl.classList.add('urgent');
    }, 1000);
    tick();

  } catch(err) {
    app.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⏰</div><h3>Offer expired or invalid</h3><p>${err.message}</p><a href="#/" class="btn btn-secondary mt-4">← Home</a></div>`;
  }
});

async function acceptWaitlistOffer(token, eventId) {
  const btn = document.getElementById('accept-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Accepting…'; }
  try {
    await post('/waitlist/offer/accept', { token });
    toast('success', 'Offer Accepted!', 'Please select your seat to complete booking');
    navigate(`/events/${eventId}/seats`);
  } catch(err) {
    toast('error', 'Failed', err.message);
    if (btn) { btn.disabled = false; btn.innerHTML = '🎫 Claim My Seat Now'; }
  }
}
