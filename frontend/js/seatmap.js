/* ═══════════════════════════════════════════════════════════════
   TicketFlow — Seat Map
   ═══════════════════════════════════════════════════════════════ */

register('/events/:id/seats', async ({ id }) => {
  if (!Auth.isLoggedIn()) {
    toast('warning', 'Login required', 'Please sign in to book tickets');
    return navigate('/login');
  }
  if (!Auth.isRole('customer')) {
    toast('error', 'Customers only', 'Only customers can book seats');
    return navigate('/');
  }

  const app = document.getElementById('app');
  app.innerHTML = `<div class="loading-screen"><div class="loading-logo">🎟️</div><div class="loading-text">Loading seat map…</div></div>`;

  try {
    const [event, seatData] = await Promise.all([
      get(`/events/${id}`),
      get(`/events/${id}/seats`)
    ]);

    let selected = new Set();

    function render() {
      const { seats, rows, pricing } = seatData;
      const pricingMap = {};
      pricing.forEach(p => { pricingMap[p.category_id] = p.price; });

      // Category colors
      const colorMap = {};
      seats.forEach(s => { colorMap[s.category_id] = s.color; });

      // Legend items from pricing
      const legendHtml = pricing.map(p => `
        <div class="legend-item">
          <div class="legend-seat" style="background:${p.color}20;border:1.5px solid ${p.color};"></div>
          ${escHtml(p.name)} — ${fmt(p.price)}
        </div>`).join('');

      // Status legend
      const statusLegend = `
        <div class="legend-item"><div class="legend-seat" style="background:var(--bg-card);border:1.5px solid var(--border-mid);"></div>Available</div>
        <div class="legend-item"><div class="legend-seat" style="background:rgba(124,58,237,0.5);border:1.5px solid var(--accent-purple);">✓</div>Selected</div>
        <div class="legend-item"><div class="legend-seat" style="background:rgba(245,158,11,0.2);border:1.5px solid rgba(245,158,11,0.5);"></div>Held</div>
        <div class="legend-item"><div class="legend-seat" style="background:rgba(100,100,150,0.2);border:1.5px solid rgba(100,100,150,0.3);"></div>Booked</div>`;

      // Seat rows HTML
      const rowsHtml = Object.entries(rows).map(([rowLabel, rowSeats]) => {
        const seatsHtml = rowSeats.map(seat => {
          const isSel = selected.has(seat.id);
          let cls = 'seat-btn ';
          let disabled = '';
          let style = '';

          if (seat.held_by_me) {
            cls += 'held-by-me';
            style = `border-color:${seat.color};`;
          } else if (seat.status === 'available' || seat.held_by_me) {
            cls += isSel ? 'selected' : 'available';
            if (!isSel && seat.color) style = `--seat-color:${seat.color};`;
          } else if (seat.status === 'held') {
            cls += 'held'; disabled = 'disabled';
          } else {
            cls += 'booked'; disabled = 'disabled';
          }

          const tooltip = `${seat.category_name} | Row ${seat.row_label} Seat ${seat.seat_number} | ${fmt(seat.price)}`;

          return `<button class="${cls}" data-id="${seat.id}" data-price="${seat.price}"
            data-tooltip="${escHtml(tooltip)}" ${disabled}
            style="${style}"
            onclick="toggleSeat(${seat.id}, ${seat.price}, '${escHtml(seat.row_label)}', ${seat.seat_number}, '${escHtml(seat.category_name)}', '${escHtml(seat.color || '')}')">
            ${seat.seat_number}
          </button>`;
        }).join('');
        return `<div class="seat-row"><div class="row-label">${rowLabel}</div><div class="seats-container">${seatsHtml}</div></div>`;
      }).join('');

      const totalPrice = [...selected].reduce((sum, id) => {
        const btn = document.querySelector(`[data-id="${id}"]`);
        return sum + (btn ? +btn.dataset.price : 0);
      }, 0);

      app.innerHTML = `
        <div class="page-enter">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
            <button onclick="navigate('/events/${id}')" class="btn btn-secondary btn-sm">← Back</button>
            <div>
              <h1 style="font-family:var(--font-display);font-size:24px;font-weight:700;">${escHtml(event.title)}</h1>
              <p style="color:var(--text-muted);font-size:14px;">${fmtDate(event.event_date)} · ${fmtTime(event.event_time)} · ${escHtml(event.venue_name)}</p>
            </div>
          </div>

          <div class="seatmap-section">
            <div class="seatmap-header">
              <span class="seatmap-title">🎭 Select Your Seats</span>
              <button onclick="refreshSeats()" class="btn btn-secondary btn-sm">🔄 Refresh</button>
            </div>

            <!-- Screen -->
            <div class="screen-indicator">
              <div class="screen-bar"></div>
              <div class="screen-label">SCREEN / STAGE</div>
            </div>

            <!-- Legend -->
            <div class="seat-legend">
              ${legendHtml}
              ${statusLegend}
            </div>

            <!-- Rows -->
            <div id="seat-rows">${rowsHtml}</div>

            <!-- Selection panel -->
            <div class="selection-panel" id="selection-panel" style="${selected.size === 0 ? 'opacity:0.5;' : ''}">
              <div class="selection-info">
                <div class="selection-count">${selected.size} seat${selected.size !== 1 ? 's' : ''} selected</div>
                <div class="selection-seats" id="seat-labels"></div>
              </div>
              <div style="font-size:22px;font-weight:800;color:var(--accent-green);">${fmt(totalPrice)}</div>
              <button class="btn btn-primary btn-lg" id="hold-btn"
                onclick="holdSeats(${id})"
                ${selected.size === 0 ? 'disabled' : ''}>
                🎫 Reserve Seats
              </button>
            </div>
          </div>
        </div>`;

      updateSeatLabels();
    }

    window.toggleSeat = function(seatId, price, rowLabel, seatNum, catName, color) {
      if (selected.has(seatId)) {
        selected.delete(seatId);
      } else {
        if (selected.size >= 10) { toast('warning', 'Max 10 seats', 'You can select up to 10 seats at once'); return; }
        selected.add(seatId);
      }
      const btn = document.querySelector(`[data-id="${seatId}"]`);
      if (btn) {
        btn.classList.toggle('selected', selected.has(seatId));
        btn.classList.toggle('available', !selected.has(seatId));
      }
      // Update panel
      const totalPrice = [...selected].reduce((sum, id) => {
        const b = document.querySelector(`[data-id="${id}"]`);
        return sum + (b ? +b.dataset.price : 0);
      }, 0);
      const panel = document.getElementById('selection-panel');
      if (panel) {
        panel.style.opacity = selected.size > 0 ? '1' : '0.5';
        panel.querySelector('.selection-count').textContent = `${selected.size} seat${selected.size !== 1 ? 's' : ''} selected`;
        panel.querySelector('[style*="accent-green"]').textContent = fmt(totalPrice);
        const holdBtn = document.getElementById('hold-btn');
        if (holdBtn) holdBtn.disabled = selected.size === 0;
      }
      updateSeatLabels();
    };

    function updateSeatLabels() {
      const el = document.getElementById('seat-labels');
      if (!el || selected.size === 0) { if(el) el.textContent = ''; return; }
      const labels = [...selected].map(id => {
        const btn = document.querySelector(`[data-id="${id}"]`);
        return btn ? btn.dataset.tooltip.split('|')[1]?.trim() : '';
      }).filter(Boolean);
      el.textContent = labels.join(', ');
    }

    window.refreshSeats = async function() {
      selected.clear();
      try {
        const fresh = await get(`/events/${id}/seats`);
        Object.assign(seatData, fresh);
        render();
        toast('info', 'Refreshed', 'Seat map updated');
      } catch(e) { toast('error', 'Refresh failed', e.message); }
    };

    window.holdSeats = async function(eventId) {
      if (selected.size === 0) return;
      const btn = document.getElementById('hold-btn');
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Reserving…'; }
      try {
        await post('/bookings/hold', { event_id: +eventId, seat_ids: [...selected] });
        toast('success', 'Seats Reserved!', 'You have 10 minutes to complete your booking');
        navigate(`/checkout/${eventId}?seats=${[...selected].join(',')}`);
      } catch(err) {
        toast('error', 'Hold failed', err.message);
        if (btn) { btn.disabled = false; btn.innerHTML = '🎫 Reserve Seats'; }
        // Refresh to show updated status
        await window.refreshSeats();
      }
    };

    render();

  } catch(err) {
    app.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Failed to load seat map</h3><p>${err.message}</p><button class="btn btn-secondary mt-4" onclick="navigate('/events/${id}')">← Back</button></div>`;
  }
});
