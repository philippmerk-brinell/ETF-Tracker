const express = require('express');
const cors = require('cors');
const path = require('path');
const { PORT } = require('./config');

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/etfs', require('./routes/etfs'));
app.use('/api/etfs', require('./routes/prices'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// Serve frontend in production
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (require('fs').existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ETF Tracker backend running on http://0.0.0.0:${PORT}`);

  // Start WhatsApp client only if enabled in config
  const db = require('./database');
  const notifCfg = db.prepare('SELECT whatsapp_enabled FROM notification_config WHERE id = 1').get();
  if (notifCfg?.whatsapp_enabled) {
    const { init } = require('./services/whatsappService');
    init();
  }

  // Start alert scheduler
  const { startScheduler } = require('./scheduler');
  startScheduler();
});
