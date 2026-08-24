/* ═══════════════════════════════════════════════════════════════
   TicketFlow — Auth Pages (Login + Register)
   ═══════════════════════════════════════════════════════════════ */

// ─── Login Page ───────────────────────────────────────────────────
register('/login', () => {
  if (Auth.isLoggedIn()) return navigate('/', true);

  document.getElementById('app').innerHTML = `
    <div class="auth-container page-enter">
      <div class="auth-card">
        <div class="auth-header">
          <span class="auth-icon">🎟️</span>
          <h1 class="auth-title">Welcome Back</h1>
          <p class="auth-subtitle">Sign in to your TicketFlow account</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="login-email">Email Address</label>
          <input id="login-email" type="email" class="form-input" placeholder="you@example.com" autocomplete="email">
        </div>
        <div class="form-group">
          <label class="form-label" for="login-password">Password</label>
          <input id="login-password" type="password" class="form-input" placeholder="••••••••" autocomplete="current-password">
        </div>
        <p id="login-error" class="form-error" style="display:none;margin-bottom:12px;"></p>
        <button id="login-btn" class="btn btn-primary btn-full btn-lg" onclick="doLogin()">
          Sign In
        </button>

        <div class="auth-divider">or</div>
        <p class="text-center" style="font-size:14px;color:var(--text-secondary);">
          Don't have an account?
          <a href="#/register" class="auth-link">Create one free</a>
        </p>

        <div style="margin-top:24px;padding:16px;background:var(--bg-secondary);border-radius:var(--radius-md);font-size:13px;color:var(--text-muted);">
          <strong style="color:var(--text-secondary);">Demo Accounts:</strong><br>
          Customer: arjun@customer.com / customer123<br>
          Organiser: ravi@organiser.com / organiser123<br>
          Admin: admin@ticketflow.com / admin123
        </div>
      </div>
    </div>`;

  // Enter key
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
});

async function doLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');

  errEl.style.display = 'none';
  if (!email || !password) { errEl.textContent = 'Please enter email and password.'; errEl.style.display = 'block'; return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Signing in…';

  try {
    const data = await post('/auth/login', { email, password });
    Auth.save(data.token, data.user);
    toast('success', 'Welcome back!', `Hello, ${data.user.name} 👋`);
    const dest = { customer: '/', organiser: '/organiser', admin: '/admin' }[data.user.role] || '/';
    navigate(dest, true);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.innerHTML = 'Sign In';
  }
}

// ─── Register Page ────────────────────────────────────────────────
register('/register', () => {
  if (Auth.isLoggedIn()) return navigate('/', true);

  let selectedRole = 'customer';

  document.getElementById('app').innerHTML = `
    <div class="auth-container page-enter">
      <div class="auth-card">
        <div class="auth-header">
          <span class="auth-icon">✨</span>
          <h1 class="auth-title">Join TicketFlow</h1>
          <p class="auth-subtitle">Create your account in seconds</p>
        </div>

        <div class="role-selector" id="role-selector">
          <div class="role-option selected" onclick="selectRole('customer')" id="role-customer">
            <div class="role-option-icon">🎫</div>
            <div class="role-option-label">Customer</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Book tickets</div>
          </div>
          <div class="role-option" onclick="selectRole('organiser')" id="role-organiser">
            <div class="role-option-icon">🎭</div>
            <div class="role-option-label">Organiser</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Manage events</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="reg-name">Full Name</label>
          <input id="reg-name" type="text" class="form-input" placeholder="John Doe">
        </div>
        <div class="form-group">
          <label class="form-label" for="reg-email">Email Address</label>
          <input id="reg-email" type="email" class="form-input" placeholder="you@example.com">
        </div>
        <div class="form-group">
          <label class="form-label" for="reg-password">Password</label>
          <input id="reg-password" type="password" class="form-input" placeholder="Min. 6 characters">
        </div>
        <p id="reg-error" class="form-error" style="display:none;margin-bottom:12px;"></p>
        <button id="reg-btn" class="btn btn-primary btn-full btn-lg" onclick="doRegister()">
          Create Account
        </button>

        <div class="auth-divider">or</div>
        <p class="text-center" style="font-size:14px;color:var(--text-secondary);">
          Already have an account?
          <a href="#/login" class="auth-link">Sign in</a>
        </p>
      </div>
    </div>`;

  window.selectRole = function(role) {
    selectedRole = role;
    document.getElementById('role-customer').classList.toggle('selected', role === 'customer');
    document.getElementById('role-organiser').classList.toggle('selected', role === 'organiser');
  };
});

async function doRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl    = document.getElementById('reg-error');
  const btn      = document.getElementById('reg-btn');

  // Get role from UI
  const role = document.getElementById('role-organiser').classList.contains('selected') ? 'organiser' : 'customer';

  errEl.style.display = 'none';
  if (!name || !email || !password) { errEl.textContent = 'All fields are required.'; errEl.style.display = 'block'; return; }
  if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.style.display = 'block'; return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating account…';

  try {
    const data = await post('/auth/register', { name, email, password, role });
    Auth.save(data.token, data.user);
    toast('success', 'Account created!', `Welcome to TicketFlow, ${data.user.name}! 🎉`);
    const dest = role === 'organiser' ? '/organiser' : '/';
    navigate(dest, true);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.innerHTML = 'Create Account';
  }
}
