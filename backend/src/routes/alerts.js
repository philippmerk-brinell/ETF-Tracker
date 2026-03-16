const express = require('express');
const router = express.Router();
const db = require('../database');
const { checkAll } = require('../services/alertEngine');

// GET /api/alerts/global
router.get('/global', (req, res) => {
  const config = db.prepare('SELECT * FROM alert_config WHERE id = 1').get();
  res.json(config);
});

// PUT /api/alerts/global
router.put('/global', (req, res) => {
  const { daily_drop_pct, weekly_drop_pct, ath_drop_pct } = req.body;

  if (daily_drop_pct == null || weekly_drop_pct == null || ath_drop_pct == null) {
    return res.status(400).json({ error: 'daily_drop_pct, weekly_drop_pct and ath_drop_pct are required' });
  }

  db.prepare(`
    UPDATE alert_config SET daily_drop_pct = ?, weekly_drop_pct = ?, ath_drop_pct = ? WHERE id = 1
  `).run(
    parseFloat(daily_drop_pct),
    parseFloat(weekly_drop_pct),
    parseFloat(ath_drop_pct),
  );

  const config = db.prepare('SELECT * FROM alert_config WHERE id = 1').get();
  res.json(config);
});

// GET /api/alerts/log - recent alert history
router.get('/log', (req, res) => {
  const limit = parseInt(req.query.limit || '50');
  const logs = db.prepare(`
    SELECT * FROM alert_log ORDER BY triggered_at DESC LIMIT ?
  `).all(limit);
  res.json(logs);
});

// POST /api/alerts/check - manually trigger alert check
router.post('/check', async (req, res) => {
  try {
    // Run async, don't wait
    checkAll().catch(err => console.error('Manual check error:', err.message));
    res.json({ ok: true, message: 'Alert check started in background' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
