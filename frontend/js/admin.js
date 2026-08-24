/* ═══════════════════════════════════════════════════════════════
   TicketFlow — Admin Dashboard
   ═══════════════════════════════════════════════════════════════ */

register('/admin', async () => {
  if (!Auth.isLoggedIn() || !Auth.isRole('admin')) {
    toast('error', 'Access denied', 'Admin account required');
    return navigate('/');
  }

  const app = document.getElementById('app');
  app.innerHTML = `<div class="loading-screen"><div class="loading-logo">⚙️</div><div class="loading-text">Loading admin panel…</div></div>`;

  try {
    const [stats, users, venues] = await Promise.all([
      get('/admin/stats'),
      get('/admin/users'),
      get('/admin/venues'),
    ]);

    app.innerHTML = `
      <div class="page-enter">
        <div class="dashboard-header">
          <div>
            <h1 class="dashboard-title">⚙️ Admin Panel</h1>
            <p style="color:var(--text-muted);">Platform management and analytics</p>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="btn btn-primary" onclick="openAddVenueModal()">+ Add Venue</button>
          </div>
        </div>

        <!-- Stats -->
        <div class="stats-grid">
          <div class="stat-card stat-purple">
            <div class="stat-icon">👥</div>
            <div class="stat-value">${stats.totalUsers}</div>
            <div class="stat-label">Total Users</div>
          </div>
          <div class="stat-card stat-pink">
            <div class="stat-icon">🎭</div>
            <div class="stat-value">${stats.totalEvents}</div>
            <div class="stat-label">Total Events</div>
          </div>
          <div class="stat-card stat-green">
            <div class="stat-icon">🎫</div>
            <div class="stat-value">${stats.totalBookings}</div>
            <div class="stat-label">Confirmed Bookings</div>
          </div>
          <div class="stat-card stat-amber">
            <div class="stat-icon">💰</div>
            <div class="stat-value">${fmt(stats.totalRevenue)}</div>
            <div class="stat-label">Total Revenue</div>
          </div>
          <div class="stat-card" style="border-top:3px solid var(--accent-cyan);">
            <div class="stat-icon">⏳</div>
            <div class="stat-value">${stats.totalWaiting}</div>
            <div class="stat-label">On Waitlist</div>
          </div>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:8px;margin-bottom:24px;border-bottom:1px solid var(--border-subtle);padding-bottom:4px;" id="admin-tabs">
          <button class="filter-chip active" onclick="adminTab(this,'tab-venues')">🏟️ Venues (${venues.length})</button>
          <button class="filter-chip" onclick="adminTab(this,'tab-users')">👥 Users (${users.length})</button>
        </div>

        <!-- Venues Tab -->
        <div id="tab-venues">
          <div class="data-table-wrap">
            <div class="data-table-header">
              <span class="data-table-title">Venues</span>
              <button class="btn btn-primary btn-sm" onclick="openAddVenueModal()">+ Add Venue</button>
            </div>
            ${venues.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">🏟️</div><h3>No venues yet</h3></div>' : `
            <table class="data-table">
              <thead><tr><th>Venue</th><th>Address</th><th>Seats</th><th>Created By</th><th>Actions</th></tr></thead>
              <tbody>
                ${venues.map(v => `
                  <tr>
                    <td><div style="font-weight:600;">${escHtml(v.name)}</div></td>
                    <td style="color:var(--text-muted);font-size:13px;">${escHtml(v.address)}</td>
                    <td><span style="font-weight:700;color:var(--accent-green);">${v.seat_count}</span></td>
                    <td style="font-size:13px;">${escHtml(v.created_by_name || '—')}</td>
                    <td>
                      <div style="display:flex;gap:8px;">
                        <button class="btn btn-secondary btn-sm" onclick="openVenueDetail(${v.id},'${escHtml(v.name)}')">Manage</button>
                      </div>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>`}
          </div>
        </div>

        <!-- Users Tab -->
        <div id="tab-users" style="display:none;">
          <div class="data-table-wrap">
            <div class="data-table-header">
              <span class="data-table-title">All Users</span>
            </div>
            <table class="data-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
              <tbody>
                ${users.map(u => {
                  const roleColors = { admin: 'var(--accent-red)', organiser: 'var(--accent-pink)', customer: 'var(--accent-indigo)' };
                  const roleIcons  = { admin: '⚙️', organiser: '🎭', customer: '🎫' };
                  return `<tr>
                    <td style="font-weight:600;">${escHtml(u.name)}</td>
                    <td style="color:var(--text-muted);font-size:13px;">${escHtml(u.email)}</td>
                    <td><span style="padding:3px 10px;border-radius:var(--radius-full);font-size:11px;font-weight:700;background:${roleColors[u.role]}20;color:${roleColors[u.role]};">${roleIcons[u.role]} ${u.role.toUpperCase()}</span></td>
                    <td style="font-size:13px;color:var(--text-muted);">${new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;

  } catch(err) {
    app.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Failed to load admin panel</h3><p>${err.message}</p></div>`;
  }
});

function adminTab(el, tabId) {
  document.querySelectorAll('[id^="tab-"]').forEach(t => t.style.display = 'none');
  document.getElementById(tabId).style.display = '';
  document.querySelectorAll('#admin-tabs .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

// ─── Add Venue Modal ──────────────────────────────────────────────
function openAddVenueModal() {
  openModal(`
    <div class="modal-title">🏟️ Add New Venue</div>
    <div class="modal-desc">Create a new venue with seats and categories</div>

    <div class="form-group">
      <label class="form-label" for="av-name">Venue Name</label>
      <input id="av-name" type="text" class="form-input" placeholder="e.g. Grand Cineplex">
    </div>
    <div class="form-group">
      <label class="form-label" for="av-address">Address</label>
      <input id="av-address" type="text" class="form-input" placeholder="12 MG Road, Bengaluru">
    </div>
    <p id="av-error" class="form-error" style="display:none;"></p>
    <button id="av-btn" class="btn btn-primary btn-full mt-4" onclick="submitAddVenue()">Create Venue</button>
  `);
}

async function submitAddVenue() {
  const name    = document.getElementById('av-name').value.trim();
  const address = document.getElementById('av-address').value.trim();
  const errEl   = document.getElementById('av-error');
  const btn     = document.getElementById('av-btn');

  errEl.style.display = 'none';
  if (!name || !address) { errEl.textContent = 'Name and address are required.'; errEl.style.display = 'block'; return; }

  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Creating…';

  try {
    const res = await post('/admin/venues', { name, address });
    closeModal();
    toast('success', 'Venue Created', `${name} has been added. Now add categories and seats.`);
    // Open venue detail to add categories/seats
    setTimeout(() => openVenueDetail(res.venue_id, name), 500);
    navigate('/admin', true);
  } catch(err) {
    errEl.textContent = err.message; errEl.style.display = 'block';
    btn.disabled = false; btn.innerHTML = 'Create Venue';
  }
}

// ─── Venue Detail Modal ───────────────────────────────────────────
async function openVenueDetail(venueId, venueName) {
  openModal(`<div class="modal-title">🏟️ ${escHtml(venueName)}</div><div id="vd-content"><span class="spinner"></span></div>`);

  async function loadVenueData() {
    try {
      const cats = await get(`/admin/venues/${venueId}/categories`);
      document.getElementById('vd-content').innerHTML = `
        <!-- Categories -->
        <div style="margin-bottom:20px;">
          <div class="form-label" style="margin-bottom:10px;">Seat Categories (${cats.length})</div>
          ${cats.map(c => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg-secondary);border-radius:var(--radius-md);margin-bottom:6px;">
              <span style="width:12px;height:12px;border-radius:50%;background:${c.color};"></span>
              <span style="font-weight:600;flex:1;">${escHtml(c.name)}</span>
              <span style="font-size:13px;color:var(--text-muted);">${c.seat_count} seats</span>
            </div>`).join('') || '<p style="color:var(--text-muted);font-size:13px;">No categories yet</p>'}
        </div>

        <!-- Add Category -->
        <div style="padding:16px;background:var(--bg-secondary);border-radius:var(--radius-md);margin-bottom:16px;">
          <div class="form-label" style="margin-bottom:10px;">Add Category</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <input id="cat-name" type="text" class="form-input" placeholder="Category name" style="flex:1;min-width:120px;">
            <input id="cat-color" type="color" value="#6366f1" style="width:48px;height:44px;padding:2px;border-radius:var(--radius-sm);border:1.5px solid var(--border-mid);background:var(--bg-input);cursor:pointer;">
            <button class="btn btn-primary btn-sm" onclick="addCategory(${venueId})">Add</button>
          </div>
        </div>

        <!-- Add Seats -->
        ${cats.length > 0 ? `
        <div style="padding:16px;background:var(--bg-secondary);border-radius:var(--radius-md);">
          <div class="form-label" style="margin-bottom:10px;">Bulk Add Seats</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:end;">
            <div>
              <div class="form-label" style="font-size:11px;">Row Label</div>
              <input id="seat-row" type="text" class="form-input" placeholder="A" maxlength="3">
            </div>
            <div>
              <div class="form-label" style="font-size:11px;">Category</div>
              <select id="seat-cat" class="form-input form-select">
                ${cats.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <div class="form-label" style="font-size:11px;">Count</div>
              <input id="seat-count" type="number" class="form-input" placeholder="10" min="1" max="50">
            </div>
            <button class="btn btn-primary btn-sm" onclick="addSeats(${venueId})">Add</button>
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">Adds seats sequentially starting from seat 1</p>
        </div>` : ''}`;
    } catch(err) {
      document.getElementById('vd-content').innerHTML = `<p style="color:var(--accent-red);">${err.message}</p>`;
    }
  }

  await loadVenueData();

  window.addCategory = async function(vid) {
    const name  = document.getElementById('cat-name').value.trim();
    const color = document.getElementById('cat-color').value;
    if (!name) { toast('warning', 'Enter category name', ''); return; }
    try {
      await post(`/admin/venues/${vid}/categories`, { name, color });
      toast('success', 'Category added', name);
      document.getElementById('cat-name').value = '';
      await loadVenueData();
    } catch(err) { toast('error', 'Failed', err.message); }
  };

  window.addSeats = async function(vid) {
    const rowLabel   = document.getElementById('seat-row').value.trim().toUpperCase();
    const categoryId = +document.getElementById('seat-cat').value;
    const count      = +document.getElementById('seat-count').value;
    if (!rowLabel || !count) { toast('warning', 'Fill in all fields', ''); return; }
    try {
      const res = await post(`/admin/venues/${vid}/seats`, { rows: [{ row_label: rowLabel, category_id: categoryId, count }] });
      toast('success', 'Seats added', `${res.seats_created} seats added to Row ${rowLabel}`);
      document.getElementById('seat-row').value = '';
      document.getElementById('seat-count').value = '';
      await loadVenueData();
    } catch(err) { toast('error', 'Failed', err.message); }
  };
}
