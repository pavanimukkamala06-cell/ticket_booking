/* ═══════════════════════════════════════════════════════════════
   TicketFlow — Events (Browse + Detail)
   ═══════════════════════════════════════════════════════════════ */

// ─── Events List Page ─────────────────────────────────────────────
register('/', async () => {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="page-enter">
      <!-- Hero -->
      <div class="hero">
        <div class="hero-bg"></div>
        <div class="hero-eyebrow">🎟️ Premium Ticket Booking</div>
        <h1>Your Next Unforgettable<br>Experience Awaits</h1>
        <p>Discover movies, concerts and live events. Reserve your perfect seat in seconds.</p>
        <div class="hero-search">
          <span style="font-size:18px;">🔍</span>
          <input id="search-input" type="text" placeholder="Search events, artists, movies…" oninput="filterEvents()">
          <button class="btn btn-primary" onclick="filterEvents()" style="border-radius:var(--radius-lg);">Search</button>
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-row" id="filter-row">
        <button class="filter-chip active" data-type="" onclick="setFilter(this, '')">All Events</button>
        <button class="filter-chip" data-type="movie" onclick="setFilter(this, 'movie')">🎬 Movies</button>
        <button class="filter-chip" data-type="concert" onclick="setFilter(this, 'concert')">🎵 Concerts</button>
      </div>

      <!-- Events Grid -->
      <div id="events-grid" class="events-grid">
        ${[1,2,3].map(() => `
          <div class="event-card">
            <div class="skeleton" style="height:200px;border-radius:0;"></div>
            <div class="event-card-body">
              <div class="skeleton" style="height:16px;width:80px;margin-bottom:12px;"></div>
              <div class="skeleton" style="height:22px;width:90%;margin-bottom:8px;"></div>
              <div class="skeleton" style="height:14px;width:60%;margin-bottom:16px;"></div>
              <div class="skeleton" style="height:14px;width:70%;"></div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;

  let allEvents = [];
  let activeType = '';

  try {
    allEvents = await get('/events');
    renderEvents(allEvents);
  } catch (err) {
    document.getElementById('events-grid').innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Couldn't load events</h3><p>${err.message}</p></div>`;
  }

  window.setFilter = function(el, type) {
    activeType = type;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    filterEvents();
  };

  window.filterEvents = function() {
    const q = (document.getElementById('search-input')?.value || '').toLowerCase();
    const filtered = allEvents.filter(e =>
      (!activeType || e.type === activeType) &&
      (!q || e.title.toLowerCase().includes(q) || e.venue_name.toLowerCase().includes(q))
    );
    renderEvents(filtered);
  };

  function renderEvents(events) {
    const grid = document.getElementById('events-grid');
    if (!events.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🎭</div><h3>No events found</h3><p>Try adjusting your search or filters</p></div>`;
      return;
    }
    grid.innerHTML = events.map(e => eventCard(e)).join('');
  }
});

function eventCard(e) {
  const totalSeats = e.total_seats || 0;
  const avail = e.available_seats || 0;
  const pct   = totalSeats ? avail / totalSeats : 0;
  let availClass = 'available', availText = `${avail} seats available`;
  if (pct === 0 || avail === 0) { availClass = 'sold-out'; availText = 'Sold Out'; }
  else if (pct < 0.2)           { availClass = 'limited';  availText = `Only ${avail} seats left!`; }

  const img = e.poster_url
    ? `<img class="event-card-img" src="${escHtml(e.poster_url)}" alt="${escHtml(e.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const placeholder = `<div class="event-card-img-placeholder" ${e.poster_url ? 'style="display:none"' : ''}>${e.type === 'movie' ? '🎬' : '🎵'}</div>`;

  return `
    <div class="event-card" onclick="navigate('/events/${e.id}')">
      ${avail === 0 ? '<div class="soldout-overlay">Sold Out</div>' : ''}
      ${img}${placeholder}
      <div class="event-card-body">
        <div class="event-type-badge ${e.type === 'movie' ? 'badge-movie' : 'badge-concert'}">
          ${e.type === 'movie' ? '🎬 Movie' : '🎵 Concert'}
        </div>
        <h3>${escHtml(e.title)}</h3>
        <div class="event-meta">
          <div class="event-meta-row">📅 ${fmtDate(e.event_date)} &nbsp;·&nbsp; 🕐 ${fmtTime(e.event_time)}</div>
          <div class="event-meta-row">📍 ${escHtml(e.venue_name)}</div>
        </div>
        <div class="event-availability">
          <span class="avail-text">
            <span class="avail-dot ${availClass}"></span>
            ${availText}
          </span>
        </div>
      </div>
    </div>`;
}

// ─── Event Detail Page ────────────────────────────────────────────
register('/events/:id', async ({ id }) => {
  const app = document.getElementById('app');
  try {
    const event = await get(`/events/${id}`);
    const minPrice = event.pricing?.length ? Math.min(...event.pricing.map(p => p.price)) : null;

    app.innerHTML = `
      <div class="page-enter">
        <a href="#/" style="display:inline-flex;align-items:center;gap:6px;color:var(--text-muted);font-size:14px;margin-bottom:24px;cursor:pointer;transition:var(--transition);" onmouseenter="this.style.color='var(--text-primary)'" onmouseleave="this.style.color='var(--text-muted)'">
          ← Back to Events
        </a>

        <div class="event-detail-hero">
          <div class="event-poster">
            ${event.poster_url
              ? `<img src="${escHtml(event.poster_url)}" alt="${escHtml(event.title)}" style="width:100%;height:100%;object-fit:cover;">`
              : `<div class="event-poster-placeholder">${event.type === 'movie' ? '🎬' : '🎵'}</div>`}
          </div>

          <div class="event-info">
            <div class="event-type-badge ${event.type === 'movie' ? 'badge-movie' : 'badge-concert'}">
              ${event.type === 'movie' ? '🎬 Movie' : '🎵 Concert'}
            </div>
            <h1 class="event-detail-title">${escHtml(event.title)}</h1>
            <p class="event-detail-desc">${escHtml(event.description || 'No description available.')}</p>

            <div class="detail-meta-grid">
              <div class="detail-meta-item">
                <div class="detail-meta-label">📅 Date</div>
                <div class="detail-meta-value">${fmtDate(event.event_date)}</div>
              </div>
              <div class="detail-meta-item">
                <div class="detail-meta-label">🕐 Time</div>
                <div class="detail-meta-value">${fmtTime(event.event_time)}</div>
              </div>
              <div class="detail-meta-item">
                <div class="detail-meta-label">📍 Venue</div>
                <div class="detail-meta-value">${escHtml(event.venue_name)}</div>
              </div>
              <div class="detail-meta-item">
                <div class="detail-meta-label">🎤 Organiser</div>
                <div class="detail-meta-value">${escHtml(event.organiser_name)}</div>
              </div>
            </div>

            <!-- Pricing -->
            ${event.pricing?.length ? `
              <div style="margin-bottom:24px;">
                <div class="form-label" style="margin-bottom:12px;">Ticket Pricing</div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                  ${event.pricing.map(p => `
                    <div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:12px 18px;display:flex;align-items:center;gap:10px;">
                      <span style="width:10px;height:10px;border-radius:50%;background:${p.color};flex-shrink:0;"></span>
                      <span style="font-size:14px;color:var(--text-secondary);">${escHtml(p.category_name)}</span>
                      <span style="font-weight:700;color:var(--accent-green);">${fmt(p.price)}</span>
                    </div>`).join('')}
                </div>
              </div>` : ''}

            <div style="display:flex;gap:12px;flex-wrap:wrap;">
              <button class="btn btn-primary btn-lg" onclick="navigate('/events/${id}/seats')">
                🎫 Select Seats
              </button>
              ${Auth.isLoggedIn() && Auth.user.role === 'customer' ? `
                <button class="btn btn-secondary" onclick="openWaitlistModal(${id})" id="waitlist-btn" style="display:none;">
                  ⏳ Join Waitlist
                </button>` : ''}
            </div>
          </div>
        </div>

        <!-- Seat Map Preview will load on /seats page -->
        <div id="availability-section"></div>
      </div>`;

    // Load availability
    try {
      const cats = await get(`/events/${id}/availability`);
      const isSoldOut = cats.every(c => c.available === 0);
      const waitlistBtn = document.getElementById('waitlist-btn');
      if (isSoldOut && waitlistBtn) waitlistBtn.style.display = '';

      document.getElementById('availability-section').innerHTML = `
        <div class="seatmap-section">
          <div class="seatmap-header">
            <span class="seatmap-title">Seat Availability</span>
          </div>
          <div style="display:flex;gap:16px;flex-wrap:wrap;">
            ${cats.map(c => `
              <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:16px 24px;text-align:center;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                  <span style="width:10px;height:10px;border-radius:50%;background:${c.color};"></span>
                  <span style="font-size:14px;font-weight:600;">${escHtml(c.name)}</span>
                </div>
                <div style="font-size:24px;font-weight:800;color:${c.available === 0 ? 'var(--accent-red)' : 'var(--accent-green)'};">${c.available}</div>
                <div style="font-size:12px;color:var(--text-muted);">of ${c.total} available</div>
              </div>`).join('')}
          </div>
        </div>`;
    } catch(e) {}

  } catch (err) {
    app.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Event not found</h3><p>${err.message}</p><a href="#/" class="btn btn-secondary mt-4">← Back</a></div>`;
  }
});

// ─── Waitlist modal ───────────────────────────────────────────────
async function openWaitlistModal(eventId) {
  if (!Auth.isLoggedIn()) return navigate('/login');

  openModal(`<div class="modal-title">⏳ Join Waitlist</div>
    <p class="modal-desc">Select a category to join the waitlist. We'll notify you when a seat becomes available.</p>
    <div id="wl-cats">Loading categories…</div>
    <button class="btn btn-primary btn-full mt-4" onclick="joinWaitlist(${eventId})">Join Waitlist</button>`);

  try {
    const cats = await get(`/events/${eventId}/availability`);
    const soldOut = cats.filter(c => c.available === 0);
    document.getElementById('wl-cats').innerHTML = soldOut.length
      ? soldOut.map(c => `
          <label style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md);margin-bottom:8px;cursor:pointer;">
            <input type="radio" name="wl-cat" value="${c.id}" style="accent-color:var(--accent-purple);">
            <span style="width:10px;height:10px;border-radius:50%;background:${c.color};"></span>
            <span>${escHtml(c.name)}</span>
            <span style="color:var(--accent-red);margin-left:auto;">Sold Out</span>
          </label>`).join('')
      : '<p style="color:var(--text-muted)">All categories have available seats — no need to join a waitlist!</p>';
  } catch(e) {}
}

async function joinWaitlist(eventId) {
  const selected = document.querySelector('input[name="wl-cat"]:checked');
  if (!selected) { toast('warning', 'Select a category', ''); return; }
  try {
    const data = await post('/waitlist/join', { event_id: +eventId, category_id: +selected.value });
    closeModal();
    toast('success', 'Joined Waitlist!', `You're at position #${data.position}`);
  } catch(err) {
    toast('error', 'Failed', err.message);
  }
}
