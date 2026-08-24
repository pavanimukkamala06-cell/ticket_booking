/* ═══════════════════════════════════════════════════════════════
   TicketFlow — Organiser Dashboard
   ═══════════════════════════════════════════════════════════════ */

register('/organiser', async () => {
  if (!Auth.isLoggedIn() || !Auth.isRole('organiser', 'admin')) {
    toast('error', 'Access denied', 'Organiser account required');
    return navigate('/');
  }

  const app = document.getElementById('app');
  app.innerHTML = `<div class="loading-screen"><div class="loading-logo">🎭</div><div class="loading-text">Loading dashboard…</div></div>`;

  try {
    const events = await get('/organiser/events');

    app.innerHTML = `
      <div class="page-enter">
        <div class="dashboard-header">
          <div>
            <h1 class="dashboard-title">🎭 Organiser Dashboard</h1>
            <p style="color:var(--text-muted);">Manage your events and view analytics</p>
          </div>
          <button class="btn btn-primary" onclick="openCreateEventModal()">+ Create Event</button>
        </div>

        <!-- Events -->
        <div class="data-table-wrap">
          <div class="data-table-header">
            <span class="data-table-title">My Events (${events.length})</span>
          </div>
          ${events.length === 0 ? `
            <div class="empty-state">
              <div class="empty-state-icon">🎭</div>
              <h3>No events yet</h3>
              <p>Create your first event to get started</p>
              <button class="btn btn-primary mt-4" onclick="openCreateEventModal()">Create Event</button>
            </div>` : `
          <table class="data-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Type</th>
                <th>Date</th>
                <th>Venue</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${events.map(e => `
                <tr>
                  <td>
                    <div style="font-weight:600;">${escHtml(e.title)}</div>
                    ${e.organiser_name ? `<div style="font-size:12px;color:var(--text-muted);">by ${escHtml(e.organiser_name)}</div>` : ''}
                  </td>
                  <td><span class="event-type-badge ${e.type === 'movie' ? 'badge-movie' : 'badge-concert'}">${e.type === 'movie' ? '🎬 Movie' : '🎵 Concert'}</span></td>
                  <td style="font-size:13px;">${fmtDate(e.event_date)}<br><span style="color:var(--text-muted);">${fmtTime(e.event_time)}</span></td>
                  <td style="font-size:13px;">${escHtml(e.venue_name)}</td>
                  <td>
                    <div style="display:flex;gap:8px;">
                      <button class="btn btn-secondary btn-sm" onclick="viewEventSummary(${e.id}, '${escHtml(e.title)}')">📊 Analytics</button>
                      <button class="btn btn-secondary btn-sm" onclick="navigate('/events/${e.id}')">View</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>`}
        </div>
      </div>`;

  } catch(err) {
    app.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Failed to load</h3><p>${err.message}</p></div>`;
  }
});

// ─── Event Summary Modal ───────────────────────────────────────────
async function viewEventSummary(eventId, title) {
  openModal(`<div class="modal-title">📊 ${escHtml(title)}</div><div id="summary-content" style="text-align:center;padding:20px;"><span class="spinner"></span></div>`);
  try {
    const s = await get(`/organiser/events/${eventId}/summary`);

    document.getElementById('summary-content').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
        <div class="stat-card stat-green" style="text-align:left;padding:16px;">
          <div class="stat-icon">💰</div>
          <div class="stat-value" style="font-size:22px;">${fmt(s.total_revenue)}</div>
          <div class="stat-label">Total Revenue</div>
        </div>
        <div class="stat-card stat-purple" style="text-align:left;padding:16px;">
          <div class="stat-icon">🎫</div>
          <div class="stat-value" style="font-size:22px;">${s.total_tickets_sold}</div>
          <div class="stat-label">Tickets Sold</div>
        </div>
        <div class="stat-card stat-amber" style="text-align:left;padding:16px;">
          <div class="stat-icon">⏳</div>
          <div class="stat-value" style="font-size:22px;">${s.waitlist_count}</div>
          <div class="stat-label">On Waitlist</div>
        </div>
        <div class="stat-card stat-pink" style="text-align:left;padding:16px;">
          <div class="stat-icon">💺</div>
          <div class="stat-value" style="font-size:22px;">${s.seat_summary.find(x => x.status === 'available')?.count || 0}</div>
          <div class="stat-label">Available Seats</div>
        </div>
      </div>

      ${s.revenue_by_category.length ? `
        <div style="text-align:left;margin-bottom:16px;">
          <div class="form-label" style="margin-bottom:8px;">Revenue by Category</div>
          ${s.revenue_by_category.map(c => `
            <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-subtle);font-size:14px;">
              <span style="display:flex;align-items:center;gap:8px;">
                <span style="width:8px;height:8px;border-radius:50%;background:${c.color};"></span>
                ${escHtml(c.category)} (${c.tickets_sold} tickets)
              </span>
              <span style="font-weight:700;color:var(--accent-green);">${fmt(c.revenue)}</span>
            </div>`).join('')}
        </div>` : ''}

      ${s.recent_bookings.length ? `
        <div style="text-align:left;">
          <div class="form-label" style="margin-bottom:8px;">Recent Bookings</div>
          <div style="max-height:200px;overflow-y:auto;">
            ${s.recent_bookings.map(b => `
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-subtle);font-size:13px;">
                <div>
                  <div style="font-weight:600;">${escHtml(b.customer_name)}</div>
                  <div style="color:var(--text-muted);">${escHtml(b.booking_ref)} · ${b.seat_count} seat${b.seat_count > 1 ? 's' : ''}</div>
                </div>
                <span style="font-weight:700;color:var(--accent-green);">${fmt(b.total_amount)}</span>
              </div>`).join('')}
          </div>
        </div>` : ''}`;
  } catch(err) {
    document.getElementById('summary-content').innerHTML = `<p style="color:var(--accent-red);">${err.message}</p>`;
  }
}

// ─── Create Event Modal ───────────────────────────────────────────
async function openCreateEventModal() {
  // Load venues and their categories
  let venues = [];
  try {
    venues = await get('/admin/venues');
  } catch(e) {}

  openModal(`
    <div class="modal-title">+ Create Event</div>
    <div class="modal-desc">Fill in the details to create a new event</div>

    <div class="form-group">
      <label class="form-label" for="ce-title">Event Title</label>
      <input id="ce-title" type="text" class="form-input" placeholder="e.g. Coldplay World Tour 2026">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="ce-type">Type</label>
        <select id="ce-type" class="form-input form-select">
          <option value="movie">🎬 Movie</option>
          <option value="concert">🎵 Concert</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="ce-venue">Venue</label>
        <select id="ce-venue" class="form-input form-select" onchange="loadVenueCategories()">
          <option value="">-- Select Venue --</option>
          ${venues.map(v => `<option value="${v.id}">${escHtml(v.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="ce-date">Date</label>
        <input id="ce-date" type="date" class="form-input" min="${new Date().toISOString().slice(0,10)}">
      </div>
      <div class="form-group">
        <label class="form-label" for="ce-time">Time</label>
        <input id="ce-time" type="time" class="form-input">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="ce-desc">Description</label>
      <textarea id="ce-desc" class="form-input" rows="3" placeholder="Describe the event…" style="resize:vertical;"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label" for="ce-poster">Poster URL (optional)</label>
      <input id="ce-poster" type="url" class="form-input" placeholder="https://example.com/image.jpg">
    </div>
    <div id="pricing-section"></div>
    <p id="ce-error" class="form-error" style="display:none;"></p>
    <button id="ce-btn" class="btn btn-primary btn-full" onclick="submitCreateEvent()" style="margin-top:8px;">Create Event</button>
  `);

  window.loadVenueCategories = async function() {
    const venueId = document.getElementById('ce-venue').value;
    if (!venueId) { document.getElementById('pricing-section').innerHTML = ''; return; }
    try {
      const cats = await get(`/admin/venues/${venueId}/categories`);
      document.getElementById('pricing-section').innerHTML = cats.length ? `
        <div class="form-label" style="margin-bottom:8px;">Ticket Pricing (per category)</div>
        ${cats.map(c => `
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
            <div style="width:10px;height:10px;border-radius:50%;background:${c.color};flex-shrink:0;"></div>
            <span style="min-width:100px;font-size:14px;">${escHtml(c.name)}</span>
            <input type="number" class="form-input" id="price-${c.id}" placeholder="₹ price" min="0" step="1" style="max-width:140px;">
            <span style="font-size:13px;color:var(--text-muted);">(${c.seat_count} seats)</span>
          </div>`).join('')}` : '<p style="color:var(--text-muted);font-size:13px;">No categories for this venue</p>';
    } catch(e) {}
  };
}

async function submitCreateEvent() {
  const title     = document.getElementById('ce-title').value.trim();
  const type      = document.getElementById('ce-type').value;
  const venue_id  = +document.getElementById('ce-venue').value;
  const event_date= document.getElementById('ce-date').value;
  const event_time= document.getElementById('ce-time').value;
  const description = document.getElementById('ce-desc').value.trim();
  const poster_url  = document.getElementById('ce-poster').value.trim();
  const errEl = document.getElementById('ce-error');
  const btn   = document.getElementById('ce-btn');

  errEl.style.display = 'none';
  if (!title || !venue_id || !event_date || !event_time) {
    errEl.textContent = 'Please fill in all required fields.'; errEl.style.display = 'block'; return;
  }

  // Collect pricing
  const pricing = [];
  document.querySelectorAll('[id^="price-"]').forEach(inp => {
    const catId = +inp.id.replace('price-', '');
    const price = +inp.value;
    if (price > 0) pricing.push({ category_id: catId, price });
  });

  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Creating…';

  try {
    await post('/organiser/events', { title, type, venue_id, event_date, event_time, description, poster_url, pricing });
    closeModal();
    toast('success', 'Event Created!', `"${title}" has been published`);
    navigate('/organiser', true);
  } catch(err) {
    errEl.textContent = err.message; errEl.style.display = 'block';
    btn.disabled = false; btn.innerHTML = 'Create Event';
  }
}
