require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/events',    require('./routes/events'));
app.use('/api/bookings',  require('./routes/bookings'));
app.use('/api/waitlist',  require('./routes/waitlist'));
app.use('/api/organiser', require('./routes/organiser'));
app.use('/api/admin',     require('./routes/admin'));

// ─── Serve Frontend ────────────────────────────────────────────────────────
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// SPA fallback — Express v5 uses /{*path} instead of *
app.get('/{*path}', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ─── Error Handler ─────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start Server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎟️  TicketFlow Server running on http://localhost:${PORT}`);
  console.log(`   Frontend: http://localhost:${PORT}`);
  console.log(`   API:      http://localhost:${PORT}/api`);
  console.log('');
});

// ─── Start Scheduler ───────────────────────────────────────────────────────
const { startScheduler } = require('./scheduler');
startScheduler();

module.exports = app;
