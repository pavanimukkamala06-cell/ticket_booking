/* ═══════════════════════════════════════════════════════════════
   TicketFlow — Core App (Router + State + Utilities)
   ═══════════════════════════════════════════════════════════════ */

// ─── API Base ─────────────────────────────────────────────────────
const API = '/api';

// ─── Auth State ───────────────────────────────────────────────────
const Auth = {
  token: localStorage.getItem('tf_token') || null,
  user:  JSON.parse(localStorage.getItem('tf_user') || 'null'),

  isLoggedIn() { return !!this.token; },
  isRole(...roles) { return this.user && roles.includes(this.user.role); },

  save(token, user) {
    this.token = token;
    this.user  = user;
    localStorage.setItem('tf_token', token);
    localStorage.setItem('tf_user', JSON.stringify(user));
  },

  clear() {
    this.token = null;
    this.user  = null;
    localStorage.removeItem('tf_token');
    localStorage.removeItem('tf_user');
  },

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }
};

// ─── HTTP Client ──────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: Auth.headers() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
const get  = (path)        => api('GET',    path);
const post = (path, body)  => api('POST',   path, body);

// ─── Toast ────────────────────────────────────────────────────────
function toast(type, title, msg, duration = 4000) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
    </div>`;
  el.onclick = () => removeToast(el);
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => removeToast(el), duration);
}
function removeToast(el) {
  el.classList.add('removing');
  setTimeout(() => el.remove(), 300);
}

// ─── Modal ────────────────────────────────────────────────────────
function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// ─── Router ───────────────────────────────────────────────────────
const routes = {};
function register(path, fn) { routes[path] = fn; }

function navigate(path, replace = false) {
  const url = '#' + path;
  if (replace) {
    history.replaceState(null, '', url);
  } else {
    history.pushState(null, '', url);
  }
  handleRoute();
}

function handleRoute() {
  // Strip query string before route matching — keep it in location.hash for pages to read
  const fullHash = location.hash.slice(1) || '/';
  const hash = fullHash.split('?')[0] || '/';
  let matched = null, params = {};
  for (const pattern of Object.keys(routes)) {
    const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '([^/]+)') + '$');
    const m = hash.match(regex);
    if (m) {
      matched = routes[pattern];
      const keys = [...pattern.matchAll(/:([^/]+)/g)].map(x => x[1]);
      keys.forEach((k, i) => { params[k] = m[i + 1]; });
      break;
    }
  }
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading-screen"><div class="loading-logo">🎟️</div><div class="loading-text">Loading...</div></div>';

  if (matched) {
    matched(params);
  } else {
    app.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><h3>Page not found</h3><p><a href="#/" style="color:var(--accent-violet)">← Back to events</a></p></div>`;
  }

  updateNav();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('hashchange', handleRoute);
window.addEventListener('popstate',   handleRoute);

// ─── Nav Update ───────────────────────────────────────────────────
function updateNav() {
  const user = Auth.user;
  const userSection = document.getElementById('nav-user-section');
  const authLinks   = document.getElementById('nav-auth-links');

  if (user) {
    const initials = user.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    const roleIcon = { customer: '🎫', organiser: '🎭', admin: '⚙️' }[user.role] || '👤';
    userSection.innerHTML = `
      <div class="user-pill" onclick="toggleUserMenu()" id="user-pill">
        <div class="user-avatar">${initials}</div>
        <div>
          <div class="user-name">${roleIcon} ${user.name}</div>
          <div class="user-role">${user.role}</div>
        </div>
      </div>
      <div id="user-menu" style="display:none;position:absolute;right:24px;top:72px;background:var(--bg-card);border:1px solid var(--border-mid);border-radius:var(--radius-md);padding:8px;min-width:190px;z-index:2000;box-shadow:var(--shadow-float);">
        ${user.role === 'customer'   ? `<a class="user-menu-item" href="#/" onclick="closeUserMenu()">🎟️ Browse Events</a>
           <a class="user-menu-item" href="#/bookings" onclick="closeUserMenu()">📋 My Bookings</a>
           <a class="user-menu-item" href="#/waitlist" onclick="closeUserMenu()">⏳ My Waitlist</a>` : ''}
        ${user.role === 'organiser'  ? `<a class="user-menu-item" href="#/organiser" onclick="closeUserMenu()">🎭 Organiser Dashboard</a>` : ''}
        ${user.role === 'admin'      ? `<a class="user-menu-item" href="#/admin" onclick="closeUserMenu()">⚙️ Admin Panel</a>
           <a class="user-menu-item" href="#/organiser" onclick="closeUserMenu()">🎭 Organiser View</a>` : ''}
        <div style="height:1px;background:var(--border-subtle);margin:6px 0;"></div>
        <a class="user-menu-item" href="#" onclick="logout();closeUserMenu();return false;" style="color:var(--accent-red)!important">🚪 Logout</a>
      </div>`;

    document.querySelectorAll('.user-menu-item').forEach(el => {
      el.style.cssText = 'display:block;padding:10px 14px;border-radius:var(--radius-sm);color:var(--text-secondary);font-size:14px;cursor:pointer;transition:all 0.15s;text-decoration:none;';
      el.addEventListener('mouseenter', () => el.style.background = 'var(--bg-secondary)');
      el.addEventListener('mouseleave', () => el.style.background = '');
    });

    authLinks.innerHTML = '';
  } else {
    userSection.innerHTML = `
      <div style="display:flex;gap:10px;">
        <button class="btn btn-secondary btn-sm" onclick="navigate('/login')">Login</button>
        <button class="btn btn-primary btn-sm" onclick="navigate('/register')">Sign Up</button>
      </div>`;
    authLinks.innerHTML = '';
  }
}

function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  if (menu) {
    const isVisible = menu.style.display !== 'none';
    menu.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
      setTimeout(() => {
        document.addEventListener('click', function handler(e) {
          const pill = document.getElementById('user-pill');
          const m    = document.getElementById('user-menu');
          if (m && pill && !pill.contains(e.target) && !m.contains(e.target)) {
            m.style.display = 'none';
          }
          document.removeEventListener('click', handler);
        });
      }, 10);
    }
  }
}
function closeUserMenu() {
  const menu = document.getElementById('user-menu');
  if (menu) menu.style.display = 'none';
}

// ─── Logout ───────────────────────────────────────────────────────
function logout() {
  Auth.clear();
  toast('info', 'Logged out', 'See you next time!');
  navigate('/', true);
  updateNav();
}

// ─── Scroll navbar ────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', scrollY > 20);
});

// ─── Helpers ──────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}
function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const ap = +h >= 12 ? 'PM' : 'AM';
  const hr = +h % 12 || 12;
  return `${hr}:${m} ${ap}`;
}
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Bootstrap ────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(handleRoute, 20);
});
