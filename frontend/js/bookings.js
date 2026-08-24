/* ═══════════════════════════════════════════════════════════════
   TicketFlow — My Bookings + My Waitlist
   ═══════════════════════════════════════════════════════════════ */

// ─── My Bookings ──────────────────────────────────────────────────
register('/bookings', async () => {
  if (!Auth.isLoggedIn() || !Auth.isRole('customer')) return navigate('/login');

  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="page-enter">
      <div class="dashboard-header">
        <h1 class="dashboard-title">📋 My Bookings</h1>
        <button class="btn btn-secondary" onclick="navigate('/')">🎟️ Browse Events</button>
      </div>
      <div id="bookings-list">
        ${[1,2].map(() => `<div class="booking-history-card"><div class="skeleton" style="height:20px;width:40%;margin-bottom:12px;"></div><div class="skeleton" style="height:14px;width:60%;"></div></div>`).join('')}
      </div>
    </div>`;

  try {
    const bookings = await get('/bookings/my');
    const list = document.getElementById('bookings-list');

    if (!bookings.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🎫</div><h3>No bookings yet</h3><p>Book your first event and your tickets will appear here</p><button class="btn btn-primary mt-4" onclick="navigate('/')">Browse Events</button></div>`;
      return;
    }

    list.innerHTML = bookings.map(b => `
      <div class="booking-history-card">
        <div class="booking-header">
          <div>
            <div style="font-family:var(--font-display);font-size:18px;font-weight:700;margin-bottom:4px;">${escHtml(b.event_title)}</div>
            <div style="color:var(--text-muted);font-size:13px;">${fmtDate(b.event_date)} · ${fmtTime(b.event_time)} · ${escHtml(b.venue_name)}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
            <span class="booking-ref-small">${escHtml(b.booking_ref)}</span>
            <span class="status-badge status-${b.status}">${b.status.toUpperCase()}</span>
          </div>
        </div>

        <!-- Seats -->
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
          ${b.seats.map(s => `
            <div class="category-pill" style="background:${s.color}20;color:${s.color};border:1px solid ${s.color}40;">
              Row ${escHtml(s.row_label)} Seat ${s.seat_number} — ${escHtml(s.category_name)}
            </div>`).join('')}
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div style="font-size:20px;font-weight:800;color:var(--accent-green);">${fmt(b.total_amount)}</div>
          <div style="display:flex;gap:10px;">
            <button class="btn btn-secondary btn-sm" onclick="viewBookingDetail(${b.id})">View Details</button>
            ${b.status === 'confirmed' ? `<button class="btn btn-danger btn-sm" onclick="cancelBooking(${b.id}, '${escHtml(b.booking_ref)}')">Cancel</button>` : ''}
          </div>
        </div>
      </div>`).join('');

  } catch(err) {
    document.getElementById('bookings-list').innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Failed to load bookings</h3><p>${err.message}</p></div>`;
  }
});

async function viewBookingDetail(bookingId) {
  try {
    const b = await get(`/bookings/${bookingId}`);
    openModal(`
      <div class="modal-title">📋 Booking Details</div>
      <div class="booking-ref-display" style="font-size:18px;padding:14px;margin:16px 0;">${escHtml(b.booking_ref)}</div>

      <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:16px;margin-bottom:16px;">
        <div style="font-weight:700;margin-bottom:4px;">${escHtml(b.event_title)}</div>
        <div style="color:var(--text-muted);font-size:13px;">${fmtDate(b.event_date)} · ${fmtTime(b.event_time)}</div>
        <div style="color:var(--text-muted);font-size:13px;">${escHtml(b.venue_name)}</div>
      </div>

      <div style="margin-bottom:12px;">
        ${b.seats.map(s => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-subtle);font-size:14px;">
          <span>Row ${s.row_label} Seat ${s.seat_number} (${escHtml(s.category_name)})</span>
          <span style="font-weight:600;">${fmt(s.price_paid)}</span>
        </div>`).join('')}
        <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:16px;font-weight:800;">
          <span>Total</span>
          <span style="color:var(--accent-green);">${fmt(b.total_amount)}</span>
        </div>
      </div>

      ${b.qr_code ? `<div class="qr-display" style="margin:0 auto;display:block;text-align:center;"><img src="${b.qr_code}" width="180" height="180"></div>` : ''}
    `);
  } catch(err) {
    toast('error', 'Failed', err.message);
  }
}

async function cancelBooking(bookingId, ref) {
  if (!confirm(`Cancel booking ${ref}? This cannot be undone.`)) return;
  try {
    await post(`/bookings/${bookingId}/cancel`);
    toast('success', 'Booking cancelled', `${ref} has been cancelled`);
    navigate('/bookings', true);
  } catch(err) {
    toast('error', 'Cancel failed', err.message);
  }
}

// ─── My Waitlist ──────────────────────────────────────────────────
register('/waitlist', async () => {
  if (!Auth.isLoggedIn() || !Auth.isRole('customer')) return navigate('/login');

  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="page-enter">
      <div class="dashboard-header">
        <h1 class="dashboard-title">⏳ My Waitlist</h1>
        <button class="btn btn-secondary" onclick="navigate('/')">🎟️ Browse Events</button>
      </div>
      <div id="waitlist-list">
        <div class="loading-screen"><div class="loading-logo" style="font-size:32px;">⏳</div></div>
      </div>
    </div>`;

  try {
    const entries = await get('/waitlist/my');
    const list = document.getElementById('waitlist-list');

    if (!entries.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⏳</div><h3>No waitlist entries</h3><p>When an event is sold out, you can join the waitlist to be notified when seats become available.</p><button class="btn btn-primary mt-4" onclick="navigate('/')">Browse Events</button></div>`;
      return;
    }

    const statusColors = { waiting: 'var(--accent-amber)', offered: 'var(--accent-green)', expired: 'var(--text-muted)', fulfilled: 'var(--accent-indigo)' };

    list.innerHTML = entries.map(e => `
      <div class="waitlist-entry">
        <div class="waitlist-position">#${e.position}</div>
        <div style="flex:1;">
          <div style="font-weight:700;margin-bottom:2px;">${escHtml(e.event_title)}</div>
          <div style="font-size:13px;color:var(--text-muted);">${fmtDate(e.event_date)} · ${escHtml(e.category_name)}</div>
        </div>
        <span style="padding:4px 12px;border-radius:var(--radius-full);font-size:12px;font-weight:700;background:${statusColors[e.status]}20;color:${statusColors[e.status]};border:1px solid ${statusColors[e.status]}40;">${e.status.toUpperCase()}</span>
        ${e.status === 'offered' ? `<button class="btn btn-primary btn-sm" onclick="navigate('/events/${e.event_id}/seats')">Claim Seat</button>` : ''}
      </div>`).join('');
  } catch(err) {
    document.getElementById('waitlist-list').innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Failed to load</h3><p>${err.message}</p></div>`;
  }
});
